import { Module } from "@nestjs/common";
import { CveUpdaterService } from "./cve-updater.service";

@Module({
  providers: [CveUpdaterService]
})
export class SchedulingModule {}
