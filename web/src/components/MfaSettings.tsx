import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { MfaSetupData, UserAccount } from "../types";

interface Props {
	currentUser: UserAccount;
	onClose: () => void;
	onUserUpdated: (user: UserAccount) => void;
}

export default function MfaSettings({ currentUser, onClose, onUserUpdated }: Props) {
	const [setupData, setSetupData] = useState<MfaSetupData | null>(null);
	const [users, setUsers] = useState<UserAccount[]>([]);
	const [otp, setOtp] = useState("");
	const [disableOtp, setDisableOtp] = useState("");
	const [disableRecoveryCode, setDisableRecoveryCode] = useState("");
	const [rotateOtp, setRotateOtp] = useState("");
	const [latestRecoveryCodes, setLatestRecoveryCodes] = useState<string[]>([]);
	const [loading, setLoading] = useState(false);
	const [adminActionUserId, setAdminActionUserId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	const isAdmin = currentUser.role === "admin";

	useEffect(() => {
		if (!isAdmin) {
			return;
		}

		void loadUsers();
	}, [isAdmin]);

	async function loadUsers() {
		try {
			const nextUsers = await api.listUsers();
			setUsers(nextUsers);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Impossible de charger les comptes utilisateurs");
		}
	}

	function resetMessages() {
		setError(null);
		setSuccess(null);
	}

	async function handleSetup() {
		setLoading(true);
		resetMessages();
		try {
			const data = await api.setupMfa();
			setSetupData(data);
			setLatestRecoveryCodes(data.recoveryCodes);
			setSuccess("Secret MFA généré. Vérifie ton application TOTP puis active avec le code OTP.");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Impossible d'initialiser la MFA");
		} finally {
			setLoading(false);
		}
	}

	async function handleEnable() {
		setLoading(true);
		resetMessages();
		try {
			const updated = await api.enableMfa(otp);
			onUserUpdated(updated);
			setOtp("");
			setSuccess("MFA activée sur le compte.");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Activation MFA impossible");
		} finally {
			setLoading(false);
		}
	}

	async function handleDisableOwn() {
		setLoading(true);
		resetMessages();
		try {
			const updated = await api.disableOwnMfa({
				otp: disableOtp || undefined,
				recoveryCode: disableRecoveryCode || undefined
			});
			onUserUpdated(updated);
			setDisableOtp("");
			setDisableRecoveryCode("");
			setSetupData(null);
			setLatestRecoveryCodes([]);
			setSuccess("MFA désactivée.");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Désactivation MFA impossible");
		} finally {
			setLoading(false);
		}
	}

	async function handleRotateRecoveryCodes() {
		setLoading(true);
		resetMessages();
		try {
			const response = await api.rotateRecoveryCodes(rotateOtp);
			setLatestRecoveryCodes(response.recoveryCodes);
			setRotateOtp("");
			setSuccess("Nouveaux codes de secours générés. Conserve-les hors ligne.");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Rotation des codes impossible");
		} finally {
			setLoading(false);
		}
	}

	async function handleAdminDisable(userId: string) {
		setAdminActionUserId(userId);
		resetMessages();
		try {
			await api.adminDisableMfa(userId);
			setSuccess("MFA réinitialisée pour l'utilisateur sélectionné.");
			await loadUsers();
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Réinitialisation admin impossible");
		} finally {
			setAdminActionUserId(null);
		}
	}

	return (
		<div className="modal-overlay">
			<div className="modal modal-wide glass-card mfa-modal">
				<div className="section-heading">
					<div>
						<p className="eyebrow">Sécurité</p>
						<h3>MFA et récupération</h3>
					</div>
					<button type="button" className="button button-secondary" onClick={onClose}>Fermer</button>
				</div>

				<div className="mfa-grid">
					<section className="mfa-panel">
						<h4>Ton compte</h4>
						<div className="matrix-list">
							<div className="matrix-row"><span>Utilisateur</span><strong>{currentUser.username}</strong></div>
							<div className="matrix-row"><span>Rôle</span><strong>{currentUser.role}</strong></div>
							<div className="matrix-row"><span>MFA</span><strong>{currentUser.mfaEnabled ? "Activée" : "Désactivée"}</strong></div>
							<div className="matrix-row"><span>Configurée le</span><strong>{currentUser.mfaConfiguredAt ? new Date(currentUser.mfaConfiguredAt).toLocaleString() : "-"}</strong></div>
						</div>

						<div className="mfa-actions">
							<button type="button" className="button" onClick={() => void handleSetup()} disabled={loading}>
								{currentUser.mfaEnabled ? "Régénérer setup MFA" : "Initialiser la MFA"}
							</button>
						</div>

						{setupData ? (
							<div className="mfa-secret-box">
								<p className="muted">Ajoute ce secret dans ton application TOTP puis confirme avec un OTP.</p>
								<label className="form-label">
									Secret base32
									<input value={setupData.secret} readOnly />
								</label>
								<label className="form-label">
									URL otpauth
									<textarea rows={3} value={setupData.otpauthUrl} readOnly />
								</label>
								<div className="stack">
									<label className="form-label">
										OTP de confirmation
										<input value={otp} onChange={(event) => setOtp(event.target.value)} placeholder="123456" />
									</label>
									<button type="button" className="button" onClick={() => void handleEnable()} disabled={loading || !otp.trim()}>
										Activer la MFA
									</button>
								</div>
							</div>
						) : null}

						{currentUser.mfaEnabled ? (
							<div className="stack">
								<div className="mfa-secret-box">
									<h4>Codes de secours</h4>
									<p className="muted">Utilise-les une seule fois si tu n’as plus accès à ton application TOTP.</p>
									{latestRecoveryCodes.length > 0 ? (
										<div className="recovery-code-grid">
											{latestRecoveryCodes.map((code) => (
												<code key={code} className="recovery-code">{code}</code>
											))}
										</div>
									) : (
										<p className="muted">Les codes ne sont affichés qu’après génération ou rotation.</p>
									)}
								</div>

								<div className="mfa-inline-actions">
									<label className="form-label grow">
										OTP pour régénérer les codes
										<input value={rotateOtp} onChange={(event) => setRotateOtp(event.target.value)} placeholder="123456" />
									</label>
									<button type="button" className="button button-secondary" onClick={() => void handleRotateRecoveryCodes()} disabled={loading || !rotateOtp.trim()}>
										Nouveaux codes
									</button>
								</div>

								<div className="mfa-inline-actions">
									<label className="form-label grow">
										OTP pour désactiver
										<input value={disableOtp} onChange={(event) => setDisableOtp(event.target.value)} placeholder="123456" />
									</label>
									<label className="form-label grow">
										Ou code de secours
										<input value={disableRecoveryCode} onChange={(event) => setDisableRecoveryCode(event.target.value)} placeholder="ABCD123456" />
									</label>
									<button
										type="button"
										className="button button-secondary"
										onClick={() => void handleDisableOwn()}
										disabled={loading || (!disableOtp.trim() && !disableRecoveryCode.trim())}
									>
										Désactiver
									</button>
								</div>
							</div>
						) : null}

						{error ? <p className="muted error">{error}</p> : null}
						{success ? <p className="muted success-text">{success}</p> : null}
					</section>

					{isAdmin ? (
						<section className="mfa-panel">
							<h4>Administration MFA</h4>
							<p className="muted">Réinitialise la MFA d’un compte si l’utilisateur a perdu son second facteur.</p>
							<div className="task-list">
								{users.map((user) => (
									<article key={user.id} className="task-card">
										<div className="vuln-container-head">
											<div>
												<strong>{user.username}</strong>
												<p className="muted">{user.role} · MFA {user.mfaEnabled ? "activée" : "désactivée"}</p>
											</div>
											<button
												type="button"
												className="button button-secondary"
												onClick={() => void handleAdminDisable(user.id)}
												disabled={!user.mfaEnabled || adminActionUserId === user.id}
											>
												{adminActionUserId === user.id ? "Reset..." : "Reset MFA"}
											</button>
										</div>
									</article>
								))}
							</div>
						</section>
					) : null}
				</div>
			</div>
		</div>
	);
}