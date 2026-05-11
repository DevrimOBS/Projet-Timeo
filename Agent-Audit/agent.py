import subprocess
import json
import requests
import time
import os
import datetime
import shutil

try:
    import docker
except ImportError:
    docker = None

try:
    import schedule
except ImportError:
    class _SimpleSchedule:
        def __init__(self):
            self._jobs = []

        @property
        def every(self):
            return self

        def day(self):
            return self

        def at(self, time_str: str):
            self._at = time_str
            return self

        def do(self, job):
            self._jobs.append({"job": job, "at": getattr(self, "_at", None), "last_run": None})
            return job

        def run_pending(self):
            now = datetime.datetime.now()
            for entry in self._jobs:
                at = entry["at"]
                if not at:
                    continue
                try:
                    target_time = datetime.datetime.strptime(at, "%H:%M").time()
                except ValueError:
                    continue
                if now.time().hour == target_time.hour and now.time().minute == target_time.minute:
                    last_run = entry["last_run"]
                    if last_run is None or last_run.date() != now.date():
                        entry["job"]()
                        entry["last_run"] = now

    schedule = _SimpleSchedule()

# Configuration depuis les variables d'environnement
DASHBOARD_API_URL = os.getenv("DASHBOARD_API_URL", "https://backend:3000/api/scans")
API_TOKEN = os.getenv("API_TOKEN", "super-secret-token")
DASHBOARD_VERIFY_TLS = os.getenv("DASHBOARD_VERIFY_TLS", "true").lower() != "false"
DASHBOARD_CA_BUNDLE = os.getenv("DASHBOARD_CA_BUNDLE")
TARGET_NETWORK = os.getenv("TARGET_NETWORK") # Optionnel, pour filtrer sur un reseau precis

def get_docker_client():
    # Se connecte au socket Docker local (monté via docker-compose)
    if docker is None:
        raise RuntimeError("Le module docker n'est pas installe.")
    return docker.from_env()

def update_trivy_db():
    print("[+] Mise à jour de la base de vulnérabilités Trivy (NVD)...")
    if shutil.which("trivy") is None:
        print("[-] Trivy introuvable, mise a jour ignoree.")
        return
    subprocess.run(["trivy", "image", "--download-db-only"], check=False)

def scan_image(image_name):
    print(f"[+] Scan de l'image: {image_name}")
    if shutil.which("trivy") is None:
        print("[-] Trivy introuvable, scan ignore.")
        return None
    # Exécution de Trivy en ligne de commande pour scanner l'image
    result = subprocess.run(
        ["trivy", "image", "--format", "json", "--quiet", image_name],
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        print(f"[-] Erreur lors du scan de {image_name}")
        if result.stderr:
            print(result.stderr)
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
        verify = DASHBOARD_VERIFY_TLS
        if DASHBOARD_CA_BUNDLE:
            verify = DASHBOARD_CA_BUNDLE
        if DASHBOARD_API_URL.startswith("http://"):
            raise ValueError("L'URL de l'API doit imperativement utiliser HTTPS (exigence du CDC).")
        requests.post(DASHBOARD_API_URL, json=payload, headers=headers, verify=verify)
    except Exception as e:
        print(f"[-] Erreur lors de l'envoi au dashboard: {e}")

def run_audit():
    print("\n--- DÉBUT DE L'AUDIT DOCKER ---")
    update_trivy_db()
    try:
        client = get_docker_client()
    except Exception as e:
        print(f"[-] Docker indisponible: {e}")
        return
    
    filters = {}
    if TARGET_NETWORK:
        filters["network"] = TARGET_NETWORK
        print(f"[*] Filtrage sur le reseau: {TARGET_NETWORK}")
        
    containers = client.containers.list(all=True, filters=filters)
    
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