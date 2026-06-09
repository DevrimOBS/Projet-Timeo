package scanner

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os/exec"
	"strings"
	"time"

	"novisec-docker-auditor/agent/src/models"
)

const (
	trivyMaxAttempts = 3
	trivyRetryDelay  = 2 * time.Second
)

type trivyReport struct {
	Results []trivyResult `json:"Results"`
}

type trivyResult struct {
	Target          string             `json:"Target"`
	Class           string             `json:"Class"`
	Type            string             `json:"Type"`
	Vulnerabilities []rawVulnerability `json:"Vulnerabilities"`
}

type rawVulnerability struct {
	VulnerabilityID  string                    `json:"VulnerabilityID"`
	PkgName          string                    `json:"PkgName"`
	InstalledVersion string                    `json:"InstalledVersion"`
	FixedVersion     string                    `json:"FixedVersion"`
	Severity         string                    `json:"Severity"`
	Title            string                    `json:"Title"`
	Description      string                    `json:"Description"`
	PrimaryURL       string                    `json:"PrimaryURL"`
	References       []string                  `json:"References"`
	CweIDs           []string                  `json:"CweIDs"`
	CVSS             map[string]trivyCVSSScore `json:"CVSS"`
}

type trivyCVSSScore struct {
	V2Score float64 `json:"V2Score"`
	V3Score float64 `json:"V3Score"`
}

func ScanImage(ctx context.Context, trivyPath, image string) ([]models.Vulnerability, error) {
	image = strings.TrimSpace(image)
	if image == "" {
		return nil, nil
	}

	binary := strings.TrimSpace(trivyPath)
	if binary == "" {
		binary = "trivy"
	}
	if _, err := exec.LookPath(binary); err != nil {
		return nil, fmt.Errorf("trivy binary not found: %w", err)
	}

	args := []string{"image", "--quiet", "--format", "json", "--no-progress", image}
	var lastErr error
	for attempt := 1; attempt <= trivyMaxAttempts; attempt++ {
		output, err := exec.CommandContext(ctx, binary, args...).CombinedOutput()
		if err != nil {
			message := strings.TrimSpace(string(output))
			if message == "" {
				message = err.Error()
			}
			lastErr = fmt.Errorf("trivy scan failed for %s (attempt %d/%d): %s", image, attempt, trivyMaxAttempts, message)

			if !isRetryableTrivyError(err, message) || attempt == trivyMaxAttempts {
				return nil, lastErr
			}

			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(trivyRetryDelay):
			}
			continue
		}

		var report trivyReport
		if err := json.Unmarshal(output, &report); err != nil {
			return nil, fmt.Errorf("invalid trivy json output for %s: %w", image, err)
		}

		findings := make([]rawVulnerability, 0)
		for _, result := range report.Results {
			findings = append(findings, result.Vulnerabilities...)
		}
		if len(findings) == 0 {
			return []models.Vulnerability{}, nil
		}

		return normalizeVulnerabilities(findings), nil
	}

	if lastErr != nil {
		return nil, lastErr
	}

	return nil, errors.New("trivy scan failed with unknown error")
}

// UpdateDB ensures the local Trivy vulnerability DB is up-to-date.
func UpdateDB(ctx context.Context, trivyPath string) error {
	binary := strings.TrimSpace(trivyPath)
	if binary == "" {
		binary = "trivy"
	}

	if _, err := exec.LookPath(binary); err != nil {
		return fmt.Errorf("trivy binary not found: %w", err)
	}

	var lastErr error
	for attempt := 1; attempt <= trivyMaxAttempts; attempt++ {
		cmd := exec.CommandContext(ctx, binary, "image", "--download-db-only", "--skip-java-db-update", "--no-progress")
		out, err := cmd.CombinedOutput()
		if err == nil {
			return nil
		}

		message := strings.TrimSpace(string(out))
		if message == "" {
			message = err.Error()
		}
		lastErr = fmt.Errorf("trivy db update failed (attempt %d/%d): %s", attempt, trivyMaxAttempts, message)

		if !isRetryableTrivyError(err, message) || attempt == trivyMaxAttempts {
			return lastErr
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(trivyRetryDelay):
		}
	}

	if lastErr != nil {
		return lastErr
	}

	return errors.New("trivy db update failed with unknown error")
}

func isRetryableTrivyError(err error, output string) bool {
	if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) {
		return false
	}

	msg := strings.ToLower(strings.TrimSpace(output))
	if msg == "" {
		msg = strings.ToLower(err.Error())
	}

	retryablePatterns := []string{
		"timeout",
		"i/o timeout",
		"temporarily unavailable",
		"connection reset",
		"tls handshake timeout",
		"rate limit",
		"too many requests",
		"eof",
		"connection refused",
		"service unavailable",
	}

	for _, pattern := range retryablePatterns {
		if strings.Contains(msg, pattern) {
			return true
		}
	}

	return false
}
