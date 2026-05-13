import {
	Injectable,
	NestInterceptor,
	ExecutionContext,
	CallHandler,
	Logger,
} from '@nestjs/common';
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
	private auditLogs: AuditLog[] = [];

	intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const request = context.switchToHttp().getRequest<Request>();
		const response = context.switchToHttp().getResponse();

		const startTime = Date.now();
		const method = request.method;
		const path = request.path;
		const ip = request.ip || request.connection.remoteAddress || 'unknown';

		// Extract token from Authorization header
		const authHeader = request.get('Authorization') || '';
		const token = authHeader.replace('Bearer ', '').substring(0, 20); // Log first 20 chars only

		// Log request body for POST/PUT (except passwords)
		const body = this.sanitizeBody(request.body);

		return next.handle().pipe(
			tap({
				next: (result) => {
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

					this.auditLogs.push(auditLog);

					// Log to console (in production, send to external logger)
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

					this.auditLogs.push(auditLog);

					this.logger.error(
						`[${status}] ${method} ${path} (${duration}ms) - Error: ${error.message}`
					);
				},
			})
		);
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

	// Export logs to file (can be called periodically)
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
