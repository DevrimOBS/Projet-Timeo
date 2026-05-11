import docker
import subprocess
import json
import requests
import schedule
import time
import os

# Configuration depuis les variables d'environnement
DASHBOARD_API_URL = os.getenv("DASHBOARD_API_URL", "http://backend:3000/api/scans")
API_TOKEN = os.getenv("API_TOKEN", "super-secret-token")

def get_docker_client():
    # Se connecte au socket Docker local (monté via docker-compose)
    return docker.from_env()

def update_trivy_db():
    print("[+] Mise à jour de la base de vulnérabilités Trivy (NVD)...")
    subprocess.run(["trivy", "image", "--download-db-only"], check=False)

def scan_image(image_name):
    print(f"[+] Scan de l'image: {image_name}")
    # Exécution de Trivy en ligne de commande pour scanner l'image
    result = subprocess.run(
        ["trivy", "image", "--format", "json", "--quiet", image_name],
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        print(f"[-] Erreur lors du scan de {image_name}")
        return None
    
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return None

def send_results_to_dashboard(container_id, container_name, image_name, scan_results):
    print(f"[+] Envoi des résultats pour {container_name} au Dashboard...")
    payload = {
        "container_id": container_id,
        "container_name": container_name,
        "image_name": image_name,
        "vulnerabilities": scan_results,
        "timestamp": time.time()
    }
    headers = {
        "Authorization": f"Bearer {API_TOKEN}",
        "Content-Type": "application/json"
    }
    try:
        # En production, utiliser https (TLS 1.3) avec verify=True
        requests.post(DASHBOARD_API_URL, json=payload, headers=headers, verify=False)
    except Exception as e:
        print(f"[-] Erreur lors de l'envoi au dashboard: {e}")

def run_audit():
    print("\n--- DÉBUT DE L'AUDIT DOCKER ---")
    update_trivy_db()
    
    client = get_docker_client()
    containers = client.containers.list()
    
    for container in containers:
        container_name = container.name
        image_name = container.image.tags[0] if container.image.tags else container.image.id
        
        scan_results = scan_image(image_name)
        if scan_results:
            send_results_to_dashboard(container.id, container_name, image_name, scan_results)
            
    print("--- FIN DE L'AUDIT DOCKER ---\n")

if __name__ == "__main__":
    print("Démarrage de l'agent NoviSec Docker Auditor...")
    
    # Premier scan au démarrage
    run_audit()
    
    # Programmation selon le CDC (Analyse automatique / CRON)
    # Ici, configuré pour scanner tous les jours à minuit par exemple
    schedule.every().day.at("00:00").do(run_audit)
    
    while True:
        schedule.run_pending()
        time.sleep(60)