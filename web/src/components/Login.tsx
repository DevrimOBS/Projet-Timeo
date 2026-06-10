import { useState, type FormEvent } from "react";
import { api } from "../services/api";

interface Props {
  onClose: () => void;
  onSuccess: (token: string) => void;
}

export default function Login({ onClose, onSuccess }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.login(username, password, otp || undefined, recoveryCode || undefined);
      api.saveConnectionSettings(api.getApiBaseUrl(), res.token);
      onSuccess(res.token);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal glass-card">
        <h3>Connexion</h3>
        <form onSubmit={handleSubmit}>
          <label className="form-label">
            Utilisateur
            <input value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label className="form-label">
            Mot de passe
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <label className="form-label">
            OTP (optionnel)
            <input value={otp} onChange={(e) => setOtp(e.target.value)} />
          </label>
          <label className="form-label">
            Code de secours (optionnel)
            <input value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value)} />
          </label>

          {error ? <p className="muted error">{error}</p> : null}

          <div style={{ display: "flex", gap: 8 }}>
            <button className="button" type="submit" disabled={loading}>
              {loading ? "Connexion…" : "Se connecter"}
            </button>
            <button type="button" className="button button-secondary" onClick={onClose}>
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
