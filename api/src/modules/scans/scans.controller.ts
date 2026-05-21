import { Body, Controller, Inject, Post, UseGuards } from "@nestjs/common";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "../../common/enums/role.enum";
import { BasicAuthGuard } from "../../common/guards/basic-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CreateScanDto } from "./dto/create-scan.dto";
import { ScansService } from "./scans.service";

@Controller("api/scans")
@UseGuards(BasicAuthGuard, RolesGuard)
export class ScansController {
  constructor(@Inject(ScansService) private readonly scansService: ScansService) {}

  @Post()
  @Roles(Role.ADMIN, Role.AGENT)
  createScan(@Body() payload: CreateScanDto) {
    return this.scansService.createScan(payload);
  }
}
