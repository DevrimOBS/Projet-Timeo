import { useEffect, useState } from "react";
import { CreateScanTaskPayload, ScanSchedulerConfig, ScanTask, UpdateScanSchedulerPayload } from "../types";

interface Props {
  tasks: ScanTask[];
  schedulerConfig: ScanSchedulerConfig | null;
  loading: boolean;
  onRefresh: () => void;
  onCreateTask: (payload: CreateScanTaskPayload) => Promise<void>;
  onUpdateSchedulerConfig: (payload: UpdateScanSchedulerPayload) => Promise<void>;
  onTriggerSchedulerNow: () => Promise<void>;
}

export default function Reports({
  tasks,
  schedulerConfig,
  loading,
  onRefresh,
  onCreateTask,
  onUpdateSchedulerConfig,
  onTriggerSchedulerNow
}: Props) {
  const [mode, setMode] = useState<CreateScanTaskPayload["mode"]>("MANUAL_GLOBAL");
  const [containerIds, setContainerIds] = useState("api,web");
  const [message, setMessage] = useState("Audit manuel depuis le dashboard");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [schedulerSubmitting, setSchedulerSubmitting] = useState(false);
  const [schedulerTriggering, setSchedulerTriggering] = useState(false);
  const [schedulerNotice, setSchedulerNotice] = useState<string | null>(null);
  const [schedulerEnabled, setSchedulerEnabled] = useState<boolean>(schedulerConfig?.enabled ?? false);
  const [schedulerCron, setSchedulerCron] = useState<string>(schedulerConfig?.cron ?? "0 */12 * * *");
  const [schedulerTimezone, setSchedulerTimezone] = useState<string>(schedulerConfig?.timezone ?? "");
  const [schedulerRunOnStartup, setSchedulerRunOnStartup] = useState<boolean>(schedulerConfig?.run_on_startup ?? false);
  const [schedulerRequestedBy, setSchedulerRequestedBy] = useState<string>(schedulerConfig?.requested_by ?? "system:scheduler");
  const [schedulerMessage, setSchedulerMessage] = useState<string>(schedulerConfig?.message ?? "Scan automatique planifie");
  const [schedulerContainerIds, setSchedulerContainerIds] = useState<string>((schedulerConfig?.container_ids ?? []).join(","));

  useEffect(() => {
    if (!schedulerConfig) {
      return;
    }

    setSchedulerEnabled(schedulerConfig.enabled);
    setSchedulerCron(schedulerConfig.cron);
    setSchedulerTimezone(schedulerConfig.timezone ?? "");
    setSchedulerRunOnStartup(schedulerConfig.run_on_startup);
    setSchedulerRequestedBy(schedulerConfig.requested_by);
    setSchedulerMessage(schedulerConfig.message);
    setSchedulerContainerIds(schedulerConfig.container_ids.join(","));
  }, [schedulerConfig]);

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

  async function handleSaveScheduler() {
    setSchedulerSubmitting(true);
    setSchedulerNotice(null);

    try {
      await onUpdateSchedulerConfig({
        enabled: schedulerEnabled,
        cron: schedulerCron,
        timezone: schedulerTimezone,
        run_on_startup: schedulerRunOnStartup,
        requested_by: schedulerRequestedBy,
        message: schedulerMessage,
        container_ids: schedulerContainerIds
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      });
      setSchedulerNotice("Planification automatique mise a jour.");
      onRefresh();
    } catch (error) {
      setSchedulerNotice(error instanceof Error ? error.message : "Impossible de mettre a jour la planification.");
    } finally {
      setSchedulerSubmitting(false);
    }
  }

  async function handleTriggerSchedulerNow() {
    setSchedulerTriggering(true);
    setSchedulerNotice(null);

    try {
      await onTriggerSchedulerNow();
      setSchedulerNotice("Demande acceptee: la tache AUTO_CRON sera creee si aucune tache auto n est deja en attente.");
      onRefresh();
    } catch (error) {
      setSchedulerNotice(error instanceof Error ? error.message : "Impossible de declencher la planification.");
    } finally {
      setSchedulerTriggering(false);
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

      <div className="glass-card stack reports-merged-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Déclenchement</p>
            <h2>Déclenchement et planification</h2>
          </div>
        </div>

        <div className="reports-merged-grid">
          <div className="stack reports-subsection">
            <h3>Lancer une tâche ponctuelle</h3>

            <label className="form-label">
              Mode
              <select value={mode} onChange={(event) => setMode(event.target.value as CreateScanTaskPayload["mode"])}>
                <option value="MANUAL_GLOBAL">Analyse manuelle globale</option>
                <option value="MANUAL_TARGET">Analyse ciblée</option>
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

            {notice ? (
              <p className="muted">{notice}</p>
            ) : (
              <p className="muted">Le dashboard pousse une tâche dans PostgreSQL, puis l’agent la récupère via l’API.</p>
            )}
          </div>

          <div className="stack reports-subsection">
            <h3>Planification automatique</h3>

            {schedulerConfig ? (
              <>
                <label className="form-label">
                  Activer
                  <select value={schedulerEnabled ? "true" : "false"} onChange={(event) => setSchedulerEnabled(event.target.value === "true")}>
                    <option value="true">Oui</option>
                    <option value="false">Non</option>
                  </select>
                </label>

                <label className="form-label">
                  Cron
                  <input value={schedulerCron} onChange={(event) => setSchedulerCron(event.target.value)} placeholder="0 */12 * * *" />
                </label>

                <label className="form-label">
                  Timezone
                  <input value={schedulerTimezone} onChange={(event) => setSchedulerTimezone(event.target.value)} placeholder="Europe/Paris" />
                </label>

                <label className="form-label">
                  Lancer au demarrage
                  <select
                    value={schedulerRunOnStartup ? "true" : "false"}
                    onChange={(event) => setSchedulerRunOnStartup(event.target.value === "true")}
                  >
                    <option value="true">Oui</option>
                    <option value="false">Non</option>
                  </select>
                </label>

                <label className="form-label">
                  requested_by
                  <input value={schedulerRequestedBy} onChange={(event) => setSchedulerRequestedBy(event.target.value)} placeholder="system:scheduler" />
                </label>

                <label className="form-label">
                  Message
                  <textarea value={schedulerMessage} onChange={(event) => setSchedulerMessage(event.target.value)} rows={3} />
                </label>

                <label className="form-label">
                  Container IDs cibles (CSV)
                  <input
                    value={schedulerContainerIds}
                    onChange={(event) => setSchedulerContainerIds(event.target.value)}
                    placeholder="api,web,worker"
                  />
                </label>

                <div className="connection-actions">
                  <button className="button" onClick={() => void handleSaveScheduler()} disabled={schedulerSubmitting} type="button">
                    {schedulerSubmitting ? "Sauvegarde…" : "Sauvegarder la planification"}
                  </button>
                  <button
                    className="button button-secondary"
                    onClick={() => void handleTriggerSchedulerNow()}
                    disabled={schedulerTriggering}
                    type="button"
                  >
                    {schedulerTriggering ? "Declenchement…" : "Declencher maintenant"}
                  </button>
                </div>

                {schedulerNotice ? <p className="muted">{schedulerNotice}</p> : null}
              </>
            ) : (
              <p className="muted">Configuration indisponible (droits insuffisants ou API non a jour).</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
