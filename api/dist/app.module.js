"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const throttler_1 = require("@nestjs/throttler");
const auth_module_1 = require("./modules/auth/auth.module");
const database_module_1 = require("./database/database.module");
const reports_module_1 = require("./modules/reports/reports.module");
const scans_module_1 = require("./modules/scans/scans.module");
const scheduling_module_1 = require("./modules/scheduling/scheduling.module");
const audit_interceptor_1 = require("./common/interceptors/audit.interceptor");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            throttler_1.ThrottlerModule.forRoot([
                {
                    name: "default",
                    ttl: Number(process.env.AUTH_RATE_LIMIT_TTL_MS ?? 60_000),
                    limit: Number(process.env.AUTH_RATE_LIMIT_GLOBAL_LIMIT ?? 200)
                }
            ]),
            database_module_1.DatabaseModule,
            auth_module_1.AuthModule,
            scans_module_1.ScansModule,
            reports_module_1.ReportsModule,
            scheduling_module_1.SchedulingModule
        ],
        providers: [
            {
                provide: core_1.APP_GUARD,
                useClass: throttler_1.ThrottlerGuard
            },
            {
                provide: core_1.APP_INTERCEPTOR,
                useClass: audit_interceptor_1.AuditInterceptor,
            },
        ],
    })
], AppModule);
