import request from "supertest";

const base = process.env.E2E_BASE_URL ?? "http://localhost:3000";

async function assertApiReachable(): Promise<void> {
  try {
    await request(base).get("/api/reports/overview");
  } catch {
    throw new Error(`API unreachable for e2e tests. Start API and set E2E_BASE_URL if needed (current: ${base}).`);
  }
}

describe("Rate limit e2e", () => {
  jest.setTimeout(30000);

  beforeAll(async () => {
    await assertApiReachable();
  });

  it("should throttle repeated failed login attempts", async () => {
    const attempts = Number(process.env.E2E_RATE_LIMIT_ATTEMPTS ?? 30);
    let sawTooManyRequests = false;

    for (let i = 0; i < attempts; i += 1) {
      const resp = await request(base).post("/api/auth/login").send({
        username: "nonexistent-user",
        password: `wrong-password-${i}`
      });

      if (resp.status === 429) {
        sawTooManyRequests = true;
        break;
      }

      expect([400, 401]).toContain(resp.status);
    }

    expect(sawTooManyRequests).toBe(true);
  });
});
