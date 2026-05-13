import { MatrixData, OverviewData } from "../types";

interface Props {
  overview: OverviewData | null;
  matrix: MatrixData | null;
  loading: boolean;
}

export default function Overview({ overview, matrix, loading }: Props) {
  const cards = [
    { label: "Scans enregistrés", value: overview?.scansCount ?? 0, hint: "Historique consolidé" },
    { label: "Conteneurs sains", value: overview?.healthyContainers ?? 0, hint: "Statut stable" },
    { label: "Conteneurs vulnérables", value: overview?.vulnerableContainers ?? 0, hint: "À traiter" },
    { label: "Risque global", value: `${(overview?.globalRiskScore ?? 0).toFixed(1)} / 10`, hint: "Score moyen" }
  ];

  const matrixItems = [
    { key: "critical", label: "Critique", value: matrix?.critical ?? 0 },
    { key: "high", label: "Haut", value: matrix?.high ?? 0 },
    { key: "medium", label: "Moyen", value: matrix?.medium ?? 0 },
    { key: "low", label: "Faible", value: matrix?.low ?? 0 }
  ];

  return (
    <section className="panel hero-grid">
      <div className="hero-copy">
        <p className="eyebrow">NoviSec Docker Auditor</p>
        <h1>Visualiser le risque Docker sans perdre le fil des scans.</h1>
        <p className="lead">
          Une vue d’ensemble lisible des conteneurs, des vulnérabilités CVE et des tâches d’audit déclenchées par l’API.
        </p>
        <div className="hero-stats">
          {cards.map((card) => (
            <article key={card.label} className="stat-card">
              <span>{card.label}</span>
              <strong>{loading ? "…" : card.value}</strong>
              <small>{card.hint}</small>
            </article>
          ))}
        </div>
      </div>

      <div className="hero-side glass-card">
        <h2>Matrice de criticité</h2>
        <div className="matrix-list">
          {matrixItems.map((item) => (
            <div key={item.key} className="matrix-row">
              <span>{item.label}</span>
              <strong>{loading ? "…" : item.value}</strong>
            </div>
          ))}
        </div>
        <p className="muted">Les données proviennent de /api/reports/matrix.</p>
      </div>
    </section>
  );
}
