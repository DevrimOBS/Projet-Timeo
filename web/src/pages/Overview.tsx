import { MatrixData, OverviewData } from "../types";

interface Props {
  overview: OverviewData | null;
  matrix: MatrixData | null;
  loading: boolean;
}

export default function Overview({ overview, matrix, loading }: Props) {
  const scansCount = overview?.scansCount ?? 0;
  const healthy = overview?.healthyContainers ?? 0;
  const vulnerable = overview?.vulnerableContainers ?? 0;
  const risk = overview?.globalRiskScore ?? 0;

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
              <button className="chip chip-active" type="button">Hour</button>
              <button className="chip" type="button">Day</button>
              <button className="chip" type="button">Week</button>
            </div>
          </div>
          <svg viewBox="0 0 760 240" className="line-chart" role="img" aria-label="Évolution des sessions">
            <polyline points="0,200 100,180 190,110 280,140 360,72 460,160 560,124 660,86 760,200" className="line line-current" />
            <polyline points="0,206 110,140 210,150 300,162 410,110 500,88 610,174 760,206" className="line line-previous" />
          </svg>
        </article>

        <article className="glass-card donut-card">
          <h2>Users by device</h2>
          <div className="donut-ring" aria-hidden="true" />
          <div className="device-stats">
            <p><span>Desktop</span><strong>68.3%</strong></p>
            <p><span>Tablet</span><strong>24.2%</strong></p>
            <p><span>Mobile</span><strong>7.5%</strong></p>
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
