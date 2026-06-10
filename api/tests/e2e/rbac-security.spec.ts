import request from "supertest";

const base = process.env.E2E_BASE_URL ?? "http://localhost:3000";

type UserRole = "admin" | "viewer" | "agent";

function envTokenFor(role: UserRole): string {
  if (role === "admin") {
    return process.env.E2E_ADMIN_TOKEN ?? process.env.ADMIN_TOKEN ?? "admin-dev-token";
  }
  if (role === "viewer") {
    return process.env.E2E_VIEWER_TOKEN ?? process.env.VIEWER_TOKEN ?? "viewer-dev-token";
  }
  return process.env.E2E_AGENT_TOKEN ?? process.env.AGENT_TOKEN ?? "agent-dev-token";
}

async function login(role: UserRole): Promise<string | null> {
  const username =
    role === "admin"
      ? process.env.E2E_ADMIN_USER ?? process.env.ADMIN_USER
      : role === "viewer"
        ? process.env.E2E_VIEWER_USER ?? process.env.VIEWER_USER
        : process.env.E2E_AGENT_USER ?? process.env.AGENT_USER;

  const password =
    role === "admin"
      ? process.env.E2E_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD
      : role === "viewer"
        ? process.env.E2E_VIEWER_PASSWORD ?? process.env.VIEWER_PASSWORD
        : process.env.E2E_AGENT_PASSWORD ?? process.env.AGENT_PASSWORD;

  if (!username || !password) {
    return null;
  }

  const resp = await request(base).post("/api/auth/login").send({ username, password });
  if (![200, 201].includes(resp.status) || !resp.body?.token) {
    return null;
  }

  return String(resp.body.token);
}

async function resolveToken(role: UserRole): Promise<string> {
  const jwtToken = await login(role);
  if (jwtToken) {
    return jwtToken;
  }

  return envTokenFor(role);
}

async function assertApiReachable(): Promise<void> {
  try {
    await request(base).get("/api/reports/overview");
  } catch {
    throw new Error(`API unreachable for e2e tests. Start API and set E2E_BASE_URL if needed (current: ${base}).`);
  }
}

describe("Security RBAC e2e", () => {
  jest.setTimeout(30000);

  let adminToken = "";
  let viewerToken = "";
  let agentToken = "";

  beforeAll(async () => {
    await assertApiReachable();
    adminToken = await resolveToken("admin");
    viewerToken = await resolveToken("viewer");
    agentToken = await resolveToken("agent");
  });

  it("should allow VIEWER to read reports overview", async () => {
    const resp = await request(base)
      .get("/api/reports/overview")
      .set("Authorization", `Bearer ${viewerToken}`);

    expect(resp.status).toBe(200);
  });

  it("should deny VIEWER creating scan tasks (admin-only)", async () => {
    const resp = await request(base)
      .post("/api/scan-tasks")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({ mode: "MANUAL_GLOBAL", message: "rbac-viewer-create-deny" });

    expect(resp.status).toBe(403);
  });

  it("should deny AGENT listing scan tasks (admin/viewer-only)", async () => {
    const resp = await request(base)
      .get("/api/scan-tasks")
      .set("Authorization", `Bearer ${agentToken}`);

    expect(resp.status).toBe(403);
  });

  it("should allow ADMIN creating scan tasks", async () => {
    const resp = await request(base)
      .post("/api/scan-tasks")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ mode: "MANUAL_GLOBAL", message: "rbac-admin-create-allow" });

    expect([200, 201]).toContain(resp.status);
    expect(resp.body).toHaveProperty("id");
  });
});
