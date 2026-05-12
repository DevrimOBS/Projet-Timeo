import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "../../common/enums/role.enum";
import { BasicAuthGuard } from "../../common/guards/basic-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { ReportsService } from "./reports.service";

@Controller("api/reports")
@UseGuards(BasicAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.VIEWER)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("overview")
  getOverview() {
    return this.reportsService.getOverview();
  }

  @Get("matrix")
  getMatrix() {
    return this.reportsService.getMatrix();
  }

  @Get("details/:containerId")
  getContainerDetails(@Param("containerId") containerId: string) {
    return this.reportsService.getContainerDetails(containerId);
  }
}
