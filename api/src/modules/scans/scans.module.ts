import { Module } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { BasicAuthGuard } from "../../common/guards/basic-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { ScansController } from "./scans.controller";
import { ScansService } from "./scans.service";

@Module({
  controllers: [ScansController],
  providers: [ScansService, Reflector, BasicAuthGuard, RolesGuard],
  exports: [ScansService]
})
export class ScansModule {}
