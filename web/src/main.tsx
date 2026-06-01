import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Overview from "./pages/Overview";
import Containers from "./pages/Containers";
import Reports from "./pages/Reports";
import Vulnerabilities from "./pages/Vulnerabilities";
import Login from "./components/Login";
import { api } from "./services/api";
import { ContainerDetails, MatrixData, OverviewData, ScanTask } from "./types";
import "./styles.css";

type Tab = "overview" | "containers" | "vulnerabilities" | "reports";

function App() {
	const [overview, setOverview] = useState<OverviewData | null>(null);
	const [matrix, setMatrix] = useState<MatrixData | null>(null);
	const [tasks, setTasks] = useState<ScanTask[]>([]);
	const [selectedContainerId, setSelectedContainerId] = useState("redis");
	const [details, setDetails] = useState<ContainerDetails | null>(null);
	const [activeTab, setActiveTab] = useState<Tab>("overview");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [apiUrl, setApiUrl] = useState(api.getApiBaseUrl());
	const [token, setToken] = useState(api.getToken());
	const [showLogin, setShowLogin] = useState(false);

	async function loadData(containerId = selectedContainerId) {
		setLoading(true);
		setError(null);
		try {
			const [nextOverview, nextMatrix, nextTasks, nextDetails] = await Promise.all([
				api.overview(),
				api.matrix(),
				api.listTasks(),
				api.containerDetails(containerId)
			]);

			setOverview(nextOverview);
			setMatrix(nextMatrix);
			setTasks(nextTasks);
			setDetails(nextDetails);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Erreur inattendue");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		void loadData();
	}, []);

	function handleConnectionSave() {
		api.saveConnectionSettings(apiUrl, token);
		void loadData();
	}

	function handleLoginSuccess(newToken: string) {
		setToken(newToken);
		api.saveConnectionSettings(api.getApiBaseUrl(), newToken);
		void loadData();
	}

	return (
		<div className="app-shell">
			<header className="topbar">
				<div>
					<p className="eyebrow">NoviSec</p>
					<h1>Docker Auditor</h1>
				</div>
				<div className="connection-panel glass-card">
					<label>
						API URL
						<input value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} placeholder="http://localhost:3000" />
					</label>
					<label>
						Bearer token
						<input value={token} onChange={(event) => setToken(event.target.value)} placeholder="admin-dev-token" />
					</label>
					<div style={{ display: "flex", gap: 8 }}>
						<button className="button" onClick={handleConnectionSave} type="button">
							Sauvegarder et recharger
						</button>
						<button className="button button-secondary" onClick={() => setShowLogin(true)} type="button">
							Se connecter
						</button>
					</div>
				</div>
			</header>

			<nav className="tabbar">
				{[
					["overview", "Vue d’ensemble"],
					["containers", "Conteneurs"],
					["vulnerabilities", "Vulnérabilités"],
					["reports", "Tâches"]
				].map(([tab, label]) => (
					<button key={tab} className={`tab ${activeTab === tab ? "tab-active" : ""}`} onClick={() => setActiveTab(tab as Tab)} type="button">
						{label}
					</button>
				))}
			</nav>

			{error ? <div className="banner error">{error}</div> : null}

			{showLogin ? (
				<Login
					onClose={() => setShowLogin(false)}
					onSuccess={(t) => handleLoginSuccess(t)}
				/>
			) : null}

			{activeTab === "overview" ? <Overview overview={overview} matrix={matrix} loading={loading} /> : null}
			{activeTab === "containers" ? (
				<Containers
					details={details}
					loading={loading}
					onSelect={(containerId) => {
						setSelectedContainerId(containerId);
						void loadData(containerId);
					}}
					selectedContainerId={selectedContainerId}
				/>
			) : null}
			{activeTab === "vulnerabilities" ? <Vulnerabilities matrix={matrix} /> : null}
			{activeTab === "reports" ? (
				<Reports
					tasks={tasks}
					loading={loading}
					onRefresh={() => void loadData()}
					onCreateTask={async (payload) => {
						await api.createTask(payload);
					}}
				/>
			) : null}
		</div>
	);
}

createRoot(document.getElementById("root")!).render(<App />);

export {}
