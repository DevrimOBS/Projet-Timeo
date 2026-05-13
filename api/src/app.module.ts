import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { AuthModule } from "./modules/auth/auth.module";
import { DatabaseModule } from "./database/database.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { ScansModule } from "./modules/scans/scans.module";
import { SchedulingModule } from "./modules/scheduling/scheduling.module";
import { AuditInterceptor } from "./common/interceptors/audit.interceptor";

@Module({
  imports: [DatabaseModule, AuthModule, ScansModule, ReportsModule, SchedulingModule],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
