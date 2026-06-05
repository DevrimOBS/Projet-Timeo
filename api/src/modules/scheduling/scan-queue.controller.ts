import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, Req, Res, UseGuards } from "@nestjs/common";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "../../common/enums/role.enum";
import { BasicAuthGuard } from "../../common/guards/basic-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { RequestWithUser } from "../../common/types/request-with-user";
import { UpdateScanSchedulerDto } from "./dto/scan-scheduler.dto";
import { CompleteScanTaskDto, CreateScanTaskDto } from "./dto/scan-task.dto";
import { ScanQueueService } from "./scan-queue.service";
import { ScanTaskSchedulerService } from "./scan-task-scheduler.service";

@Controller("api/scan-tasks")
@UseGuards(BasicAuthGuard, RolesGuard)
export class ScanQueueController {
  constructor(
    @Inject(ScanQueueService) private readonly scanQueueService: ScanQueueService,
    @Inject(ScanTaskSchedulerService) private readonly scanTaskSchedulerService: ScanTaskSchedulerService
  ) {}

  @Post()
  @Roles(Role.ADMIN)
  createTask(@Body() payload: CreateScanTaskDto, @Req() request: RequestWithUser) {
    return this.scanQueueService.createTask(payload, request.user?.subject ?? "admin");
  }

  @Get()
  @Roles(Role.ADMIN, Role.VIEWER)
  listTasks() {
    return this.scanQueueService.listTasks();
  }

  @Get("scheduler-config")
  @Roles(Role.ADMIN, Role.VIEWER)
  getSchedulerConfig() {
    return this.scanTaskSchedulerService.getConfig();
  }

  @Post("scheduler-config")
  @Roles(Role.ADMIN)
  updateSchedulerConfig(@Body() payload: UpdateScanSchedulerDto) {
    return this.scanTaskSchedulerService.updateConfig(payload);
  }

  @Post("scheduler-trigger")
  @HttpCode(202)
  @Roles(Role.ADMIN)
  async triggerSchedulerNow() {
    await this.scanTaskSchedulerService.triggerNow();
    return { accepted: true };
  }

  @Post("claim")
  @HttpCode(200)
  @Roles(Role.AGENT)
  async claimTask(@Req() request: RequestWithUser, @Res({ passthrough: true }) response: any) {
    const task = await this.scanQueueService.claimNextTask(request.user?.subject ?? "agent");

    if (!task) {
      response.status(HttpStatus.NO_CONTENT);
      return;
    }

    return task;
  }

  @Post(":taskId/complete")
  @Roles(Role.AGENT)
  completeTask(
    @Param("taskId") taskId: string,
    @Body() payload: CompleteScanTaskDto,
    @Req() request: RequestWithUser
  ) {
    return this.scanQueueService.completeTask(taskId, request.user?.subject ?? "agent", payload);
  }
}