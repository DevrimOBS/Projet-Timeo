package scanner

import (
	"strings"

	"novisec-docker-auditor/agent/src/models"
)

func severityFromScore(score float64) string {
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
		return "INCONNU"
	}
}

func scoreFromSeverity(severity string) float64 {
	switch strings.ToUpper(strings.TrimSpace(severity)) {
	case "CRITICAL", "CRITIQUE":
		return 9.8
	case "HIGH", "HAUT":
		return 8.0
	case "MEDIUM", "MOYEN":
		return 5.0
	case "LOW", "FAIBLE":
		return 2.0
	default:
		return 0
	}
}

func riskFromHighestScore(score float64) string {
	return severityFromScore(score)
}

func normalizeRemediation(finding rawVulnerability) string {
	if finding.FixedVersion != "" && finding.PkgName != "" {
		return "Mettre à jour " + finding.PkgName + " vers la version " + finding.FixedVersion
	}
	if finding.FixedVersion != "" {
		return "Mettre à jour vers la version " + finding.FixedVersion
	}
	if finding.PkgName != "" {
		return "Vérifier la mise à jour de " + finding.PkgName
	}
	return "Appliquer le correctif recommandé par l'éditeur"
}

func normalizeFinding(finding rawVulnerability) models.Vulnerability {
	score := scoreFromFinding(finding)
	severity := strings.ToUpper(strings.TrimSpace(finding.Severity))
	if severity == "" {
		severity = severityFromScore(score)
	}
	return models.Vulnerability{
		CVE:              finding.VulnerabilityID,
		Package:          finding.PkgName,
		InstalledVersion: finding.InstalledVersion,
		FixedVersion:     finding.FixedVersion,
		Severity:         severity,
		CVSS:             score,
		CWE:              append([]string(nil), finding.CweIDs...),
		Description:      strings.TrimSpace(finding.Description),
		Remediation:      normalizeRemediation(finding),
		Source:           strings.TrimSpace(finding.PrimaryURL),
	}
}

func scoreFromFinding(finding rawVulnerability) float64 {
	if finding.CVSS != nil {
		if source, ok := finding.CVSS["NVD"]; ok && source.V3Score > 0 {
			return source.V3Score
		}
		for _, source := range finding.CVSS {
			if source.V3Score > 0 {
				return source.V3Score
			}
			if source.V2Score > 0 {
				return source.V2Score
			}
		}
	}
	return scoreFromSeverity(finding.Severity)
}

func normalizeVulnerabilities(findings []rawVulnerability) []models.Vulnerability {
	result := make([]models.Vulnerability, 0, len(findings))
	seen := make(map[string]struct{})
	for _, finding := range findings {
		vulnerability := normalizeFinding(finding)
		key := vulnerability.CVE + "|" + vulnerability.Package
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, vulnerability)
	}
	return result
}
