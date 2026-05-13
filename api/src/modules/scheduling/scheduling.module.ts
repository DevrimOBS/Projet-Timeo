import { Module } from "@nestjs/common";
import { CveUpdaterService } from "./cve-updater.service";
import { ScanQueueController } from "./scan-queue.controller";
import { ScanQueueService } from "./scan-queue.service";

@Module({
  controllers: [ScanQueueController],
  providers: [CveUpdaterService, ScanQueueService],
  exports: [ScanQueueService]
})
export class SchedulingModule {}
