import { Module } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { DatabaseModule } from "../../database/database.module";
import { BasicAuthGuard } from "../../common/guards/basic-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";

@Module({
  imports: [DatabaseModule],
  controllers: [ReportsController],
  providers: [ReportsService, Reflector, BasicAuthGuard, RolesGuard]
})
export class ReportsModule {}
