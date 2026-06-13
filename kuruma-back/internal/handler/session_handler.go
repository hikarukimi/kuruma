package handler

import (
	"context"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"kuruma-back/internal/model"
	"kuruma-back/internal/repository"
	"kuruma-back/internal/service"
)

type SessionHandler struct {
	sessions    *service.SessionService
	calls       *repository.CallRepository
	recordings  *repository.RecordingRepository
	transcripts *repository.TranscriptRepository
	transcriber *service.TranscriptionService
	broadcaster SessionBroadcaster
}

type createSessionRequest struct {
	DriverName        string `json:"driverName"`
	DriverPhoneMasked string `json:"driverPhoneMasked"`
	Description       string `json:"description"`
	LocationStatus    string `json:"locationStatus"`
	NetworkStatus     string `json:"networkStatus"`
	DriverOnline      *bool  `json:"driverOnline"`
	SignalingStatus   string `json:"signalingStatus"`
	RecordingStatus   string `json:"recordingStatus"`
	CallStatus        string `json:"callStatus"`
}

type recordingResponse struct {
	ID          string     `json:"id"`
	SessionID   string     `json:"sessionId"`
	CallID      *string    `json:"callId,omitempty"`
	Status      string     `json:"status"`
	FileSize    int64      `json:"fileSize"`
	MimeType    string     `json:"mimeType"`
	StartedAt   *time.Time `json:"startedAt,omitempty"`
	CompletedAt *time.Time `json:"completedAt,omitempty"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
	DownloadURL string     `json:"downloadUrl"`
}

type transcriptResponse struct {
	ID           string                      `json:"id"`
	SessionID    string                      `json:"sessionId"`
	RecordingID  string                      `json:"recordingId"`
	Status       string                      `json:"status"`
	Provider     string                      `json:"provider"`
	Model        string                      `json:"model"`
	ErrorMessage *string                     `json:"errorMessage,omitempty"`
	CompletedAt  *time.Time                  `json:"completedAt,omitempty"`
	CreatedAt    time.Time                   `json:"createdAt"`
	UpdatedAt    time.Time                   `json:"updatedAt"`
	Segments     []transcriptSegmentResponse `json:"segments"`
}

type transcriptSegmentResponse struct {
	ID           string    `json:"id"`
	TranscriptID string    `json:"transcriptId"`
	SessionID    string    `json:"sessionId"`
	RecordingID  string    `json:"recordingId"`
	ChunkIndex   int       `json:"chunkIndex"`
	SegmentIndex int       `json:"segmentIndex"`
	Speaker      string    `json:"speaker"`
	Content      string    `json:"content"`
	CreatedAt    time.Time `json:"createdAt"`
}

type SessionBroadcaster interface {
	BroadcastSession(session *service.Session)
	BroadcastSessionCreated(session *service.Session)
}

func NewSessionHandler(
	sessions *service.SessionService,
	calls *repository.CallRepository,
	recordings *repository.RecordingRepository,
	transcripts *repository.TranscriptRepository,
	transcriber *service.TranscriptionService,
) *SessionHandler {
	return &SessionHandler{
		sessions:    sessions,
		calls:       calls,
		recordings:  recordings,
		transcripts: transcripts,
		transcriber: transcriber,
	}
}

func (h *SessionHandler) SetBroadcaster(broadcaster SessionBroadcaster) {
	h.broadcaster = broadcaster
}

func (h *SessionHandler) Create(c *gin.Context) {
	var req createSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	session, err := h.sessions.Create(c.Request.Context(), service.CreateSessionInput{
		DriverName:        req.DriverName,
		DriverPhoneMasked: req.DriverPhoneMasked,
		Description:       req.Description,
		LocationStatus:    req.LocationStatus,
		NetworkStatus:     req.NetworkStatus,
		DriverOnline:      req.DriverOnline,
		SignalingStatus:   req.SignalingStatus,
		RecordingStatus:   req.RecordingStatus,
		CallStatus:        req.CallStatus,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "create session failed"})
		return
	}

	h.broadcastCreated(session)
	c.JSON(http.StatusCreated, gin.H{"session": session})
}

func (h *SessionHandler) List(c *gin.Context) {
	sessions, err := h.sessions.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "list sessions failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"sessions": sessions})
}

func (h *SessionHandler) Get(c *gin.Context) {
	session, err := h.sessions.Get(c.Request.Context(), c.Param("id"))
	if err != nil {
		writeSessionError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"session": session})
}

func (h *SessionHandler) StartRecording(c *gin.Context) {
	session, err := h.sessions.StartRecording(c.Request.Context(), c.Param("id"))
	if err != nil {
		writeSessionError(c, err)
		return
	}

	h.broadcast(session)
	c.JSON(http.StatusOK, gin.H{"session": session})
}

func (h *SessionHandler) StopRecording(c *gin.Context) {
	session, err := h.sessions.StopRecording(c.Request.Context(), c.Param("id"))
	if err != nil {
		writeSessionError(c, err)
		return
	}

	h.broadcast(session)
	c.JSON(http.StatusOK, gin.H{"session": session})
}

func (h *SessionHandler) UploadRecording(c *gin.Context) {
	if h.recordings == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "recording storage is unavailable"})
		return
	}

	sessionID := c.Param("id")
	if _, err := h.sessions.Get(c.Request.Context(), sessionID); err != nil {
		writeSessionError(c, err)
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "recording file is required"})
		return
	}

	var callID *string
	if h.calls != nil {
		call, err := h.calls.LatestForSession(c.Request.Context(), sessionID)
		if err == nil && call != nil {
			callID = &call.ID
		} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			log.Printf("find call for recording session %s: %v", sessionID, err)
		}
	}

	recording, err := h.recordings.SaveUploaded(c.Request.Context(), repository.SaveRecordingInput{
		SessionID: sessionID,
		CallID:    callID,
		File:      file,
		MimeType:  c.PostForm("mimeType"),
	})
	if err != nil {
		log.Printf("save recording for session %s: %v", sessionID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "save recording failed"})
		return
	}

	session, err := h.sessions.StopRecording(c.Request.Context(), sessionID)
	if err == nil {
		h.broadcast(session)
	}
	if h.transcriber != nil {
		h.transcriber.EnqueueRecording(recording)
	}

	c.JSON(http.StatusCreated, gin.H{"recording": recording, "session": session})
}

func (h *SessionHandler) ListRecordings(c *gin.Context) {
	if h.recordings == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "recording storage is unavailable"})
		return
	}

	sessionID := c.Param("id")
	if _, err := h.sessions.Get(c.Request.Context(), sessionID); err != nil {
		writeSessionError(c, err)
		return
	}

	recordings, err := h.recordings.ListBySession(c.Request.Context(), sessionID)
	if err != nil {
		log.Printf("list recordings for session %s: %v", sessionID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "list recordings failed"})
		return
	}

	response := make([]recordingResponse, 0, len(recordings))
	for i := range recordings {
		response = append(response, buildRecordingResponse(&recordings[i]))
	}
	c.JSON(http.StatusOK, gin.H{"recordings": response})
}

func (h *SessionHandler) DownloadRecording(c *gin.Context) {
	if h.recordings == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "recording storage is unavailable"})
		return
	}

	sessionID := c.Param("id")
	recordingID := c.Param("recordingId")
	if _, err := h.sessions.Get(c.Request.Context(), sessionID); err != nil {
		writeSessionError(c, err)
		return
	}

	recording, err := h.recordings.FindForSession(c.Request.Context(), sessionID, recordingID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "recording not found"})
			return
		}
		log.Printf("find recording %s for session %s: %v", recordingID, sessionID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "find recording failed"})
		return
	}

	h.serveRecordingFile(c, recording)
}

func (h *SessionHandler) serveRecordingFile(c *gin.Context, recording *model.Recording) {
	file, fileName, err := h.recordings.Open(recording)
	if err != nil {
		if errors.Is(err, repository.ErrRecordingPathOutsideStorage) {
			c.JSON(http.StatusForbidden, gin.H{"error": "recording file is unavailable"})
			return
		}
		log.Printf("open recording %s for session %s: %v", recording.ID, recording.SessionID, err)
		c.JSON(http.StatusNotFound, gin.H{"error": "recording file not found"})
		return
	}
	defer file.Close()

	c.Header("Content-Type", recording.MimeType)
	c.Header("Content-Disposition", `inline; filename="`+fileName+`"`)
	http.ServeContent(c.Writer, c.Request, fileName, recording.UpdatedAt, file)
}

func (h *SessionHandler) GetTranscript(c *gin.Context) {
	if h.transcripts == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "transcript storage is unavailable"})
		return
	}

	sessionID := c.Param("id")
	if _, err := h.sessions.Get(c.Request.Context(), sessionID); err != nil {
		writeSessionError(c, err)
		return
	}

	transcripts, err := h.transcripts.ListBySession(c.Request.Context(), sessionID)
	if err != nil {
		log.Printf("list transcripts for session %s: %v", sessionID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "list transcripts failed"})
		return
	}

	response := make([]transcriptResponse, 0, len(transcripts))
	for i := range transcripts {
		response = append(response, buildTranscriptResponse(&transcripts[i]))
	}
	c.JSON(http.StatusOK, gin.H{"transcripts": response})
}

func (h *SessionHandler) EndCall(c *gin.Context) {
	session, err := h.sessions.EndCall(c.Request.Context(), c.Param("id"))
	if err != nil {
		writeSessionError(c, err)
		return
	}
	h.endCallRecord(c.Request.Context(), c.Param("id"), repository.CallStatusEnded, "session.end")

	h.broadcast(session)
	c.JSON(http.StatusOK, gin.H{"session": session})
}

func (h *SessionHandler) endCallRecord(ctx context.Context, sessionID string, status string, reason string) {
	if h.calls == nil {
		return
	}

	if _, err := h.calls.EndLatestOpen(ctx, sessionID, status, reason); err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		log.Printf("end call record for session %s: %v", sessionID, err)
	}
}

func (h *SessionHandler) broadcast(session *service.Session) {
	if h.broadcaster != nil {
		h.broadcaster.BroadcastSession(session)
	}
}

func (h *SessionHandler) broadcastCreated(session *service.Session) {
	if h.broadcaster != nil {
		h.broadcaster.BroadcastSessionCreated(session)
	}
}

func buildRecordingResponse(recording *model.Recording) recordingResponse {
	return recordingResponse{
		ID:          recording.ID,
		SessionID:   recording.SessionID,
		CallID:      recording.CallID,
		Status:      recording.Status,
		FileSize:    recording.FileSize,
		MimeType:    recording.MimeType,
		StartedAt:   recording.StartedAt,
		CompletedAt: recording.CompletedAt,
		CreatedAt:   recording.CreatedAt,
		UpdatedAt:   recording.UpdatedAt,
		DownloadURL: "/api/v1/sessions/" + recording.SessionID + "/recordings/" + recording.ID + "/file",
	}
}

func buildTranscriptResponse(transcript *model.CallTranscript) transcriptResponse {
	segments := make([]transcriptSegmentResponse, 0, len(transcript.Segments))
	for _, segment := range transcript.Segments {
		segments = append(segments, transcriptSegmentResponse{
			ID:           segment.ID,
			TranscriptID: segment.TranscriptID,
			SessionID:    segment.SessionID,
			RecordingID:  segment.RecordingID,
			ChunkIndex:   segment.ChunkIndex,
			SegmentIndex: segment.SegmentIndex,
			Speaker:      segment.Speaker,
			Content:      segment.Content,
			CreatedAt:    segment.CreatedAt,
		})
	}

	return transcriptResponse{
		ID:           transcript.ID,
		SessionID:    transcript.SessionID,
		RecordingID:  transcript.RecordingID,
		Status:       transcript.Status,
		Provider:     transcript.Provider,
		Model:        transcript.Model,
		ErrorMessage: transcript.ErrorMessage,
		CompletedAt:  transcript.CompletedAt,
		CreatedAt:    transcript.CreatedAt,
		UpdatedAt:    transcript.UpdatedAt,
		Segments:     segments,
	}
}

func writeSessionError(c *gin.Context, err error) {
	if errors.Is(err, service.ErrSessionNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
		return
	}

	c.JSON(http.StatusInternalServerError, gin.H{"error": "session operation failed"})
}
