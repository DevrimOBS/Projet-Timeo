import request from 'supertest';

const base = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const adminToken = process.env.E2E_ADMIN_TOKEN ?? 'admin-dev-token';
const agentToken = process.env.E2E_AGENT_TOKEN ?? 'agent-dev-token';

describe('Agent → API e2e flow (supertest)', () => {
  jest.setTimeout(30000);

  it('creates a task, claims it, posts a scan and completes the task', async () => {
    // 1) create task
    const create = await request(base)
      .post('/api/scan-tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ mode: 'MANUAL_GLOBAL' });

    expect([200,201]).toContain(create.status);
    const taskId = create.body?.id;
    expect(taskId).toBeDefined();

    // 2) claim as agent
    const claim = await request(base).post('/api/scan-tasks/claim').set('Authorization', `Bearer ${agentToken}`);
    expect([200,204]).toContain(claim.status);

    // 3) post scan
    const scanPayload = {
      agent_id: 'agent-e2e',
      timestamp: new Date().toISOString(),
      scan_type: 'docker',
      containers: [],
      summary: {
        total_containers: 0,
        healthy_containers: 0,
        vulnerable_containers: 0,
        total_vulnerabilities: 0,
        global_risk_score: 0
      }
    };

    const scan = await request(base).post('/api/scans').set('Authorization', `Bearer ${agentToken}`).send(scanPayload);
    expect([200,201]).toContain(scan.status);
    const scanId = scan.body?.scanId;
    expect(scanId).toBeDefined();

    // 4) try to complete the task (only if claim returned a task id)
    let claimedId = claim.body?.id ?? taskId;
    const complete = await request(base)
      .post(`/api/scan-tasks/${claimedId}/complete`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ status: 'completed', scan_id: scanId });

    expect([200,201]).toContain(complete.status);

    // 5) verify task exists in list
    const list = await request(base).get('/api/scan-tasks').set('Authorization', `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    const found = (list.body || []).some((t: any) => t.id === taskId);
    expect(found).toBe(true);
  });
});
