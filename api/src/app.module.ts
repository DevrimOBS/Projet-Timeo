import { Module } from "@nestjs/common";
import { AuthModule } from "./modules/auth/auth.module";
import { DatabaseModule } from "./database/database.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { ScansModule } from "./modules/scans/scans.module";
import { SchedulingModule } from "./modules/scheduling/scheduling.module";

@Module({
  imports: [DatabaseModule, AuthModule, ScansModule, ReportsModule, SchedulingModule]
})
export class AppModule {}
