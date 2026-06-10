import { Module } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./modules/auth/auth.module";
import { DatabaseModule } from "./database/database.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { ScansModule } from "./modules/scans/scans.module";
import { SchedulingModule } from "./modules/scheduling/scheduling.module";
import { AuditInterceptor } from "./common/interceptors/audit.interceptor";

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: "default",
        ttl: Number(process.env.AUTH_RATE_LIMIT_TTL_MS ?? 60_000),
        limit: Number(process.env.AUTH_RATE_LIMIT_GLOBAL_LIMIT ?? 200)
      }
    ]),
    DatabaseModule,
    AuthModule,
    ScansModule,
    ReportsModule,
    SchedulingModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
