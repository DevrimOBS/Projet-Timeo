import {
	Injectable,
	NestInterceptor,
	ExecutionContext,
	CallHandler,
	Logger,
} from '@nestjs/common';
import { appendFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

interface AuditLog {
	timestamp: string;
	method: string;
	path: string;
	status: number;
	duration: number;
	ip: string;
	token?: string;
	userId?: string;
	body?: any;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
	private readonly logger = new Logger('AUDIT');
	private readonly auditLogPath = process.env.AUDIT_LOG_PATH?.trim() || '';
	private readonly maxInMemoryLogs = Number(process.env.AUDIT_LOG_MAX_IN_MEMORY ?? 5000);
	private auditLogs: AuditLog[] = [];
	private fileWriteQueue: Promise<void> = Promise.resolve();
	private writeInitDone = false;
	private writeDisabled = false;

	intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const request = context.switchToHttp().getRequest<Request>();
		const response = context.switchToHttp().getResponse();

		const startTime = Date.now();
		const method = request.method;
		const path = request.path;
		const ip = request.ip || request.connection.remoteAddress || 'unknown';

		const token = this.extractTokenPreview(request.get('Authorization'));

		const body = this.sanitizeBody(request.body);

		return next.handle().pipe(
			tap({
				next: () => {
					const duration = Date.now() - startTime;
					const status = response.statusCode;

					const auditLog: AuditLog = {
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
						this.logger.log(
							`[${status}] ${method} ${path} (${duration}ms) - IP: ${ip}`
						);
					}
				},
				error: (error) => {
					const duration = Date.now() - startTime;
					const status = error.status || 500;

					const auditLog: AuditLog = {
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

					this.logger.error(
						`[${status}] ${method} ${path} (${duration}ms) - Error: ${error.message}`
					);
				},
			})
		);
	}

	private recordAuditLog(auditLog: AuditLog): void {
		this.auditLogs.push(auditLog);
		if (this.auditLogs.length > this.maxInMemoryLogs) {
			this.auditLogs.splice(0, this.auditLogs.length - this.maxInMemoryLogs);
		}

		if (this.auditLogPath) {
			this.enqueueFileWrite(auditLog);
		}
	}

	private enqueueFileWrite(auditLog: AuditLog): void {
		if (this.writeDisabled) {
			return;
		}

		this.fileWriteQueue = this.fileWriteQueue
			.then(async () => {
				if (!this.writeInitDone) {
					await mkdir(dirname(this.auditLogPath), { recursive: true });
					this.writeInitDone = true;
				}

				await appendFile(this.auditLogPath, `${JSON.stringify(auditLog)}\n`, 'utf-8');
			})
			.catch((err: unknown) => {
				this.writeDisabled = true;
				const message = err instanceof Error ? err.message : String(err);
				this.logger.error(`Failed to persist audit log to ${this.auditLogPath}: ${message}`);
			});
	}

	private extractTokenPreview(authHeader: string | undefined): string | undefined {
		if (!authHeader) {
			return undefined;
		}

		const [scheme, token] = authHeader.split(' ');
		if (scheme !== 'Bearer' || !token) {
			return undefined;
		}

		return token.slice(0, 20);
	}

	private sanitizeBody(body: any): any {
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

	private isAuditableAction(method: string, path: string): boolean {
		// Log all write operations and important reads
		if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
			return true;
		}

		// Also log specific important endpoints
		const importantPaths = ['/api/scan-tasks/claim', '/api/scans', '/api/reports'];
		return importantPaths.some((p) => path.includes(p));
	}

	getAuditLogs(): AuditLog[] {
		return this.auditLogs;
	}

	clearAuditLogs(): void {
		this.auditLogs = [];
	}

	// Export logs snapshot on demand.
	exportLogsToFile(filePath: string): void {
		const fs = require('fs');
		fs.writeFileSync(
			filePath,
			JSON.stringify(this.auditLogs, null, 2),
			'utf-8'
		);
		this.logger.log(`Audit logs exported to ${filePath}`);
	}
}
