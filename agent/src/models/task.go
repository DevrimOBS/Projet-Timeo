package models

type ScanTask struct {
	ID           string   `json:"id"`
	Mode         string   `json:"mode"`
	Status       string   `json:"status"`
	ContainerIDs []string `json:"container_ids"`
	ScanID       string   `json:"scan_id,omitempty"`
	Message      string   `json:"message,omitempty"`
}
