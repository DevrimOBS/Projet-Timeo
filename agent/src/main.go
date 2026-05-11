package main

import (
	"bytes"
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"
)

type ContainerInfo struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Image  string `json:"image"`
	Status string `json:"status"`
}
type ScanResult struct {
	AgentID    string          `json:"agent_id"`
	Timestamp  string          `json:"timestamp"`
	Containers []ContainerInfo `json:"containers"`
}

func listContainers(ctx context.Context) ([]ContainerInfo, error) {
	_ = ctx
	return []ContainerInfo{}, nil
}

func main() {
	ctx := context.Background()
	dashboardURL := os.Getenv("DASHBOARD_URL")
	if dashboardURL == "" {
		dashboardURL = "http://localhost:8080/api/scan-results"
	}
	agentID := os.Getenv("AGENT_ID")
	if agentID == "" {
		agentID = "novisec-agent-001"
	}
	containers, err := listContainers(ctx)
	if err != nil {
		log.Fatalf("Error listing containers: %v", err)
	}
	report := ScanResult{
		AgentID:    agentID,
		Timestamp:  time.Now().Format(time.RFC3339),
		Containers: make([]ContainerInfo, 0, len(containers)),
	}
	for _, c := range containers {
		report.Containers = append(report.Containers, ContainerInfo{
			ID:     c.ID,
			Name:   c.Name,
			Image:  c.Image,
			Status: c.Status,
		})
	}
	body, err := json.Marshal(report)
	if err != nil {
		log.Fatalf("Error marshaling report: %v", err)
	}
	req, err := http.NewRequest("POST", dashboardURL, bytes.NewBuffer(body))
	if err != nil {
		log.Fatalf("Error creating HTTP request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Fatalf("Error sending report: %v", err)
	}
	defer resp.Body.Close()
	log.Printf("scan envoyé, status: %s", resp.Status)
}
