import { useState } from "react";
import { CreateScanTaskPayload, ScanTask } from "../types";

interface Props {
  tasks: ScanTask[];
  loading: boolean;
  onRefresh: () => void;
  onCreateTask: (payload: CreateScanTaskPayload) => Promise<void>;
}

export default function Reports({ tasks, loading, onRefresh, onCreateTask }: Props) {
  const [mode, setMode] = useState<CreateScanTaskPayload["mode"]>("MANUAL_GLOBAL");
  const [containerIds, setContainerIds] = useState("api,web");
  const [message, setMessage] = useState("Audit manuel depuis le dashboard");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleCreateTask() {
    setSubmitting(true);
    setNotice(null);

    try {
      const payload: CreateScanTaskPayload = {
        mode,
        message,
        container_ids:
          mode === "MANUAL_TARGET"
            ? containerIds
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean)
            : undefined
      };

      await onCreateTask(payload);
      setNotice("Tâche créée et placée en file.");
      onRefresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Impossible de créer la tâche.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel split-grid reports-grid">
      <div className="glass-card stack">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Tâches</p>
            <h2>File d’attente des scans</h2>
          </div>
          <button className="button button-secondary" onClick={onRefresh} type="button">
            Rafraîchir
          </button>
        </div>

        <div className="task-list">
          {loading ? (
            <p className="muted">Chargement des tâches…</p>
          ) : tasks.length === 0 ? (
            <p className="muted">Aucune tâche en file pour le moment.</p>
          ) : (
            tasks.map((task) => (
              <article key={task.id} className="task-card">
                <div className="vuln-top">
                  <strong>{task.mode}</strong>
                  <span className={`severity severity-${task.status}`}>{task.status}</span>
                </div>
                <p>{task.message ?? "Tâche sans message"}</p>
                <div className="meta-grid">
                  <span>Demandé par: {task.requested_by}</span>
                  <span>Conteneurs: {(task.container_ids ?? []).length}</span>
                  <span>{new Date(task.requested_at).toLocaleString("fr-FR")}</span>
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="glass-card stack">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Action</p>
            <h2>Lancer un audit</h2>
          </div>
        </div>

        <div className="stack">
          <label className="form-label">
            Mode
            <select value={mode} onChange={(event) => setMode(event.target.value as CreateScanTaskPayload["mode"])}>
              <option value="MANUAL_GLOBAL">Analyse manuelle globale</option>
              <option value="MANUAL_TARGET">Analyse ciblée</option>
              <option value="AUTO_CRON">Analyse planifiée</option>
            </select>
          </label>

          <label className="form-label">
            Container IDs ciblés
            <input
              value={containerIds}
              onChange={(event) => setContainerIds(event.target.value)}
              disabled={mode !== "MANUAL_TARGET"}
              placeholder="api,web,worker"
            />
          </label>

          <label className="form-label">
            Message
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={4} />
          </label>

          <button className="button" onClick={() => void handleCreateTask()} disabled={submitting} type="button">
            {submitting ? "Création…" : "Créer la tâche"}
          </button>

          {notice ? <p className="muted">{notice}</p> : <p className="muted">Le dashboard pousse une tâche dans PostgreSQL, puis l’agent la récupère via l’API.</p>}
        </div>
      </div>
    </section>
  );
}
