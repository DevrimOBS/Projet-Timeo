import { ContainerSeverityData, OverviewData } from "../types";

interface Props {
  overview: OverviewData | null;
  containerSeverityData: ContainerSeverityData[];
  loading: boolean;
}

export default function Overview({ overview, containerSeverityData, loading }: Props) {
  const scansCount = overview?.scansCount ?? 0;
  const healthy = overview?.healthyContainers ?? 0;
  const vulnerable = overview?.vulnerableContainers ?? 0;
  const rawRisk = overview?.globalRiskScore ?? 0;
  const normalizedRisk = rawRisk > 10 ? rawRisk / 10 : rawRisk;
  const normalizedRiskClamped = Math.min(10, Math.max(0, normalizedRisk));

  const sortedContainerData = [...containerSeverityData].sort((a, b) => b.total - a.total);
  const chartData = sortedContainerData;
  const maxContainerTotal = Math.max(1, ...chartData.map((item) => item.total));

  const totalBySeverity = sortedContainerData.reduce(
    (acc, item) => {
      acc.critical += item.critical;
      acc.high += item.high;
      acc.medium += item.medium;
      acc.low += item.low;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 }
  );

  const totalCve = totalBySeverity.critical + totalBySeverity.high + totalBySeverity.medium + totalBySeverity.low;
  const totalContainers = healthy + vulnerable;
  const vulnerableRatio = totalContainers > 0 ? (vulnerable / totalContainers) * 100 : 0;
  const avgCvePerVulnerableContainer = vulnerable > 0 ? totalCve / vulnerable : 0;
  const mostExposedContainer = chartData[0] ?? null;
  const dominantSeverity = [
    { label: "Critique", value: totalBySeverity.critical },
    { label: "Haute", value: totalBySeverity.high },
    { label: "Moyenne", value: totalBySeverity.medium },
    { label: "Faible", value: totalBySeverity.low }
  ].sort((a, b) => b.value - a.value)[0];

  const criticalStop = totalCve > 0 ? (totalBySeverity.critical / totalCve) * 100 : 0;
  const highStop = totalCve > 0 ? criticalStop + (totalBySeverity.high / totalCve) * 100 : criticalStop;
  const mediumStop = totalCve > 0 ? highStop + (totalBySeverity.medium / totalCve) * 100 : highStop;

  const metricCards = [
    { label: "Scans exécutés", value: scansCount },
    { label: "Conteneurs sains", value: healthy },
    { label: "Conteneurs vulnérables", value: vulnerable },
    { label: "Risque global", value: `${normalizedRiskClamped.toFixed(1)} / 10` }
  ];

  return (
    <section className="panel dashboard-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Tableau de bord</p>
          <h2>Vue analytique</h2>
        </div>
      </div>

      <div className="metric-grid">
        {metricCards.map((card) => (
          <article key={card.label} className="metric-card glass-card">
            <div className="metric-top">
              <span>{card.label}</span>
            </div>
            <strong>{loading ? "..." : card.value}</strong>
          </article>
        ))}
      </div>

      <div className="analytics-grid">
        <article className="glass-card chart-card">
          <div className="section-heading">
            <h2>Exposition par conteneur</h2>
            <div className="chip-row">
              <span className="chip chip-active">{chartData.length} conteneurs</span>
            </div>
          </div>
          {loading ? (
            <p className="muted">Chargement du graphique…</p>
          ) : chartData.length === 0 ? (
            <p className="muted">Aucune donnée de conteneur disponible pour afficher la répartition des criticités.</p>
          ) : (
            <>
              <div className="bar-legend" aria-hidden="true">
                <span><i className="legend-dot legend-critical" />Critique</span>
                <span><i className="legend-dot legend-high" />Haute</span>
                <span><i className="legend-dot legend-medium" />Moyenne</span>
                <span><i className="legend-dot legend-low" />Faible</span>
              </div>

              <div className="bar-chart-scroll">
                <div className="bar-chart" role="img" aria-label="Nombre de vulnérabilités par criticité et par conteneur">
                {chartData.map((item) => (
                  <article key={item.containerId} className="bar-column">
                    <div className="stacked-track" aria-hidden="true">
                      <div
                        className="stacked-bar"
                        style={{ height: `${(item.total / maxContainerTotal) * 100}%` }}
                        title={`Critique: ${item.critical} | Haute: ${item.high} | Moyenne: ${item.medium} | Faible: ${item.low} | Total: ${item.total}`}
                      >
                        {item.low > 0 ? <span className="bar-segment bar-low" style={{ flexGrow: item.low }} /> : null}
                        {item.medium > 0 ? <span className="bar-segment bar-medium" style={{ flexGrow: item.medium }} /> : null}
                        {item.high > 0 ? <span className="bar-segment bar-high" style={{ flexGrow: item.high }} /> : null}
                        {item.critical > 0 ? <span className="bar-segment bar-critical" style={{ flexGrow: item.critical }} /> : null}
                      </div>
                    </div>
                    <p className="bar-container-name" title={item.name}>{item.name}</p>
                    <p className="bar-total">Total CVE: {item.total}</p>
                  </article>
                ))}
                </div>
              </div>
            </>
          )}
        </article>

        <article className="glass-card donut-card">
          <h2>CVE par criticité</h2>
          <div
            className="donut-ring"
            aria-hidden="true"
            style={{
              background: `conic-gradient(var(--critical) 0 ${criticalStop}%, var(--high) ${criticalStop}% ${highStop}%, var(--medium) ${highStop}% ${mediumStop}%, var(--low) ${mediumStop}% 100%)`
            }}
          />
          <p className="muted">Total CVE (tous conteneurs): {loading ? "..." : totalCve}</p>
          <div className="device-stats">
            <p><span>CVE CRITIQUE</span><strong>{loading ? "..." : totalBySeverity.critical}</strong></p>
            <p><span>CVE HAUTE</span><strong>{loading ? "..." : totalBySeverity.high}</strong></p>
            <p><span>CVE MOYENNE</span><strong>{loading ? "..." : totalBySeverity.medium}</strong></p>
            <p><span>CVE FAIBLE</span><strong>{loading ? "..." : totalBySeverity.low}</strong></p>
          </div>
        </article>
      </div>

      <div className="bottom-grid bottom-grid-single">
        <article className="glass-card">
          <h2>Indicateurs de scan</h2>
          <div className="matrix-list">
            <div className="matrix-row">
              <span>Conteneur le plus exposé</span>
              <strong>{loading ? "..." : mostExposedContainer ? `${mostExposedContainer.name} (${mostExposedContainer.total})` : "Aucun"}</strong>
            </div>
            <div className="matrix-row">
              <span>Taux de conteneurs vulnérables</span>
              <strong>{loading ? "..." : `${vulnerableRatio.toFixed(1)}%`}</strong>
            </div>
            <div className="matrix-row">
              <span>Moyenne CVE par conteneur vulnérable</span>
              <strong>{loading ? "..." : avgCvePerVulnerableContainer.toFixed(1)}</strong>
            </div>
            <div className="matrix-row">
              <span>Criticité dominante</span>
              <strong>{loading ? "..." : `${dominantSeverity.label} (${dominantSeverity.value})`}</strong>
            </div>
            <div className="matrix-row">
              <span>Risque global (pourcentage)</span>
              <strong>{loading ? "..." : `${(normalizedRiskClamped * 10).toFixed(1)}%`}</strong>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
