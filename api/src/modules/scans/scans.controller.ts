import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "../../common/enums/role.enum";
import { BasicAuthGuard } from "../../common/guards/basic-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CreateScanDto } from "./dto/create-scan.dto";
import { ScansService } from "./scans.service";

@Controller("api/scans")
@UseGuards(BasicAuthGuard, RolesGuard)
export class ScansController {
  constructor(private readonly scansService: ScansService) {}

  @Post()
  @Roles(Role.ADMIN)
  createScan(@Body() payload: CreateScanDto) {
    return this.scansService.createScan(payload);
  }
}
