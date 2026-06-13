package service

import (
	"context"
	"encoding/binary"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestBigModelClientTranscribeAudioSendsMultipartASRRequest(t *testing.T) {
	audioData := []byte("fake wav bytes")

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("method = %s, want POST", r.Method)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer test-key" {
			t.Fatalf("Authorization = %q, want Bearer test-key", got)
		}
		if got := r.Header.Get("Content-Type"); !strings.HasPrefix(got, "multipart/form-data;") {
			t.Fatalf("Content-Type = %q, want multipart/form-data", got)
		}
		if err := r.ParseMultipartForm(8 << 20); err != nil {
			t.Fatalf("ParseMultipartForm: %v", err)
		}
		if got := r.FormValue("model"); got != "glm-asr-2512" {
			t.Fatalf("model = %q, want glm-asr-2512", got)
		}
		if got := r.FormValue("stream"); got != "false" {
			t.Fatalf("stream = %q, want false", got)
		}

		file, header, err := r.FormFile("file")
		if err != nil {
			t.Fatalf("FormFile: %v", err)
		}
		defer file.Close()
		if header.Filename != "recording.wav" {
			t.Fatalf("filename = %q, want recording.wav", header.Filename)
		}
		uploaded, err := io.ReadAll(file)
		if err != nil {
			t.Fatalf("read uploaded file: %v", err)
		}
		if string(uploaded) != string(audioData) {
			t.Fatalf("uploaded file = %q, want %q", string(uploaded), string(audioData))
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"text":"测试内容"}`))
	}))
	defer server.Close()

	client := &BigModelClient{
		apiKey:   "test-key",
		endpoint: server.URL,
		model:    "glm-asr-2512",
		client:   server.Client(),
	}

	lines, err := client.TranscribeAudio(context.Background(), AudioTranscriptionInput{
		Data:     audioData,
		FileName: "recording.wav",
		MimeType: "audio/wav",
	})
	if err != nil {
		t.Fatalf("TranscribeAudio returned error: %v", err)
	}
	if len(lines) != 1 || lines[0].Content != "测试内容" {
		t.Fatalf("lines = %+v, want one parsed transcript line", lines)
	}
}

func TestBuildASRInputsSplitsLongWAVIntoThirtySecondChunks(t *testing.T) {
	wav := buildTestWAV(48000, 31*time.Second)

	inputs, err := buildASRInputs(wav, "recording.wav", "audio/wav", 25*1024*1024)
	if err != nil {
		t.Fatalf("buildASRInputs returned error: %v", err)
	}
	if len(inputs) != 2 {
		t.Fatalf("len(inputs) = %d, want 2", len(inputs))
	}
	if inputs[0].FileName != "recording-0001.wav" || inputs[1].FileName != "recording-0002.wav" {
		t.Fatalf("file names = %q, %q", inputs[0].FileName, inputs[1].FileName)
	}
	if len(inputs[0].Data) != 44+48000*2*30 {
		t.Fatalf("first chunk bytes = %d, want %d", len(inputs[0].Data), 44+48000*2*30)
	}
}

func buildTestWAV(sampleRate int, duration time.Duration) []byte {
	pcmBytes := int(duration.Seconds() * float64(sampleRate) * 2)
	info := wavPCMInfo{
		audioFormat:   1,
		channels:      1,
		sampleRate:    uint32(sampleRate),
		byteRate:      uint32(sampleRate * 2),
		blockAlign:    2,
		bitsPerSample: 16,
	}
	pcm := make([]byte, pcmBytes)
	for index := 0; index+2 <= len(pcm); index += 2 {
		binary.LittleEndian.PutUint16(pcm[index:index+2], uint16(index))
	}
	return buildWAVPCM(info, pcm)
}
