import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Role } from "../enums/role.enum";
import { RequestWithUser } from "../types/request-with-user";

@Injectable()
export class BasicAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException("Authorization header is required");
    }

    const [scheme, token] = authHeader.split(" ");
    if (scheme !== "Bearer" || !token) {
      throw new UnauthorizedException("Use Bearer token");
    }

    const adminToken = process.env.ADMIN_TOKEN ?? "admin-dev-token";
    const viewerToken = process.env.VIEWER_TOKEN ?? "viewer-dev-token";

    if (token === adminToken) {
      req.user = { role: Role.ADMIN, subject: "admin" };
      return true;
    }

    if (token === viewerToken) {
      req.user = { role: Role.VIEWER, subject: "viewer" };
      return true;
    }

    throw new UnauthorizedException("Invalid token");
  }
}
