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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const login_dto_1 = require("./dto/login.dto");
const jwt_1 = require("../../common/utils/jwt");
const users_service_1 = require("../users/users.service");
let AuthController = class AuthController {
    constructor(usersService) {
        this.usersService = usersService;
    }
    async login(payload, req) {
        const allowedKeys = new Set(['username', 'password', 'otp', 'recoveryCode']);
        const incomingBody = (req.body ?? {});
        const unexpectedFields = Object.keys(incomingBody).filter((key) => !allowedKeys.has(key));
        if (unexpectedFields.length > 0) {
            throw new common_1.BadRequestException(`Unexpected fields: ${unexpectedFields.join(', ')}`);
        }
        const user = await this.usersService.authenticate(payload.username, payload.password);
        await this.usersService.verifyLoginSecondFactor(user, payload.otp, payload.recoveryCode);
        await this.usersService.markLoginSuccess(user.id);
        const token = (0, jwt_1.signToken)(user.username, user.role);
        return { token, expiresIn: process.env.AUTH_JWT_EXPIRES_IN ?? '8h' };
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('login'),
    (0, common_1.HttpCode)(200),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true
    })),
    (0, throttler_1.Throttle)({
        default: {
            ttl: Number(process.env.AUTH_LOGIN_RATE_LIMIT_TTL_MS ?? 60_000),
            limit: Number(process.env.AUTH_LOGIN_RATE_LIMIT_LIMIT ?? 20),
            getTracker: (req) => {
                const ip = String(req.ip ?? req.ips?.[0] ?? 'unknown');
                const body = req.body ?? {};
                const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : 'anonymous';
                return `${ip}:${username}`;
            }
        }
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.LoginDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('api/auth'),
    __param(0, (0, common_1.Inject)(users_service_1.UsersService)),
    __metadata("design:paramtypes", [users_service_1.UsersService])
], AuthController);
