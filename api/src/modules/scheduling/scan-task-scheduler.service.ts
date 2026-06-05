import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import cron, { ScheduledTask } from "node-cron";
import { ScanSchedulerConfigDto, UpdateScanSchedulerDto } from "./dto/scan-scheduler.dto";
import { CreateScanTaskDto } from "./dto/scan-task.dto";
import { ScanQueueService } from "./scan-queue.service";

@Injectable()
export class ScanTaskSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScanTaskSchedulerService.name);
  private task?: ScheduledTask;
  private config: ScanSchedulerConfigDto;

  constructor(private readonly scanQueueService: ScanQueueService) {
    this.config = {
      enabled: process.env.SCAN_TASK_SCHEDULER_ENABLED === "true",
      cron: process.env.SCAN_TASK_SCHEDULER_CRON ?? "0 */12 * * *",
      timezone: process.env.SCAN_TASK_SCHEDULER_TIMEZONE || null,
      run_on_startup: process.env.SCAN_TASK_SCHEDULER_RUN_ON_STARTUP === "true",
      requested_by: process.env.SCAN_TASK_SCHEDULER_REQUESTED_BY ?? "system:scheduler",
      message: process.env.SCAN_TASK_SCHEDULER_MESSAGE ?? "Scan automatique planifie",
      container_ids: (process.env.SCAN_TASK_SCHEDULER_CONTAINER_IDS ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    };
  }

  async onModuleInit(): Promise<void> {
    await this.refreshSchedule(this.config.run_on_startup);
  }

  onModuleDestroy(): void {
    this.stopTask();
  }

  getConfig(): ScanSchedulerConfigDto {
    return {
      ...this.config,
      container_ids: [...this.config.container_ids]
    };
  }

  async updateConfig(patch: UpdateScanSchedulerDto): Promise<ScanSchedulerConfigDto> {
    const merged: ScanSchedulerConfigDto = {
      ...this.config,
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
      ...(patch.cron !== undefined ? { cron: patch.cron.trim() } : {}),
      ...(patch.timezone !== undefined ? { timezone: patch.timezone.trim() || null } : {}),
      ...(patch.run_on_startup !== undefined ? { run_on_startup: patch.run_on_startup } : {}),
      ...(patch.requested_by !== undefined ? { requested_by: patch.requested_by.trim() } : {}),
      ...(patch.message !== undefined ? { message: patch.message.trim() } : {}),
      ...(patch.container_ids !== undefined
        ? {
            container_ids: patch.container_ids.map((value) => value.trim()).filter(Boolean)
          }
        : {})
    };

    if (!merged.cron || !cron.validate(merged.cron)) {
      throw new BadRequestException(`Invalid cron expression: ${merged.cron}`);
    }

    if (!merged.requested_by) {
      throw new BadRequestException("requested_by must not be empty");
    }

    if (!merged.message) {
      throw new BadRequestException("message must not be empty");
    }

    this.config = merged;
    await this.refreshSchedule(false);

    return this.getConfig();
  }

  async triggerNow(): Promise<void> {
    await this.enqueueIfNoPendingAutoTask();
  }

  private async refreshSchedule(triggerOnStartup: boolean): Promise<void> {
    this.stopTask();

    if (!this.config.enabled) {
      this.logger.log("Automatic scan task scheduler is disabled");
      return;
    }

    if (!cron.validate(this.config.cron)) {
      this.logger.error(`Invalid SCAN_TASK_SCHEDULER_CRON: ${this.config.cron}`);
      return;
    }

    if (triggerOnStartup) {
      await this.enqueueIfNoPendingAutoTask();
    }

    this.task = cron.schedule(
      this.config.cron,
      async () => {
        await this.enqueueIfNoPendingAutoTask();
      },
      {
        timezone: this.config.timezone ?? undefined
      }
    );

    this.logger.log(
      `Automatic scan task scheduler started (cron="${this.config.cron}", timezone="${this.config.timezone ?? "system"}")`
    );
  }

  private stopTask(): void {
    if (this.task) {
      this.task.stop();
      this.task = undefined;
    }
  }

  private async enqueueIfNoPendingAutoTask(): Promise<void> {
    try {
      const hasPendingAutoTask = await this.scanQueueService.hasPendingAutoTask();

      if (hasPendingAutoTask) {
        this.logger.log("Skipping auto enqueue: a pending AUTO_CRON task already exists");
        return;
      }

      const payload: CreateScanTaskDto = {
        mode: "AUTO_CRON",
        container_ids: this.config.container_ids.length > 0 ? this.config.container_ids : undefined,
        message: this.config.message
      };

      const task = await this.scanQueueService.createTask(payload, this.config.requested_by);
      this.logger.log(`Automatic scan task queued: ${String(task.id)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      this.logger.error(`Failed to enqueue automatic scan task: ${message}`);
    }
  }
}