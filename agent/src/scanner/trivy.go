package scanner

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os/exec"
	"strings"

	"novisec-docker-auditor/agent/src/models"
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
		return []models.Vulnerability{}, nil
	}

	args := []string{"image", "--quiet", "--format", "json", "--no-progress", image}
	output, err := exec.CommandContext(ctx, binary, args...).Output()
	if err != nil {
		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) {
			stderr := strings.TrimSpace(string(exitErr.Stderr))
			if stderr != "" {
				return nil, fmt.Errorf("trivy scan failed for %s: %s", image, stderr)
			}
		}
		return nil, err
	}

	var report trivyReport
	if err := json.Unmarshal(output, &report); err != nil {
		return nil, err
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

// UpdateDB ensures the local Trivy vulnerability DB is up-to-date.
func UpdateDB(ctx context.Context, trivyPath string) error {
	binary := strings.TrimSpace(trivyPath)
	if binary == "" {
		binary = "trivy"
	}

	if _, err := exec.LookPath(binary); err != nil {
		// If trivy binary isn't available, nothing to update.
		return nil
	}

	cmd := exec.CommandContext(ctx, binary, "db", "update")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("trivy db update failed: %v: %s", err, strings.TrimSpace(string(out)))
	}
	return nil
}
