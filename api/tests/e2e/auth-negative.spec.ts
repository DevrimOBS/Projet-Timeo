import request from "supertest";

const base = process.env.E2E_BASE_URL ?? "http://localhost:3000";

async function assertApiReachable(): Promise<void> {
  try {
    await request(base).get("/api/reports/overview");
  } catch {
    throw new Error(`API unreachable for e2e tests. Start API and set E2E_BASE_URL if needed (current: ${base}).`);
  }
}

async function getAdminJwtOrThrow(): Promise<string> {
  const candidates = [
    {
      username: process.env.E2E_ADMIN_USER ?? process.env.ADMIN_USER,
      password: process.env.E2E_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD
    },
    {
      username: process.env.E2E_ADMIN_USER ?? "admin",
      password: process.env.E2E_ADMIN_PASSWORD ?? "admin-pass"
    }
  ];

  for (const candidate of candidates) {
    if (!candidate.username || !candidate.password) {
      continue;
    }

    const resp = await request(base)
      .post("/api/auth/login")
      .send({ username: candidate.username, password: candidate.password });

    if ([200, 201].includes(resp.status) && typeof resp.body?.token === "string") {
      const token = String(resp.body.token);
      if (token.split(".").length === 3) {
        return token;
      }
    }
  }

  throw new Error(
    "Unable to obtain an admin JWT for tampering test. Configure E2E_ADMIN_USER/E2E_ADMIN_PASSWORD or ADMIN_USER/ADMIN_PASSWORD."
  );
}

describe("Auth negative e2e", () => {
  jest.setTimeout(30000);

  beforeAll(async () => {
    await assertApiReachable();
  });

  it("should reject missing Authorization header", async () => {
    const resp = await request(base).get("/api/reports/overview");
    expect(resp.status).toBe(401);
  });

  it("should reject malformed auth scheme", async () => {
    const resp = await request(base)
      .get("/api/reports/overview")
      .set("Authorization", "Basic not-a-bearer");
    expect(resp.status).toBe(401);
  });

  it("should reject malformed Bearer token", async () => {
    const resp = await request(base)
      .get("/api/reports/overview")
      .set("Authorization", "Bearer");
    expect(resp.status).toBe(401);
  });

  it("should reject SQL injection-like login attempt", async () => {
    const resp = await request(base)
      .post("/api/auth/login")
      .send({ username: "' OR '1'='1", password: "anything" });

    expect([400, 401]).toContain(resp.status);
  });

  it("should reject non-whitelisted login payload fields", async () => {
    const resp = await request(base)
      .post("/api/auth/login")
      .send({ username: "admin", password: "admin-pass", unexpectedField: true });

    expect(resp.status).toBe(400);
  });

  it("should reject tampered JWT token", async () => {
    const validJwt = await getAdminJwtOrThrow();
    const parts = validJwt.split(".");
    const signature = parts[2];
    const lastChar = signature.slice(-1);
    const replacement = lastChar === "a" ? "b" : "a";
    parts[2] = `${signature.slice(0, -1)}${replacement}`;
    const tamperedJwt = parts.join(".");

    const resp = await request(base)
      .get("/api/reports/overview")
      .set("Authorization", `Bearer ${tamperedJwt}`);

    expect(resp.status).toBe(401);
  });
});
