import { ContainerDetails, ContainerSummary } from "../types";

interface Props {
  containers: ContainerSummary[];
  details: ContainerDetails | null;
  loading: boolean;
  onSelect: (containerId: string) => void;
  selectedContainerId: string;
}

export default function Containers({ containers, details, loading, onSelect, selectedContainerId }: Props) {
  return (
    <section className="panel split-grid containers-grid">
      <div className="glass-card stack">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Conteneurs</p>
            <h2>Inspection ciblée</h2>
          </div>
          <span className="pill">{details?.historyCount ?? 0} occurrences</span>
        </div>

        <div className="chip-row">
          {containers.length === 0 ? (
            <p className="muted">Aucun conteneur disponible. Lance un scan pour alimenter le dashboard.</p>
          ) : null}

          {containers.map((container) => (
            <button
              key={container.containerId}
              className={`chip ${selectedContainerId === container.containerId ? "chip-active" : ""}`}
              onClick={() => onSelect(container.containerId)}
              type="button"
            >
              {container.name}
            </button>
          ))}
        </div>

        <div className="detail-list">
          {loading ? (
            <p className="muted">Chargement des détails…</p>
          ) : details ? (
            <>
              <div className="detail-row"><span>ID</span><strong>{details.containerId}</strong></div>
              <div className="detail-row"><span>Nom</span><strong>{details.name}</strong></div>
              <div className="detail-row"><span>Image</span><strong>{details.image}</strong></div>
              <div className="detail-row"><span>Statut</span><strong>{details.status}</strong></div>
              <div className="detail-row"><span>Dernier scan</span><strong>{new Date(details.latestScanFinishedAt).toLocaleString("fr-FR")}</strong></div>
            </>
          ) : (
            <p className="muted">Sélectionne un conteneur pour afficher ses vulnérabilités.</p>
          )}
        </div>
      </div>

      <div className="glass-card stack">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Failles</p>
            <h2>Détails CVE</h2>
          </div>
        </div>

        <div className="vuln-feed">
          {!details || details.vulnerabilities.length === 0 ? (
            <p className="muted">Aucune vulnérabilité remontée pour la sélection actuelle.</p>
          ) : (
            details.vulnerabilities.map((vuln, index) => (
              <article key={`${vuln.cve}-${vuln.package_name}-${index}`} className="vuln-card">
                <div className="vuln-top">
                  <strong>{vuln.cve}</strong>
                  <span className={`severity severity-${String(vuln.severity).toLowerCase()}`}>{vuln.severity}</span>
                </div>
                <p>{vuln.title ?? vuln.remediation ?? "Correctif recommandé par l’éditeur"}</p>
                <div className="meta-grid">
                  <span>Package: {vuln.package_name}</span>
                  <span>CVSS: {Number(vuln.cvss).toFixed(1)}</span>
                  <span>Fix: {vuln.fixed_version ?? "non précisé"}</span>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
