import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { DatabaseService } from "../../database/database.service";
import { CompleteScanTaskDto, CreateScanTaskDto } from "./dto/scan-task.dto";

@Injectable()
export class ScanQueueService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async createTask(payload: CreateScanTaskDto, requestedBy: string): Promise<Record<string, unknown>> {
    const id = randomUUID();
    const containerIds = payload.container_ids ?? [];

    const result = await this.db.query(
      `INSERT INTO scan_tasks (id, mode, status, requested_by, target_container_ids, message)
       VALUES ($1, $2, 'queued', $3, $4::jsonb, $5)
       RETURNING id, mode, status, requested_by, claimed_by, scan_id, target_container_ids, message, requested_at, claimed_at, completed_at`,
      [id, payload.mode, requestedBy, JSON.stringify(containerIds), payload.message ?? null]
    );

    return this.normalizeTask(result.rows[0]);
  }

  async listTasks(): Promise<Record<string, unknown>[]> {
    const result = await this.db.query(
      `SELECT id, mode, status, requested_by, claimed_by, scan_id, target_container_ids, message, requested_at, claimed_at, completed_at
       FROM scan_tasks
       ORDER BY requested_at DESC`
    );

    return result.rows.map((row) => this.normalizeTask(row));
  }

  async claimNextTask(agentId: string): Promise<Record<string, unknown> | null> {
    return this.db.transaction(async (client) => {
      const candidate = await client.query<{ id: string }>(
        `SELECT id
         FROM scan_tasks
         WHERE status = 'queued'
         ORDER BY requested_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1`
      );

      if (candidate.rows.length === 0) {
        return null;
      }

      const result = await client.query(
        `UPDATE scan_tasks
         SET status = 'processing', claimed_by = $2, claimed_at = NOW()
         WHERE id = $1
         RETURNING id, mode, status, requested_by, claimed_by, scan_id, target_container_ids, message, requested_at, claimed_at, completed_at`,
        [candidate.rows[0].id, agentId]
      );

      return this.normalizeTask(result.rows[0]);
    });
  }

  async completeTask(taskId: string, agentId: string, payload: CompleteScanTaskDto): Promise<Record<string, unknown>> {
    const result = await this.db.query(
      `UPDATE scan_tasks
       SET status = $2,
           scan_id = COALESCE($3, scan_id),
           completed_at = NOW(),
           claimed_by = COALESCE(claimed_by, $4),
           message = COALESCE($5, message)
       WHERE id = $1
       RETURNING id, mode, status, requested_by, claimed_by, scan_id, target_container_ids, message, requested_at, claimed_at, completed_at`,
      [taskId, payload.status, payload.scan_id ?? null, agentId, payload.message ?? null]
    );

    if (result.rows.length === 0) {
      throw new NotFoundException("Task not found");
    }

    return this.normalizeTask(result.rows[0]);
  }

  private normalizeTask(row: Record<string, unknown> | undefined): Record<string, unknown> {
    if (!row) {
      return {};
    }

    return {
      ...row,
      container_ids: row.target_container_ids ?? []
    };
  }
}