"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BasicAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const role_enum_1 = require("../enums/role.enum");
const jwt_1 = require("../utils/jwt");
let BasicAuthGuard = class BasicAuthGuard {
    canActivate(context) {
        const req = context.switchToHttp().getRequest();
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            throw new common_1.UnauthorizedException("Authorization header is required");
        }
        const [scheme, token] = authHeader.split(" ");
        if (scheme !== "Bearer" || !token) {
            throw new common_1.UnauthorizedException("Use Bearer token");
        }
        // 1) Try JWT verification first
        const payload = (0, jwt_1.verifyToken)(token);
        if (payload) {
            const role = payload.role;
            req.user = { role, subject: payload.sub };
            return true;
        }
        // 2) Fallback to legacy static tokens (env)
        const adminToken = process.env.ADMIN_TOKEN ?? "admin-dev-token";
        const viewerToken = process.env.VIEWER_TOKEN ?? "viewer-dev-token";
        const agentToken = process.env.AGENT_TOKEN ?? "agent-dev-token";
        if (token === adminToken) {
            req.user = { role: role_enum_1.Role.ADMIN, subject: "admin" };
            return true;
        }
        if (token === viewerToken) {
            req.user = { role: role_enum_1.Role.VIEWER, subject: "viewer" };
            return true;
        }
        if (token === agentToken) {
            req.user = { role: role_enum_1.Role.AGENT, subject: "agent" };
            return true;
        }
        throw new common_1.UnauthorizedException("Invalid token");
    }
};
exports.BasicAuthGuard = BasicAuthGuard;
exports.BasicAuthGuard = BasicAuthGuard = __decorate([
    (0, common_1.Injectable)()
], BasicAuthGuard);
