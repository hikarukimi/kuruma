package service

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"mime"
	"mime/multipart"
	"net/http"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"kuruma-back/internal/config"
	"kuruma-back/internal/model"
	"kuruma-back/internal/repository"
)

const (
	transcriptionProviderBigModel = "bigmodel"
	maxASRChunkDuration           = 30 * time.Second
)

type TranscriptionService struct {
	client        *BigModelClient
	recordings    *repository.RecordingRepository
	transcripts   *repository.TranscriptRepository
	maxAudioBytes int64
	ffmpegPath    string
}

type TranscriptLine struct {
	Speaker string `json:"speaker"`
	Content string `json:"content"`
}

func NewTranscriptionService(cfg config.Config, recordings *repository.RecordingRepository, transcripts *repository.TranscriptRepository) *TranscriptionService {
	maxAudioBytes := int64(cfg.BigModelMaxAudioMB) * 1024 * 1024
	if maxAudioBytes <= 0 {
		maxAudioBytes = 25 * 1024 * 1024
	}

	return &TranscriptionService{
		client:        NewBigModelClient(cfg),
		recordings:    recordings,
		transcripts:   transcripts,
		maxAudioBytes: maxAudioBytes,
		ffmpegPath:    strings.TrimSpace(cfg.FFmpegPath),
	}
}

func (s *TranscriptionService) EnqueueRecording(recording *model.Recording) {
	if recording == nil || s == nil || s.recordings == nil || s.transcripts == nil || s.client == nil {
		return
	}

	recordingCopy := *recording
	transcript, err := s.transcripts.Start(context.Background(), recordingCopy, transcriptionProviderBigModel, s.client.Model())
	if err != nil {
		log.Printf("start transcript for recording %s session %s: %v", recordingCopy.ID, recordingCopy.SessionID, err)
		return
	}

	go func() {
		if err := s.completeTranscript(context.Background(), transcript, recordingCopy); err != nil {
			log.Printf("transcribe recording %s for session %s: %v", recordingCopy.ID, recordingCopy.SessionID, err)
		}
	}()
}

func (s *TranscriptionService) TranscribeRecording(ctx context.Context, recording model.Recording) error {
	transcript, err := s.transcripts.Start(ctx, recording, transcriptionProviderBigModel, s.client.Model())
	if err != nil {
		return err
	}

	return s.completeTranscript(ctx, transcript, recording)
}

func (s *TranscriptionService) completeTranscript(ctx context.Context, transcript *model.CallTranscript, recording model.Recording) error {
	lines, err := s.transcribeRecording(ctx, recording)
	if err != nil {
		_ = s.transcripts.Fail(ctx, transcript, err.Error())
		return err
	}

	segments := make([]repository.SaveTranscriptSegmentInput, 0, len(lines))
	for index, line := range lines {
		segments = append(segments, repository.SaveTranscriptSegmentInput{
			ChunkIndex:   line.chunkIndex,
			SegmentIndex: index,
			Speaker:      line.speaker,
			Content:      line.content,
		})
	}

	return s.transcripts.Complete(ctx, transcript, segments)
}

type transcriptLineResult struct {
	chunkIndex int
	speaker    string
	content    string
}

func (s *TranscriptionService) transcribeRecording(ctx context.Context, recording model.Recording) ([]transcriptLineResult, error) {
	if strings.TrimSpace(s.client.APIKey()) == "" {
		return nil, errors.New("bigmodel api key is empty")
	}

	file, fileName, err := s.recordings.Open(&recording)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		return nil, err
	}
	if len(data) == 0 {
		return nil, errors.New("recording file is empty")
	}

	mimeType := normalizeAudioMimeType(recording.MimeType, recording.FilePath)
	inputs, err := s.buildASRInputsForRecording(ctx, data, fileName, mimeType)
	if err != nil {
		return nil, err
	}

	results := make([]transcriptLineResult, 0, len(inputs))
	for index, input := range inputs {
		lines, err := s.client.TranscribeAudio(ctx, input)
		if err != nil {
			return nil, err
		}
		for _, line := range lines {
			results = append(results, transcriptLineResult{
				chunkIndex: index,
				speaker:    line.Speaker,
				content:    line.Content,
			})
		}
	}

	return results, nil
}

func (s *TranscriptionService) buildASRInputsForRecording(ctx context.Context, data []byte, fileName string, mimeType string) ([]AudioTranscriptionInput, error) {
	return buildASRInputsForRecording(data, fileName, mimeType, s.maxAudioBytes, func(data []byte, fileName string, mimeType string) ([]byte, error) {
		return s.extractWAVWithFFmpeg(ctx, data)
	})
}

func (s *TranscriptionService) CanExtractRecordingAudio() bool {
	if s == nil {
		return false
	}
	ffmpegPath := strings.TrimSpace(s.ffmpegPath)
	if ffmpegPath == "" {
		ffmpegPath = "ffmpeg"
	}
	_, err := exec.LookPath(ffmpegPath)
	return err == nil
}

type AudioTranscriptionInput struct {
	Data     []byte
	FileName string
	MimeType string
}

type recordingAudioExtractor func(data []byte, fileName string, mimeType string) ([]byte, error)

type BigModelClient struct {
	apiKey   string
	endpoint string
	model    string
	client   *http.Client
}

func NewBigModelClient(cfg config.Config) *BigModelClient {
	return &BigModelClient{
		apiKey:   cfg.BigModelAPIKey,
		endpoint: cfg.BigModelEndpoint,
		model:    cfg.BigModelModel,
		client: &http.Client{
			Timeout: 2 * time.Minute,
		},
	}
}

func (c *BigModelClient) APIKey() string {
	if c == nil {
		return ""
	}
	return c.apiKey
}

func (c *BigModelClient) Model() string {
	if c == nil || strings.TrimSpace(c.model) == "" {
		return "glm-asr-2512"
	}
	return c.model
}

func (c *BigModelClient) TranscribeAudio(ctx context.Context, input AudioTranscriptionInput) ([]TranscriptLine, error) {
	if c == nil {
		return nil, errors.New("bigmodel client is nil")
	}
	if strings.TrimSpace(c.apiKey) == "" {
		return nil, errors.New("bigmodel api key is empty")
	}
	if strings.TrimSpace(c.endpoint) == "" {
		return nil, errors.New("bigmodel endpoint is empty")
	}
	if len(input.Data) == 0 {
		return nil, errors.New("audio file is empty")
	}
	if strings.TrimSpace(input.FileName) == "" {
		return nil, errors.New("audio file name is empty")
	}

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	fileWriter, err := writer.CreateFormFile("file", input.FileName)
	if err != nil {
		return nil, err
	}
	if _, err := fileWriter.Write(input.Data); err != nil {
		return nil, err
	}
	if err := writer.WriteField("model", c.Model()); err != nil {
		return nil, err
	}
	if err := writer.WriteField("stream", "false"); err != nil {
		return nil, err
	}
	if err := writer.Close(); err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint, &body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("bigmodel request failed: status %d, body %s", resp.StatusCode, string(respBody))
	}

	text, err := extractBigModelASRText(respBody)
	if err != nil {
		return nil, err
	}
	return []TranscriptLine{{Speaker: "说话人1", Content: text}}, nil
}

func extractBigModelASRText(body []byte) (string, error) {
	var response struct {
		Text string `json:"text"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return "", err
	}
	text := strings.TrimSpace(response.Text)
	if text == "" {
		return "", errors.New("bigmodel response text is empty")
	}
	return text, nil
}

func buildASRInputs(data []byte, fileName string, mimeType string, maxBytes int64) ([]AudioTranscriptionInput, error) {
	normalizedName, err := normalizeASRFileName(fileName, mimeType)
	if err != nil {
		return nil, err
	}

	if !strings.HasSuffix(strings.ToLower(normalizedName), ".wav") {
		if maxBytes > 0 && int64(len(data)) > maxBytes {
			return nil, fmt.Errorf("audio file exceeds bigmodel limit: %d bytes > %d bytes", len(data), maxBytes)
		}
		return []AudioTranscriptionInput{{
			Data:     data,
			FileName: normalizedName,
			MimeType: mimeType,
		}}, nil
	}

	chunks, ok, err := splitWAVPCMByDuration(data, maxASRChunkDuration, maxBytes)
	if err != nil {
		return nil, err
	}
	if !ok || len(chunks) <= 1 {
		if maxBytes > 0 && int64(len(data)) > maxBytes {
			return nil, fmt.Errorf("audio file exceeds bigmodel limit: %d bytes > %d bytes", len(data), maxBytes)
		}
		return []AudioTranscriptionInput{{
			Data:     data,
			FileName: normalizedName,
			MimeType: mimeType,
		}}, nil
	}

	baseName := strings.TrimSuffix(normalizedName, filepath.Ext(normalizedName))
	inputs := make([]AudioTranscriptionInput, 0, len(chunks))
	for index, chunk := range chunks {
		if maxBytes > 0 && int64(len(chunk)) > maxBytes {
			return nil, fmt.Errorf("audio chunk exceeds bigmodel limit: %d bytes > %d bytes", len(chunk), maxBytes)
		}
		inputs = append(inputs, AudioTranscriptionInput{
			Data:     chunk,
			FileName: fmt.Sprintf("%s-%04d.wav", baseName, index+1),
			MimeType: mimeType,
		})
	}
	return inputs, nil
}

func buildASRInputsForRecording(data []byte, fileName string, mimeType string, maxBytes int64, extract recordingAudioExtractor) ([]AudioTranscriptionInput, error) {
	if shouldExtractRecordingAudio(fileName, mimeType) {
		if extract == nil {
			return nil, errors.New("ffmpeg is required to transcribe webm/mp4 recordings")
		}

		wav, err := extract(data, fileName, mimeType)
		if err != nil {
			return nil, err
		}
		fileName = strings.TrimSuffix(fileName, filepath.Ext(fileName)) + ".wav"
		if strings.TrimSpace(fileName) == ".wav" {
			fileName = "recording.wav"
		}
		return buildASRInputs(wav, fileName, "audio/wav", maxBytes)
	}

	return buildASRInputs(data, fileName, mimeType, maxBytes)
}

func shouldExtractRecordingAudio(fileName string, mimeType string) bool {
	extension := strings.ToLower(filepath.Ext(fileName))
	mimeType = strings.ToLower(strings.TrimSpace(mimeType))
	switch extension {
	case ".wav", ".mp3":
		return false
	case ".webm", ".mp4", ".m4a", ".mov", ".ogg":
		return true
	}

	switch {
	case strings.Contains(mimeType, "webm"),
		strings.Contains(mimeType, "mp4"),
		strings.Contains(mimeType, "m4a"),
		strings.Contains(mimeType, "quicktime"),
		strings.Contains(mimeType, "ogg"):
		return true
	default:
		return false
	}
}

func (s *TranscriptionService) extractWAVWithFFmpeg(ctx context.Context, data []byte) ([]byte, error) {
	ffmpegPath := strings.TrimSpace(s.ffmpegPath)
	if ffmpegPath == "" {
		ffmpegPath = "ffmpeg"
	}

	cmd := exec.CommandContext(ctx, ffmpegPath,
		"-hide_banner",
		"-loglevel", "error",
		"-i", "pipe:0",
		"-vn",
		"-ac", "1",
		"-ar", "16000",
		"-f", "wav",
		"pipe:1",
	)
	cmd.Stdin = bytes.NewReader(data)
	var output bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &output
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		if errors.Is(err, exec.ErrNotFound) {
			return nil, errors.New("ffmpeg is required to transcribe webm/mp4 recordings")
		}
		message := strings.TrimSpace(stderr.String())
		if message == "" {
			message = err.Error()
		}
		return nil, fmt.Errorf("extract recording audio with ffmpeg: %s", message)
	}
	if output.Len() == 0 {
		return nil, errors.New("ffmpeg extracted empty audio")
	}
	return output.Bytes(), nil
}

func normalizeAudioMimeType(mimeType string, filePath string) string {
	mimeType = strings.TrimSpace(mimeType)
	if mimeType != "" && mimeType != "application/octet-stream" {
		return mimeType
	}

	if byExtension := mime.TypeByExtension(strings.ToLower(filepath.Ext(filePath))); byExtension != "" {
		return byExtension
	}

	return "application/octet-stream"
}

func normalizeASRFileName(fileName string, mimeType string) (string, error) {
	extension := strings.ToLower(filepath.Ext(fileName))
	mimeType = strings.ToLower(strings.TrimSpace(mimeType))
	if extension == "" {
		switch {
		case strings.Contains(mimeType, "wav"):
			extension = ".wav"
		case strings.Contains(mimeType, "mpeg"), strings.Contains(mimeType, "mp3"):
			extension = ".mp3"
		}
	}

	switch extension {
	case ".wav", ".mp3":
		if strings.TrimSpace(fileName) == "" {
			return "recording" + extension, nil
		}
		if filepath.Ext(fileName) == "" {
			return fileName + extension, nil
		}
		return fileName, nil
	default:
		return "", fmt.Errorf("bigmodel asr only supports .wav/.mp3, got %s", strings.TrimSpace(mimeType))
	}
}

type wavPCMInfo struct {
	audioFormat   uint16
	channels      uint16
	sampleRate    uint32
	byteRate      uint32
	blockAlign    uint16
	bitsPerSample uint16
	data          []byte
}

func splitWAVPCMByDuration(data []byte, duration time.Duration, maxBytes int64) ([][]byte, bool, error) {
	info, ok := parseWAVPCM(data)
	if !ok {
		return nil, false, nil
	}
	if info.byteRate == 0 || info.blockAlign == 0 {
		return nil, false, errors.New("wav byte rate is invalid")
	}

	maxDataBytes := int64(duration.Seconds() * float64(info.byteRate))
	if maxBytes > 44 && maxDataBytes > maxBytes-44 {
		maxDataBytes = maxBytes - 44
	}
	maxDataBytes = maxDataBytes / int64(info.blockAlign) * int64(info.blockAlign)
	if maxDataBytes <= 0 {
		return nil, false, errors.New("wav chunk size is invalid")
	}
	if int64(len(info.data)) <= maxDataBytes {
		return [][]byte{data}, true, nil
	}

	chunks := make([][]byte, 0, int64(len(info.data))/maxDataBytes+1)
	for start := int64(0); start < int64(len(info.data)); start += maxDataBytes {
		end := start + maxDataBytes
		if end > int64(len(info.data)) {
			end = int64(len(info.data))
		}
		chunks = append(chunks, buildWAVPCM(info, info.data[start:end]))
	}
	return chunks, true, nil
}

func parseWAVPCM(data []byte) (wavPCMInfo, bool) {
	if len(data) < 44 || string(data[0:4]) != "RIFF" || string(data[8:12]) != "WAVE" {
		return wavPCMInfo{}, false
	}

	var info wavPCMInfo
	var foundFmt bool
	var foundData bool
	for offset := 12; offset+8 <= len(data); {
		chunkID := string(data[offset : offset+4])
		chunkSize := int(binary.LittleEndian.Uint32(data[offset+4 : offset+8]))
		chunkStart := offset + 8
		chunkEnd := chunkStart + chunkSize
		if chunkSize < 0 || chunkEnd > len(data) {
			return wavPCMInfo{}, false
		}

		switch chunkID {
		case "fmt ":
			if chunkSize < 16 {
				return wavPCMInfo{}, false
			}
			format := data[chunkStart:chunkEnd]
			info.audioFormat = binary.LittleEndian.Uint16(format[0:2])
			info.channels = binary.LittleEndian.Uint16(format[2:4])
			info.sampleRate = binary.LittleEndian.Uint32(format[4:8])
			info.byteRate = binary.LittleEndian.Uint32(format[8:12])
			info.blockAlign = binary.LittleEndian.Uint16(format[12:14])
			info.bitsPerSample = binary.LittleEndian.Uint16(format[14:16])
			foundFmt = true
		case "data":
			info.data = data[chunkStart:chunkEnd]
			foundData = true
		}

		offset = chunkEnd
		if offset%2 == 1 {
			offset++
		}
	}

	if !foundFmt || !foundData || info.audioFormat != 1 {
		return wavPCMInfo{}, false
	}
	return info, true
}

func buildWAVPCM(info wavPCMInfo, pcm []byte) []byte {
	output := make([]byte, 44+len(pcm))
	copy(output[0:4], "RIFF")
	binary.LittleEndian.PutUint32(output[4:8], uint32(36+len(pcm)))
	copy(output[8:12], "WAVE")
	copy(output[12:16], "fmt ")
	binary.LittleEndian.PutUint32(output[16:20], 16)
	binary.LittleEndian.PutUint16(output[20:22], info.audioFormat)
	binary.LittleEndian.PutUint16(output[22:24], info.channels)
	binary.LittleEndian.PutUint32(output[24:28], info.sampleRate)
	binary.LittleEndian.PutUint32(output[28:32], info.byteRate)
	binary.LittleEndian.PutUint16(output[32:34], info.blockAlign)
	binary.LittleEndian.PutUint16(output[34:36], info.bitsPerSample)
	copy(output[36:40], "data")
	binary.LittleEndian.PutUint32(output[40:44], uint32(len(pcm)))
	copy(output[44:], pcm)
	return output
}
