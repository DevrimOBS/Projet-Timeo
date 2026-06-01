package transport

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
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

	// If no token provided, try to fetch a JWT via /api/auth/login using env credentials
	if strings.TrimSpace(token) == "" {
		user := strings.TrimSpace(os.Getenv("AGENT_USER"))
		pass := strings.TrimSpace(os.Getenv("AGENT_PASSWORD"))
		if user != "" && pass != "" {
			// Determine login URL from API_URL env or derive from endpoint
			base := strings.TrimSpace(os.Getenv("API_URL"))
			if base == "" {
				if idx := strings.Index(endpoint, "/api/"); idx != -1 {
					base = endpoint[:idx]
				} else {
					base = endpoint
				}
			}
			loginURL := strings.TrimRight(base, "/") + "/api/auth/login"
			if tkn, err := fetchAuthToken(ctx, loginURL, user, pass, timeout, insecureSkipTLSVerify); err == nil && tkn != "" {
				token = tkn
			}
		}
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

func fetchAuthToken(ctx context.Context, loginURL, user, pass string, timeout time.Duration, insecureSkipTLSVerify bool) (string, error) {
	payload := map[string]string{"username": user, "password": pass}
	body, _ := json.Marshal(payload)

	client := &http.Client{Timeout: timeout}
	if strings.HasPrefix(loginURL, "https://") {
		transport := &http.Transport{TLSClientConfig: &tls.Config{MinVersion: tls.VersionTLS13}}
		if insecureSkipTLSVerify {
			transport.TLSClientConfig.InsecureSkipVerify = true
		}
		client.Transport = transport
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, loginURL, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		b, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("auth login failed: %s: %s", resp.Status, strings.TrimSpace(string(b)))
	}

	// Use a map as structure keys may differ in casing
	var out map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", err
	}
	if tok, ok := out["token"].(string); ok {
		return tok, nil
	}
	if tok, ok := out["accessToken"].(string); ok {
		return tok, nil
	}
	return "", fmt.Errorf("token not found in auth response")
}
