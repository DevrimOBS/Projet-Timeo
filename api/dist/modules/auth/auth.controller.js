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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const login_dto_1 = require("./dto/login.dto");
const jwt_1 = require("../../common/utils/jwt");
const role_enum_1 = require("../../common/enums/role.enum");
const speakeasy_1 = __importDefault(require("speakeasy"));
let AuthController = class AuthController {
    login(payload) {
        const username = payload.username?.trim();
        const password = payload.password?.trim();
        // Basic local user check using environment variables (dev-mode)
        const adminUser = process.env.ADMIN_USER ?? 'admin';
        const adminPass = process.env.ADMIN_PASSWORD ?? 'admin-pass';
        const viewerUser = process.env.VIEWER_USER ?? 'viewer';
        const viewerPass = process.env.VIEWER_PASSWORD ?? 'viewer-pass';
        const agentUser = process.env.AGENT_USER ?? 'agent';
        const agentPass = process.env.AGENT_PASSWORD ?? 'agent-pass';
        if (username === adminUser && password === adminPass) {
            // If MFA is enabled, require OTP verification
            if (process.env.AUTH_MFA_ENABLED === 'true') {
                const secret = process.env.ADMIN_MFA_SECRET;
                if (!secret || !payload.otp || !speakeasy_1.default.totp.verify({ secret, encoding: 'base32', token: payload.otp })) {
                    throw new common_1.UnauthorizedException('invalid credentials or otp');
                }
            }
            const token = (0, jwt_1.signToken)('admin', role_enum_1.Role.ADMIN);
            return { token, expiresIn: process.env.AUTH_JWT_EXPIRES_IN ?? '8h' };
        }
        if (username === viewerUser && password === viewerPass) {
            if (process.env.AUTH_MFA_ENABLED === 'true') {
                const secret = process.env.VIEWER_MFA_SECRET;
                if (!secret || !payload.otp || !speakeasy_1.default.totp.verify({ secret, encoding: 'base32', token: payload.otp })) {
                    throw new common_1.UnauthorizedException('invalid credentials or otp');
                }
            }
            const token = (0, jwt_1.signToken)('viewer', role_enum_1.Role.VIEWER);
            return { token, expiresIn: process.env.AUTH_JWT_EXPIRES_IN ?? '8h' };
        }
        if (username === agentUser && password === agentPass) {
            if (process.env.AUTH_MFA_ENABLED === 'true') {
                const secret = process.env.AGENT_MFA_SECRET;
                if (!secret || !payload.otp || !speakeasy_1.default.totp.verify({ secret, encoding: 'base32', token: payload.otp })) {
                    throw new common_1.UnauthorizedException('invalid credentials or otp');
                }
            }
            const token = (0, jwt_1.signToken)('agent', role_enum_1.Role.AGENT);
            return { token, expiresIn: process.env.AUTH_JWT_EXPIRES_IN ?? '8h' };
        }
        throw new common_1.UnauthorizedException('invalid credentials');
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('login'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.LoginDto]),
    __metadata("design:returntype", Object)
], AuthController.prototype, "login", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('api/auth')
], AuthController);
