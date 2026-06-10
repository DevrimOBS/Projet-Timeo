import request from "supertest";
import { existsSync, readFileSync } from "fs";
import https from "https";


const httpsBase = process.env.E2E_HTTPS_BASE_URL;
const caFile = process.env.E2E_CA_CERT_FILE;
const badCaFile = process.env.E2E_BAD_CA_CERT_FILE;
const adminToken = process.env.E2E_ADMIN_TOKEN ?? process.env.ADMIN_TOKEN ?? "admin-dev-token";

const describeIfTls = httpsBase ? describe : describe.skip;

function strictTlsRequest(baseUrl: string, ca: Buffer, bearerToken: string): Promise<number> {
  const url = new URL("/api/reports/overview", baseUrl);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: "GET",
        rejectUnauthorized: true,
        ca,
        headers: {
          Authorization: `Bearer ${bearerToken}`
        }
      },
      (res) => {
        resolve(res.statusCode ?? 0);
      }
    );

    req.on("error", reject);
    req.end();
  });
}

function assertFilePresent(path: string | undefined, envName: string): asserts path is string {
  if (!path || !existsSync(path)) {
    throw new Error(`${envName} must point to an existing file for TLS e2e tests.`);
  }
}

describeIfTls("TLS validation e2e", () => {
  jest.setTimeout(30000);

  it("should reach API over HTTPS with trusted CA", async () => {
    assertFilePresent(caFile, "E2E_CA_CERT_FILE");
    const ca = readFileSync(caFile);

    const resp = await request(httpsBase as string)
      .get("/api/reports/overview")
      .ca(ca)
      .set("Authorization", `Bearer ${adminToken}`);

    // If auth state differs, request must still complete through a valid TLS handshake.
    expect([200, 401, 403]).toContain(resp.status);
  });

  it("should fail HTTPS handshake with untrusted CA", async () => {
    assertFilePresent(badCaFile, "E2E_BAD_CA_CERT_FILE");
    const ca = readFileSync(badCaFile);

    await expect(strictTlsRequest(httpsBase as string, ca, adminToken)).rejects.toThrow();
  });
});
