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

func SendReport(ctx context.Context, endpoint string, report models.ScanReport, token string, timeout time.Duration, insecureSkipTLSVerify bool) (string, error) {
	endpoint = strings.TrimSpace(endpoint)
	if endpoint == "" {
		return "", fmt.Errorf("report endpoint is required")
	}

	payload, err := json.Marshal(report)
	if err != nil {
		return "", err
	}

	client := &http.Client{Timeout: timeout}
	if strings.HasPrefix(endpoint, "https://") {
		transport := &http.Transport{TLSClientConfig: &tls.Config{MinVersion: tls.VersionTLS13}}
		if insecureSkipTLSVerify {
			transport.TLSClientConfig.InsecureSkipVerify = true
		}
		client.Transport = transport
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("api returned %s: %s", resp.Status, strings.TrimSpace(string(body)))
	}

	var response struct {
		ScanID string `json:"scanId"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return "", err
	}

	return response.ScanID, nil
}
