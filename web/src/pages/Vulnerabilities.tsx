import { ContainerSeverityData, MatrixData } from "../types";

interface Props {
  matrix: MatrixData | null;
  containerSeverityData: ContainerSeverityData[];
  loading: boolean;
}

export default function Vulnerabilities({ matrix, containerSeverityData, loading }: Props) {
  const critical = matrix?.critical ?? 0;
  const high = matrix?.high ?? 0;
  const medium = matrix?.medium ?? 0;
  const low = matrix?.low ?? 0;
  const total = critical + high + medium + low;
  const totalContainers = containerSeverityData.length;
  const vulnerableContainers = containerSeverityData.filter((item) => item.total > 0).length;
  const containersWithCritical = containerSeverityData.filter((item) => item.critical > 0).length;
  const avgByVulnerableContainer = vulnerableContainers > 0 ? total / vulnerableContainers : 0;
  const topExposedContainers = [...containerSeverityData].sort((a, b) => b.total - a.total).slice(0, 6);

  const rows = [
    { label: "Critique", value: critical, tone: "severity-critical" },
    { label: "Haut", value: high, tone: "severity-high" },
    { label: "Moyen", value: medium, tone: "severity-medium" },
    { label: "Faible", value: low, tone: "severity-low" }
  ];

  const keyFigures = [
    { label: "Total CVE", value: total.toString() },
    { label: "Critiques", value: `${total > 0 ? ((critical / total) * 100).toFixed(1) : "0.0"}%` },
    { label: "Conteneurs avec critical", value: `${containersWithCritical}/${totalContainers}` },
    { label: "Moyenne CVE / conteneur vulnerable", value: avgByVulnerableContainer.toFixed(1) }
  ];

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Matrice</p>
          <h2>Répartition des vulnérabilités</h2>
        </div>
      </div>

      <div className="severity-grid">
        {keyFigures.map((item) => (
          <article key={item.label} className="glass-card severity-card">
            <span className="muted">{item.label}</span>
            <strong>{loading ? "..." : item.value}</strong>
          </article>
        ))}
      </div>

      <div className="severity-grid">
        {rows.map((row) => (
          <article key={row.label} className="glass-card severity-card">
            <span className={`severity ${row.tone}`}>{row.label}</span>
            <strong>{loading ? "..." : row.value}</strong>
            <p className="muted">
              {loading
                ? "..."
                : `${total > 0 ? ((row.value / total) * 100).toFixed(1) : "0.0"}% du total`}
            </p>
          </article>
        ))}
      </div>

      <article className="glass-card chart-card">
        <div className="section-heading">
          <h2>Conteneurs les plus exposés</h2>
          <span className="pill">Top {topExposedContainers.length}</span>
        </div>

        {loading ? (
          <p className="muted">Chargement des conteneurs...</p>
        ) : topExposedContainers.length === 0 ? (
          <p className="muted">Aucun conteneur vulnérable détecté.</p>
        ) : (
          <div className="stack">
            {topExposedContainers.map((container) => {
              const share = total > 0 ? (container.total / total) * 100 : 0;
              const c = container.total > 0 ? (container.critical / container.total) * 100 : 0;
              const h = container.total > 0 ? (container.high / container.total) * 100 : 0;
              const m = container.total > 0 ? (container.medium / container.total) * 100 : 0;
              const l = Math.max(0, 100 - c - h - m);

              return (
                <div key={container.containerId} className="vuln-container-row">
                  <div className="vuln-container-head">
                    <strong title={container.name}>{container.name}</strong>
                    <span className="muted">{container.total} CVE ({share.toFixed(1)}% du parc)</span>
                  </div>
                  <div className="vuln-composition" aria-hidden="true">
                    <span className="comp-critical" style={{ width: `${c}%` }} />
                    <span className="comp-high" style={{ width: `${h}%` }} />
                    <span className="comp-medium" style={{ width: `${m}%` }} />
                    <span className="comp-low" style={{ width: `${l}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </article>
    </section>
  );
}
