package config

import (
	"bufio"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	AgentID               string
	APIURL                string
	APIToken              string
	AgentUser             string
	AgentPassword         string
	DockerSocket          string
	TrivyPath             string
	TrivyEnabled          bool
	ScanType              string
	RequestTimeout        time.Duration
	ScanTimeout           time.Duration
	InsecureSkipTLSVerify bool
	APICACertFile         string
	ConfigFile            string
}

func Load() (Config, error) {
	cfg := Config{
		AgentID:        "novisec-agent-001",
		APIURL:         "https://api:3002",
		DockerSocket:   "/var/run/docker.sock",
		TrivyPath:      "trivy",
		TrivyEnabled:   true,
		ScanType:       "MANUAL_GLOBAL",
		RequestTimeout: 30 * time.Second,
		ScanTimeout:    15 * time.Minute,
	}

	for _, candidate := range candidateConfigFiles() {
		if _, err := os.Stat(candidate); err == nil {
			values, err := readKeyValueFile(candidate)
			if err != nil {
				return Config{}, err
			}
			applyValues(&cfg, values)
			cfg.ConfigFile = candidate
			break
		}
	}

	applyEnv(&cfg)
	if err := cfg.Validate(); err != nil {
		return Config{}, err
	}

	if cfg.ConfigFile == "" {
		cfg.ConfigFile = filepath.Join("configs", "agent.example.yaml")
	}

	return cfg, nil
}

func (c Config) Validate() error {
	if strings.TrimSpace(c.AgentID) == "" {
		return errors.New("agent id is required")
	}
	if strings.TrimSpace(c.APIURL) == "" {
		return errors.New("api url is required")
	}
	if strings.TrimSpace(c.DockerSocket) == "" {
		return errors.New("docker socket path is required")
	}
	return nil
}

func (c Config) Endpoint() string {
	trimmed := strings.TrimSpace(c.APIURL)
	if trimmed == "" {
		return ""
	}
	if strings.Contains(trimmed, "/api/") {
		return trimmed
	}
	if strings.HasSuffix(trimmed, "/") {
		return trimmed + "api/scans"
	}
	return trimmed + "/api/scans"
}

func (c Config) TaskClaimEndpoint() string {
	trimmed := strings.TrimSpace(c.APIURL)
	if trimmed == "" {
		return ""
	}
	return strings.TrimRight(trimmed, "/") + "/api/scan-tasks/claim"
}

func (c Config) TaskCompleteEndpoint(taskID string) string {
	trimmed := strings.TrimSpace(c.APIURL)
	taskID = strings.TrimSpace(taskID)
	if trimmed == "" || taskID == "" {
		return ""
	}
	return strings.TrimRight(trimmed, "/") + "/api/scan-tasks/" + taskID + "/complete"
}

func candidateConfigFiles() []string {
	return []string{
		os.Getenv("AGENT_CONFIG_FILE"),
		filepath.Join("configs", "agent.yaml"),
		filepath.Join("configs", "agent.example.yaml"),
	}
}

func readKeyValueFile(path string) (map[string]string, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	values := make(map[string]string)
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])
		value = strings.Trim(value, `"'`)
		values[strings.ToLower(key)] = value
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	return values, nil
}

func applyValues(cfg *Config, values map[string]string) {
	if v, ok := values["agentid"]; ok && v != "" {
		cfg.AgentID = v
	}
	if v, ok := values["apiurl"]; ok && v != "" {
		cfg.APIURL = v
	}
	if v, ok := values["apitoken"]; ok && v != "" {
		cfg.APIToken = v
	}
	if v, ok := values["dockersocket"]; ok && v != "" {
		cfg.DockerSocket = v
	}
	if v, ok := values["trivypath"]; ok && v != "" {
		cfg.TrivyPath = v
	}
	if v, ok := values["trivyenabled"]; ok && v != "" {
		if parsed, err := strconv.ParseBool(v); err == nil {
			cfg.TrivyEnabled = parsed
		}
	}
	if v, ok := values["agentuser"]; ok && v != "" {
		cfg.AgentUser = v
	}
	if v, ok := values["agentpassword"]; ok && v != "" {
		cfg.AgentPassword = v
	}
	if v, ok := values["scantype"]; ok && v != "" {
		cfg.ScanType = v
	}
	if v, ok := values["requesttimeout"]; ok && v != "" {
		if parsed, err := time.ParseDuration(v); err == nil {
			cfg.RequestTimeout = parsed
		}
	}
	if v, ok := values["scantimeout"]; ok && v != "" {
		if parsed, err := time.ParseDuration(v); err == nil {
			cfg.ScanTimeout = parsed
		}
	}
	if v, ok := values["insecureskiptlsverify"]; ok && v != "" {
		if parsed, err := strconv.ParseBool(v); err == nil {
			cfg.InsecureSkipTLSVerify = parsed
		}
	}
	if v, ok := values["apicacertfile"]; ok && v != "" {
		cfg.APICACertFile = v
	}
}

func applyEnv(cfg *Config) {
	if v := strings.TrimSpace(os.Getenv("AGENT_ID")); v != "" {
		cfg.AgentID = v
	}
	if v := strings.TrimSpace(os.Getenv("AGENT_API_URL")); v != "" {
		cfg.APIURL = v
	}
	if v := strings.TrimSpace(os.Getenv("API_URL")); v != "" {
		cfg.APIURL = v
	}
	if v := strings.TrimSpace(os.Getenv("API_TOKEN")); v != "" {
		cfg.APIToken = v
	}
	if v := strings.TrimSpace(os.Getenv("AGENT_USER")); v != "" {
		cfg.AgentUser = v
	}
	if v := strings.TrimSpace(os.Getenv("AGENT_PASSWORD")); v != "" {
		cfg.AgentPassword = v
	}
	if v := strings.TrimSpace(os.Getenv("DOCKER_SOCKET")); v != "" {
		cfg.DockerSocket = v
	}
	if v := strings.TrimSpace(os.Getenv("TRIVY_PATH")); v != "" {
		cfg.TrivyPath = v
	}
	if v := strings.TrimSpace(os.Getenv("TRIVY_ENABLED")); v != "" {
		if parsed, err := strconv.ParseBool(v); err == nil {
			cfg.TrivyEnabled = parsed
		}
	}
	if v := strings.TrimSpace(os.Getenv("SCAN_TYPE")); v != "" {
		cfg.ScanType = v
	}
	if v := strings.TrimSpace(os.Getenv("REQUEST_TIMEOUT")); v != "" {
		if parsed, err := time.ParseDuration(v); err == nil {
			cfg.RequestTimeout = parsed
		}
	}
	if v := strings.TrimSpace(os.Getenv("SCAN_TIMEOUT")); v != "" {
		if parsed, err := time.ParseDuration(v); err == nil {
			cfg.ScanTimeout = parsed
		}
	}
	if v := strings.TrimSpace(os.Getenv("INSECURE_SKIP_TLS_VERIFY")); v != "" {
		if parsed, err := strconv.ParseBool(v); err == nil {
			cfg.InsecureSkipTLSVerify = parsed
		}
	}
	if v := strings.TrimSpace(os.Getenv("API_CA_CERT_FILE")); v != "" {
		cfg.APICACertFile = v
	}
}

func (c Config) String() string {
	return fmt.Sprintf("agent=%s api=%s scan=%s", c.AgentID, c.APIURL, c.ScanType)
}
