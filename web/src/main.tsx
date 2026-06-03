import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Overview from "./pages/Overview";
import Containers from "./pages/Containers";
import Reports from "./pages/Reports";
import Vulnerabilities from "./pages/Vulnerabilities";
import Login from "./components/Login";
import { api } from "./services/api";
import { ContainerDetails, ContainerSeverityData, ContainerSummary, MatrixData, OverviewData, ScanTask } from "./types";
import "./styles.css";

type Tab = "overview" | "containers" | "vulnerabilities" | "reports";

function App() {
	const [overview, setOverview] = useState<OverviewData | null>(null);
	const [matrix, setMatrix] = useState<MatrixData | null>(null);
	const [tasks, setTasks] = useState<ScanTask[]>([]);
	const [containers, setContainers] = useState<ContainerSummary[]>([]);
	const [containerSeverityData, setContainerSeverityData] = useState<ContainerSeverityData[]>([]);
	const [selectedContainerId, setSelectedContainerId] = useState("");
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
			const [nextOverview, nextMatrix, nextTasks, nextContainers] = await Promise.all([
				api.overview(),
				api.matrix(),
				api.listTasks(),
				api.containers()
			]);

			setOverview(nextOverview);
			setMatrix(nextMatrix);
			setTasks(nextTasks);
			setContainers(nextContainers);

			const detailsByContainer = new Map<string, ContainerDetails>();
			const nextContainerSeverityData: ContainerSeverityData[] = [];

			await Promise.all(
				nextContainers.map(async (container) => {
					const containerDetails = await api.containerDetails(container.containerId);
					if (!containerDetails) {
						return;
					}

					detailsByContainer.set(container.containerId, containerDetails);

					const counts = { critical: 0, high: 0, medium: 0, low: 0 };
					for (const vuln of containerDetails.vulnerabilities) {
						const severity = String(vuln.severity).toLowerCase();
						if (severity === "critical" || severity === "high" || severity === "medium" || severity === "low") {
							counts[severity] += 1;
						}
					}

					nextContainerSeverityData.push({
						containerId: container.containerId,
						name: container.name,
						critical: counts.critical,
						high: counts.high,
						medium: counts.medium,
						low: counts.low,
						total: counts.critical + counts.high + counts.medium + counts.low
					});
				})
			);

			nextContainerSeverityData.sort((a, b) => b.total - a.total);
			setContainerSeverityData(nextContainerSeverityData);

			const nextContainerId =
				containerId && nextContainers.some((container) => container.containerId === containerId)
					? containerId
					: nextContainers[0]?.containerId ?? "";

			setSelectedContainerId(nextContainerId);

			if (nextContainerId) {
				setDetails(detailsByContainer.get(nextContainerId) ?? null);
			} else {
				setDetails(null);
			}
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
		<div className="dashboard-shell">
			<aside className="sidebar glass-card">
				<div className="brand-block">
					<p className="eyebrow">NoviSec</p>
					<h1>Docker Auditor</h1>
				</div>

				<div className="menu-group">
					<p className="menu-title">Dashboards</p>
					{[
						["overview", "Analytics"],
						["containers", "Containers"],
						["vulnerabilities", "Vulnerabilities"],
						["reports", "Reports"]
					].map(([tab, label]) => (
						<button
							key={tab}
							className={`menu-item ${activeTab === tab ? "menu-item-active" : ""}`}
							onClick={() => setActiveTab(tab as Tab)}
							type="button"
						>
							{label}
						</button>
					))}
				</div>

				<div className="menu-group">
					<p className="menu-title">Layouts</p>
					<button className="menu-item" type="button">Header Nav</button>
					<button className="menu-item" type="button">Icon Sidebar</button>
				</div>

				<div className="menu-group">
					<p className="menu-title">Templates</p>
					<button className="menu-item" type="button">Transaction History</button>
					<button className="menu-item" type="button">User Account</button>
				</div>
			</aside>

			<div className="workspace-main">
				<header className="topbar glass-card">
					<label className="search-wrap" aria-label="Recherche">
						<input type="search" placeholder="Search for containers, CVE, task..." />
					</label>
					<div className="topbar-actions">
						<button className="icon-button" type="button" aria-label="Notifications">
							<span className="notif-dot">2</span>
						</button>
						<button className="profile-pill" type="button">
							<span className="avatar">SB</span>
							<span>Security Admin</span>
						</button>
					</div>
				</header>

				<div className="connection-panel glass-card">
					<label>
						API URL
						<input value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} placeholder="https://localhost:3002" />
					</label>
					<label>
						Bearer token
						<input value={token} onChange={(event) => setToken(event.target.value)} placeholder="admin-dev-token" />
					</label>
					<div className="connection-actions">
						<button className="button" onClick={handleConnectionSave} type="button">
							Sauvegarder
						</button>
						<button className="button button-secondary" onClick={() => setShowLogin(true)} type="button">
							Connexion
						</button>
					</div>
				</div>

				{error ? <div className="banner error">{error}</div> : null}

				{showLogin ? (
					<Login
						onClose={() => setShowLogin(false)}
						onSuccess={(t) => handleLoginSuccess(t)}
					/>
				) : null}

				<main className="content-area">
					{activeTab === "overview" ? (
						<Overview
							overview={overview}
							matrix={matrix}
							containerSeverityData={containerSeverityData}
							loading={loading}
						/>
					) : null}
					{activeTab === "containers" ? (
						<Containers
							containers={containers}
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
				</main>
			</div>
		</div>
	);
}

createRoot(document.getElementById("root")!).render(<App />);

export {}
