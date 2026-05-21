package transport

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"novisec-docker-auditor/agent/src/models"
)

type TaskActionPayload struct {
	ScanID  string `json:"scan_id,omitempty"`
	Status  string `json:"status"`
	Message string `json:"message,omitempty"`
}

func ClaimTask(ctx context.Context, endpoint, token string, timeout time.Duration, insecureSkipTLSVerify bool) (*models.ScanTask, error) {
	endpoint = strings.TrimSpace(endpoint)
	if endpoint == "" {
		return nil, nil
	}

	client := &http.Client{Timeout: timeout}
	if strings.HasPrefix(endpoint, "https://") {
		transport := &http.Transport{TLSClientConfig: &tls.Config{MinVersion: tls.VersionTLS13}}
		if insecureSkipTLSVerify {
			transport.TLSClientConfig.InsecureSkipVerify = true
		}
		client.Transport = transport
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, nil)
	if err != nil {
		return nil, err
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNoContent {
		return nil, nil
	}
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("task claim failed %s: %s", resp.Status, strings.TrimSpace(string(body)))
	}

	var task models.ScanTask
	if err := json.NewDecoder(resp.Body).Decode(&task); err != nil {
		if err == io.EOF {
			return nil, nil
		}
		return nil, err
	}

	if task.ID == "" {
		return nil, nil
	}

	return &task, nil
}

func CompleteTask(ctx context.Context, endpoint, token string, timeout time.Duration, insecureSkipTLSVerify bool, payload TaskActionPayload) error {
	endpoint = strings.TrimSpace(endpoint)
	if endpoint == "" {
		return nil
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	client := &http.Client{Timeout: timeout}
	if strings.HasPrefix(endpoint, "https://") {
		transport := &http.Transport{TLSClientConfig: &tls.Config{MinVersion: tls.VersionTLS13}}
		if insecureSkipTLSVerify {
			transport.TLSClientConfig.InsecureSkipVerify = true
		}
		client.Transport = transport
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		responseBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("task completion failed %s: %s", resp.Status, strings.TrimSpace(string(responseBody)))
	}

	return nil
}
