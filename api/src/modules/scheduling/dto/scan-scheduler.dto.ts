import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsOptional, IsString } from "class-validator";

export class UpdateScanSchedulerDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  cron?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  run_on_startup?: boolean;

  @IsOptional()
  @IsString()
  requested_by?: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  container_ids?: string[];
}

export interface ScanSchedulerConfigDto {
  enabled: boolean;
  cron: string;
  timezone: string | null;
  run_on_startup: boolean;
  requested_by: string;
  message: string;
  container_ids: string[];
}