package main

import (
	"context"
	"log"
	"time"

	"novisec-docker-auditor/agent/src/config"
	dockerclient "novisec-docker-auditor/agent/src/docker"
	"novisec-docker-auditor/agent/src/models"
	"novisec-docker-auditor/agent/src/scanner"
	"novisec-docker-auditor/agent/src/transport"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("configuration error: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), cfg.ScanTimeout)
	defer cancel()

	containers, err := dockerclient.Discover(ctx, cfg.DockerSocket)
	if err != nil {
		log.Fatalf("docker discovery error: %v", err)
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
		ScanType:   cfg.ScanType,
		Containers: reports,
		Summary:    summarize(reports),
	}

	if err := transport.SendReport(ctx, cfg.Endpoint(), report, cfg.APIToken, cfg.RequestTimeout, cfg.InsecureSkipTLSVerify); err != nil {
		log.Fatalf("report send error: %v", err)
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
