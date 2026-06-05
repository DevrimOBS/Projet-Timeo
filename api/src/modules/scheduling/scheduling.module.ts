import { Module } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { DatabaseModule } from "../../database/database.module";
import { BasicAuthGuard } from "../../common/guards/basic-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CveUpdaterService } from "./cve-updater.service";
import { ScanQueueController } from "./scan-queue.controller";
import { ScanQueueService } from "./scan-queue.service";
import { ScanTaskSchedulerService } from "./scan-task-scheduler.service";

@Module({
  imports: [DatabaseModule],
  controllers: [ScanQueueController],
  providers: [CveUpdaterService, ScanQueueService, ScanTaskSchedulerService, Reflector, BasicAuthGuard, RolesGuard],
  exports: [ScanQueueService]
})
export class SchedulingModule {}
