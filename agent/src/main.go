package main

import (
	"context"
	"log"
	"strings"
	"time"

	"novisec-docker-auditor/agent/src/config"
	dockerclient "novisec-docker-auditor/agent/src/docker"
	"novisec-docker-auditor/agent/src/models"
	"novisec-docker-auditor/agent/src/scanner"
	"novisec-docker-auditor/agent/src/transport"
)

func main() {
	cfg, loadErr := config.Load()
	if loadErr != nil {
		log.Fatalf("configuration error: %v", loadErr)
	}

	ctx, cancel := context.WithTimeout(context.Background(), cfg.ScanTimeout)
	defer cancel()

	// Ensure Trivy DB is updated before running scans when enabled
	if cfg.TrivyEnabled {
		if err := scanner.UpdateDB(ctx, cfg.TrivyPath); err != nil {
			log.Printf("trivy db update warning: %v", err)
		} else {
			log.Printf("trivy DB updated")
		}
	}

	// Try to claim a task with retry/backoff until context deadline
	var task *models.ScanTask
	var err error
	backoff := 1 * time.Second
claimLoop:
	for {
		task, err = transport.ClaimTask(ctx, cfg.TaskClaimEndpoint(), cfg.APIToken, cfg.RequestTimeout, cfg.InsecureSkipTLSVerify, cfg.APICACertFile)
		if err == nil {
			break
		}
		log.Printf("task claim error: %v", err)
		select {
		case <-ctx.Done():
			log.Printf("giving up task claim: %v", ctx.Err())
			break claimLoop
		case <-time.After(backoff):
			if backoff < 8*time.Second {
				backoff *= 2
			}
		}
	}

	// Discover Docker containers with retry/backoff (handle transient permission/DNS issues)
	var containers []dockerclient.Container
	backoff = 1 * time.Second
	for {
		containers, err = dockerclient.Discover(ctx, cfg.DockerSocket)
		if err == nil {
			break
		}
		log.Printf("docker discovery error: %v", err)
		select {
		case <-ctx.Done():
			log.Fatalf("docker discovery giving up: %v", ctx.Err())
		case <-time.After(backoff):
			if backoff < 8*time.Second {
				backoff *= 2
			}
		}
	}

	scanType := cfg.ScanType
	if task != nil {
		if task.Mode != "" {
			scanType = task.Mode
		}
		containers = filterContainers(containers, task.ContainerIDs)
	}

	imageFindings := make(map[string][]models.Vulnerability)
	reports := make([]models.ContainerReport, 0, len(containers))
	for _, container := range containers {
		imageRef := container.ReferenceImage()
		findings, ok := imageFindings[imageRef]
		if !ok {
			if cfg.TrivyEnabled {
				findings, err = scanner.ScanImage(ctx, cfg.TrivyPath, imageRef)
				if err != nil {
					log.Printf("scan error for %s: %v", imageRef, err)
					findings = []models.Vulnerability{}
				}
			} else {
				findings = []models.Vulnerability{}
			}
			imageFindings[imageRef] = findings
		}

		highestScore := highestCVSS(findings)
		reports = append(reports, models.ContainerReport{
			ID:                 container.ID,
			Name:               container.DisplayName(),
			Image:              imageRef,
			Status:             container.Status,
			CreatedAt:          time.Unix(container.Created, 0).UTC(),
			Vulnerabilities:    findings,
			VulnerabilityCount: len(findings),
			HighestCVSS:        highestScore,
			RiskLevel:          riskLevel(highestScore),
		})
	}

	report := models.ScanReport{
		AgentID:    cfg.AgentID,
		Timestamp:  time.Now().UTC(),
		ScanType:   scanType,
		Containers: reports,
		Summary:    summarize(reports),
	}

	scanID, err := transport.SendReport(ctx, cfg.Endpoint(), report, cfg.APIToken, cfg.RequestTimeout, cfg.InsecureSkipTLSVerify, cfg.APICACertFile)
	if err != nil {
		log.Fatalf("report send error: %v", err)
	}

	if task != nil {
		if err := transport.CompleteTask(ctx, cfg.TaskCompleteEndpoint(task.ID), cfg.APIToken, cfg.RequestTimeout, cfg.InsecureSkipTLSVerify, cfg.APICACertFile, transport.TaskActionPayload{ScanID: scanID, Status: "completed"}); err != nil {
			log.Printf("task completion error: %v", err)
		}
	}

	log.Printf("scan completed: %d containers, %d vulnerabilities, avg risk %.2f", len(report.Containers), report.Summary.TotalVulnerabilities, report.Summary.GlobalRiskScore)
}

func highestCVSS(findings []models.Vulnerability) float64 {
	highest := 0.0
	for _, finding := range findings {
		if finding.CVSS > highest {
			highest = finding.CVSS
		}
	}
	return highest
}

func riskLevel(score float64) string {
	switch {
	case score >= 9.0:
		return "CRITIQUE"
	case score >= 7.0:
		return "HAUT"
	case score >= 4.0:
		return "MOYEN"
	case score > 0:
		return "FAIBLE"
	default:
		return "SAIN"
	}
}

func summarize(containers []models.ContainerReport) models.Summary {
	summary := models.Summary{TotalContainers: len(containers)}
	var totalRisk float64
	for _, container := range containers {
		if container.VulnerabilityCount == 0 {
			summary.HealthyContainers++
		} else {
			summary.VulnerableContainers++
		}
		summary.TotalVulnerabilities += container.VulnerabilityCount
		totalRisk += container.HighestCVSS
	}
	if len(containers) > 0 {
		summary.GlobalRiskScore = totalRisk / float64(len(containers))
	}
	return summary
}

func filterContainers(containers []dockerclient.Container, containerIDs []string) []dockerclient.Container {
	if len(containerIDs) == 0 {
		return containers
	}

	allowed := make(map[string]struct{}, len(containerIDs))
	for _, id := range containerIDs {
		trimmed := strings.TrimSpace(id)
		if trimmed != "" {
			allowed[trimmed] = struct{}{}
		}
	}

	filtered := make([]dockerclient.Container, 0, len(containers))
	for _, container := range containers {
		if _, ok := allowed[container.ID]; ok {
			filtered = append(filtered, container)
		}
	}

	return filtered
}
