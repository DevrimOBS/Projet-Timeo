package models

import "time"

type Vulnerability struct {
	CVE              string   `json:"cve"`
	Package          string   `json:"package_name,omitempty"`
	InstalledVersion string   `json:"installed_version,omitempty"`
	FixedVersion     string   `json:"fixed_version,omitempty"`
	Severity         string   `json:"severity"`
	CVSS             float64  `json:"cvss"`
	CWE              []string `json:"cwe,omitempty"`
	Description      string   `json:"description,omitempty"`
	Remediation      string   `json:"remediation,omitempty"`
	Source           string   `json:"source,omitempty"`
}

type ContainerReport struct {
	ID                 string          `json:"id"`
	Name               string          `json:"name"`
	Image              string          `json:"image"`
	Status             string          `json:"status"`
	CreatedAt          time.Time       `json:"created_at,omitempty"`
	Vulnerabilities    []Vulnerability `json:"vulnerabilities,omitempty"`
	VulnerabilityCount int             `json:"vulnerability_count"`
	HighestCVSS        float64         `json:"highest_cvss"`
	RiskLevel          string          `json:"risk_level"`
}

type Summary struct {
	TotalContainers      int     `json:"total_containers"`
	HealthyContainers    int     `json:"healthy_containers"`
	VulnerableContainers int     `json:"vulnerable_containers"`
	TotalVulnerabilities int     `json:"total_vulnerabilities"`
	GlobalRiskScore      float64 `json:"global_risk_score"`
}

type ScanReport struct {
	AgentID    string            `json:"agent_id"`
	Timestamp  time.Time         `json:"timestamp"`
	ScanType   string            `json:"scan_type"`
	Containers []ContainerReport `json:"containers"`
	Summary    Summary           `json:"summary"`
}
