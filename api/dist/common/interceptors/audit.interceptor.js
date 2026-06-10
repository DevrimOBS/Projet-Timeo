"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditInterceptor = void 0;
const common_1 = require("@nestjs/common");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const operators_1 = require("rxjs/operators");
let AuditInterceptor = class AuditInterceptor {
    constructor() {
        this.logger = new common_1.Logger('AUDIT');
        this.auditLogPath = process.env.AUDIT_LOG_PATH?.trim() || '';
        this.maxInMemoryLogs = Number(process.env.AUDIT_LOG_MAX_IN_MEMORY ?? 5000);
        this.auditLogs = [];
        this.fileWriteQueue = Promise.resolve();
        this.writeInitDone = false;
        this.writeDisabled = false;
    }
    intercept(context, next) {
        const request = context.switchToHttp().getRequest();
        const response = context.switchToHttp().getResponse();
        const startTime = Date.now();
        const method = request.method;
        const path = request.path;
        const ip = request.ip || request.connection.remoteAddress || 'unknown';
        const token = this.extractTokenPreview(request.get('Authorization'));
        const body = this.sanitizeBody(request.body);
        return next.handle().pipe((0, operators_1.tap)({
            next: () => {
                const duration = Date.now() - startTime;
                const status = response.statusCode;
                const auditLog = {
                    timestamp: new Date().toISOString(),
                    method,
                    path,
                    status,
                    duration,
                    ip,
                    token: token || undefined,
                    body: Object.keys(body).length > 0 ? body : undefined,
                };
                this.recordAuditLog(auditLog);
                if (this.isAuditableAction(method, path)) {
                    this.logger.log(`[${status}] ${method} ${path} (${duration}ms) - IP: ${ip}`);
                }
            },
            error: (error) => {
                const duration = Date.now() - startTime;
                const status = error.status || 500;
                const auditLog = {
                    timestamp: new Date().toISOString(),
                    method,
                    path,
                    status,
                    duration,
                    ip,
                    token: token || undefined,
                    body: Object.keys(body).length > 0 ? body : undefined,
                };
                this.recordAuditLog(auditLog);
                this.logger.error(`[${status}] ${method} ${path} (${duration}ms) - Error: ${error.message}`);
            },
        }));
    }
    recordAuditLog(auditLog) {
        this.auditLogs.push(auditLog);
        if (this.auditLogs.length > this.maxInMemoryLogs) {
            this.auditLogs.splice(0, this.auditLogs.length - this.maxInMemoryLogs);
        }
        if (this.auditLogPath) {
            this.enqueueFileWrite(auditLog);
        }
    }
    enqueueFileWrite(auditLog) {
        if (this.writeDisabled) {
            return;
        }
        this.fileWriteQueue = this.fileWriteQueue
            .then(async () => {
            if (!this.writeInitDone) {
                await (0, promises_1.mkdir)((0, path_1.dirname)(this.auditLogPath), { recursive: true });
                this.writeInitDone = true;
            }
            await (0, promises_1.appendFile)(this.auditLogPath, `${JSON.stringify(auditLog)}\n`, 'utf-8');
        })
            .catch((err) => {
            this.writeDisabled = true;
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`Failed to persist audit log to ${this.auditLogPath}: ${message}`);
        });
    }
    extractTokenPreview(authHeader) {
        if (!authHeader) {
            return undefined;
        }
        const [scheme, token] = authHeader.split(' ');
        if (scheme !== 'Bearer' || !token) {
            return undefined;
        }
        return token.slice(0, 20);
    }
    sanitizeBody(body) {
        if (!body || typeof body !== 'object') {
            return {};
        }
        const sanitized = { ...body };
        // Remove sensitive fields
        const sensitiveFields = [
            'password',
            'token',
            'secret',
            'apiKey',
            'api_key',
            'authorization',
        ];
        for (const field of sensitiveFields) {
            delete sanitized[field];
        }
        return sanitized;
    }
    isAuditableAction(method, path) {
        // Log all write operations and important reads
        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
            return true;
        }
        // Also log specific important endpoints
        const importantPaths = ['/api/scan-tasks/claim', '/api/scans', '/api/reports'];
        return importantPaths.some((p) => path.includes(p));
    }
    getAuditLogs() {
        return this.auditLogs;
    }
    clearAuditLogs() {
        this.auditLogs = [];
    }
    // Export logs snapshot on demand.
    exportLogsToFile(filePath) {
        const fs = require('fs');
        fs.writeFileSync(filePath, JSON.stringify(this.auditLogs, null, 2), 'utf-8');
        this.logger.log(`Audit logs exported to ${filePath}`);
    }
};
exports.AuditInterceptor = AuditInterceptor;
exports.AuditInterceptor = AuditInterceptor = __decorate([
    (0, common_1.Injectable)()
], AuditInterceptor);
