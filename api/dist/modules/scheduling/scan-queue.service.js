"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScanQueueService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const database_service_1 = require("../../database/database.service");
let ScanQueueService = class ScanQueueService {
    constructor(db) {
        this.db = db;
    }
    async createTask(payload, requestedBy) {
        const id = (0, crypto_1.randomUUID)();
        const containerIds = payload.container_ids ?? [];
        const result = await this.db.query(`INSERT INTO scan_tasks (id, mode, status, requested_by, target_container_ids, message)
       VALUES ($1, $2, 'queued', $3, $4::jsonb, $5)
       RETURNING id, mode, status, requested_by, claimed_by, scan_id, target_container_ids, message, requested_at, claimed_at, completed_at`, [id, payload.mode, requestedBy, JSON.stringify(containerIds), payload.message ?? null]);
        return this.normalizeTask(result.rows[0]);
    }
    async listTasks() {
        const result = await this.db.query(`SELECT id, mode, status, requested_by, claimed_by, scan_id, target_container_ids, message, requested_at, claimed_at, completed_at
       FROM scan_tasks
       ORDER BY requested_at DESC`);
        return result.rows.map((row) => this.normalizeTask(row));
    }
    async claimNextTask(agentId) {
        return this.db.transaction(async (client) => {
            const candidate = await client.query(`SELECT id
         FROM scan_tasks
         WHERE status = 'queued'
         ORDER BY requested_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1`);
            if (candidate.rows.length === 0) {
                return null;
            }
            const result = await client.query(`UPDATE scan_tasks
         SET status = 'processing', claimed_by = $2, claimed_at = NOW()
         WHERE id = $1
         RETURNING id, mode, status, requested_by, claimed_by, scan_id, target_container_ids, message, requested_at, claimed_at, completed_at`, [candidate.rows[0].id, agentId]);
            return this.normalizeTask(result.rows[0]);
        });
    }
    async completeTask(taskId, agentId, payload) {
        const result = await this.db.query(`UPDATE scan_tasks
       SET status = $2,
           scan_id = COALESCE($3, scan_id),
           completed_at = NOW(),
           claimed_by = COALESCE(claimed_by, $4),
           message = COALESCE($5, message)
       WHERE id = $1
       RETURNING id, mode, status, requested_by, claimed_by, scan_id, target_container_ids, message, requested_at, claimed_at, completed_at`, [taskId, payload.status, payload.scan_id ?? null, agentId, payload.message ?? null]);
        if (result.rows.length === 0) {
            throw new common_1.NotFoundException("Task not found");
        }
        return this.normalizeTask(result.rows[0]);
    }
    normalizeTask(row) {
        if (!row) {
            return {};
        }
        return {
            ...row,
            container_ids: row.target_container_ids ?? []
        };
    }
};
exports.ScanQueueService = ScanQueueService;
exports.ScanQueueService = ScanQueueService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_service_1.DatabaseService)),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], ScanQueueService);
