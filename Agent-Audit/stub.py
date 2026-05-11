import docker, time, os
import requests
client = docker.from_env()
containers = client.containers.list()

fake_scan = {
    "timestamp": time.time(),
    "agent_id": "stub-localhost",
    "containers": [{"id": c.id, "name": c.name, "image": c.image.tags[0] if c.image.tags else "untagged"} for c in containers],
    "vulnerabilities": [
        {"id": "CVE-2021-1234", "severity": "HIGH", "cvss": 7.5, "description": "Example vulnerability in image."},
        {"id": "CVE-2021-5678", "severity": "MEDIUM", "cvss": 5.0, "description": "Another example vulnerability."}
    ]
}
requests.post("http://localhost:8000/api/scan", json=fake_scan)
print("Fake scan data sent to API.")