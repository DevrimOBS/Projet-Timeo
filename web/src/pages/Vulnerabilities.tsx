import { MatrixData } from "../types";

interface Props {
  matrix: MatrixData | null;
}

export default function Vulnerabilities({ matrix }: Props) {
  const rows = [
    { label: "Critique", value: matrix?.critical ?? 0, tone: "severity-critical" },
    { label: "Haut", value: matrix?.high ?? 0, tone: "severity-high" },
    { label: "Moyen", value: matrix?.medium ?? 0, tone: "severity-medium" },
    { label: "Faible", value: matrix?.low ?? 0, tone: "severity-low" }
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
        {rows.map((row) => (
          <article key={row.label} className="glass-card severity-card">
            <span className={`severity ${row.tone}`}>{row.label}</span>
            <strong>{row.value}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
