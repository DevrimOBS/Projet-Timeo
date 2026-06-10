import { Controller, Get, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "../../common/enums/role.enum";
import { BasicAuthGuard } from "../../common/guards/basic-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { RequestWithUser } from "../../common/types/request-with-user";
import { ReportsService } from "./reports.service";

@Controller("api/reports")
@UseGuards(BasicAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.VIEWER)
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reportsService: ReportsService) {}

  @Get("overview")
  getOverview() {
    return this.reportsService.getOverview();
  }

  @Get("matrix")
  getMatrix() {
    return this.reportsService.getMatrix();
  }

  @Get("containers")
  getContainers() {
    return this.reportsService.getContainers();
  }

  @Get("details/:containerId")
  getContainerDetails(@Param("containerId") containerId: string) {
    return this.reportsService.getContainerDetails(containerId);
  }

  @Get("alerts")
  listAlerts() {
    return this.reportsService.listAlerts();
  }

  @Post("alerts/:alertId/ack")
  @Roles(Role.ADMIN)
  acknowledgeAlert(@Param("alertId") alertId: string, @Req() request: RequestWithUser) {
    return this.reportsService.acknowledgeAlert(alertId, request.user?.subject ?? "admin");
  }
}
