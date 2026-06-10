import { Request } from "express";
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Role } from "../enums/role.enum";
import { RequestWithUser } from "../types/request-with-user";
import { verifyToken } from "../utils/jwt";
import { DatabaseService } from "../../database/database.service";


@Injectable()
export class BasicAuthGuard implements CanActivate {
	constructor(private readonly db: DatabaseService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException("Authorization header is required");
    }

    const [scheme, token] = authHeader.split(" ");
    if (scheme !== "Bearer" || !token) {
      throw new UnauthorizedException("Use Bearer token");
    }

    // 1) Try JWT verification first
    const payload = verifyToken(token);
    if (payload) {
      const role = payload.role as Role;
      const result = await this.db.query<{ username: string; role: string; is_active: boolean }>(
        `SELECT username, role, is_active FROM users WHERE username = $1 LIMIT 1`,
        [payload.sub]
      );

      const account = result.rows[0];
      if (!account || !account.is_active || account.role !== role) {
        throw new UnauthorizedException("User account is inactive or missing");
      }

      req.user = { role, subject: payload.sub } as any;
      return true;
    }

    // 2) Fallback to legacy static tokens (env)
    const adminToken = process.env.ADMIN_TOKEN ?? "admin-dev-token";
    const viewerToken = process.env.VIEWER_TOKEN ?? "viewer-dev-token";
    const agentToken = process.env.AGENT_TOKEN ?? "agent-dev-token";

    if (token === adminToken) {
      req.user = { role: Role.ADMIN, subject: "admin" };
      return true;
    }

    if (token === viewerToken) {
      req.user = { role: Role.VIEWER, subject: "viewer" };
      return true;
    }

    if (token === agentToken) {
      req.user = { role: Role.AGENT, subject: "agent" };
      return true;
    }

    throw new UnauthorizedException("Invalid token");
  }
}