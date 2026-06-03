import { ContainerSeverityData, MatrixData, OverviewData } from "../types";

interface Props {
  overview: OverviewData | null;
  matrix: MatrixData | null;
  containerSeverityData: ContainerSeverityData[];
  loading: boolean;
}

export default function Overview({ overview, matrix, containerSeverityData, loading }: Props) {
  const scansCount = overview?.scansCount ?? 0;
  const healthy = overview?.healthyContainers ?? 0;
  const vulnerable = overview?.vulnerableContainers ?? 0;
  const risk = overview?.globalRiskScore ?? 0;

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

  const criticalStop = totalCve > 0 ? (totalBySeverity.critical / totalCve) * 100 : 0;
  const highStop = totalCve > 0 ? criticalStop + (totalBySeverity.high / totalCve) * 100 : criticalStop;
  const mediumStop = totalCve > 0 ? highStop + (totalBySeverity.medium / totalCve) * 100 : highStop;

  const severityRows = [
    { key: "critical", label: "Critique", value: matrix?.critical ?? 0 },
    { key: "high", label: "Haute", value: matrix?.high ?? 0 },
    { key: "medium", label: "Moyenne", value: matrix?.medium ?? 0 },
    { key: "low", label: "Faible", value: matrix?.low ?? 0 }
  ];

  const metricCards = [
    { label: "Users", value: healthy, delta: "+12.4%" },
    { label: "Sessions", value: scansCount, delta: "-7.2%" },
    { label: "Vulnerable", value: vulnerable, delta: "+3.8%" },
    { label: "Risk", value: `${risk.toFixed(1)} / 10`, delta: "+2.1%" }
  ];

  return (
    <section className="panel dashboard-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Dashboards</p>
          <h2>Analytics</h2>
        </div>
      </div>

      <div className="metric-grid">
        {metricCards.map((card) => (
          <article key={card.label} className="metric-card glass-card">
            <div className="metric-top">
              <span>{card.label}</span>
              <small>{card.delta}</small>
            </div>
            <strong>{loading ? "..." : card.value}</strong>
            <div className="sparkline" aria-hidden="true" />
          </article>
        ))}
      </div>

      <div className="analytics-grid">
        <article className="glass-card chart-card">
          <div className="section-heading">
            <h2>Sessions</h2>
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
                <span><i className="legend-dot legend-critical" />Critical</span>
                <span><i className="legend-dot legend-high" />High</span>
                <span><i className="legend-dot legend-medium" />Medium</span>
                <span><i className="legend-dot legend-low" />Low</span>
              </div>

              <div className="bar-chart-scroll">
                <div className="bar-chart" role="img" aria-label="Nombre de vulnérabilités par criticité et par conteneur">
                {chartData.map((item) => (
                  <article key={item.containerId} className="bar-column">
                    <div className="stacked-track" aria-hidden="true">
                      <div
                        className="stacked-bar"
                        style={{ height: `${(item.total / maxContainerTotal) * 100}%` }}
                        title={`Critical: ${item.critical} | High: ${item.high} | Medium: ${item.medium} | Low: ${item.low} | Total: ${item.total}`}
                      >
                        {item.low > 0 ? <span className="bar-segment bar-low" style={{ flexGrow: item.low }} /> : null}
                        {item.medium > 0 ? <span className="bar-segment bar-medium" style={{ flexGrow: item.medium }} /> : null}
                        {item.high > 0 ? <span className="bar-segment bar-high" style={{ flexGrow: item.high }} /> : null}
                        {item.critical > 0 ? <span className="bar-segment bar-critical" style={{ flexGrow: item.critical }} /> : null}
                      </div>
                    </div>
                    <p className="bar-container-name" title={item.name}>{item.name}</p>
                    <p className="bar-total">Total: {item.total}</p>
                  </article>
                ))}
                </div>
              </div>
            </>
          )}
        </article>

        <article className="glass-card donut-card">
          <h2>CVE by severity</h2>
          <div
            className="donut-ring"
            aria-hidden="true"
            style={{
              background: `conic-gradient(var(--critical) 0 ${criticalStop}%, var(--high) ${criticalStop}% ${highStop}%, var(--medium) ${highStop}% ${mediumStop}%, var(--low) ${mediumStop}% 100%)`
            }}
          />
          <p className="muted">Total CVE (tous conteneurs): {loading ? "..." : totalCve}</p>
          <div className="device-stats">
            <p><span>CVE CRITICAL</span><strong>{loading ? "..." : totalBySeverity.critical}</strong></p>
            <p><span>CVE HIGH</span><strong>{loading ? "..." : totalBySeverity.high}</strong></p>
            <p><span>CVE MEDIUM</span><strong>{loading ? "..." : totalBySeverity.medium}</strong></p>
            <p><span>CVE LOW</span><strong>{loading ? "..." : totalBySeverity.low}</strong></p>
          </div>
        </article>
      </div>

      <div className="bottom-grid">
        <article className="glass-card">
          <h2>Top referrals</h2>
          <div className="matrix-list">
            <div className="matrix-row"><span>GitHub</span><strong>19,291</strong></div>
            <div className="matrix-row"><span>Stack Overflow</span><strong>11,201</strong></div>
            <div className="matrix-row"><span>Hacker News</span><strong>9,291</strong></div>
            <div className="matrix-row"><span>TechCrunch</span><strong>6,218</strong></div>
          </div>
        </article>

        <article className="glass-card">
          <h2>Goals overview</h2>
          <div className="matrix-list">
            {severityRows.map((item) => (
              <div key={item.key} className="matrix-row">
                <span>{item.label}</span>
                <strong>{loading ? "..." : item.value}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="glass-card">
          <h2>Users by country</h2>
          <div className="map-placeholder" aria-hidden="true" />
          <p className="muted">United States: 32.4%</p>
        </article>
      </div>
    </section>
  );
}
