import { IsArray, IsIn, IsOptional, IsString } from "class-validator";

const TASK_MODES = ["MANUAL_GLOBAL", "MANUAL_TARGET", "AUTO_CRON"] as const;
const TASK_STATUSES = ["queued", "processing", "completed", "failed"] as const;

export class CreateScanTaskDto {
  @IsIn(TASK_MODES)
  mode!: (typeof TASK_MODES)[number];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  container_ids?: string[];

  @IsOptional()
  @IsString()
  message?: string;
}

export class CompleteScanTaskDto {
  @IsOptional()
  @IsString()
  scan_id?: string;

  @IsIn(TASK_STATUSES)
  status!: (typeof TASK_STATUSES)[number];

  @IsOptional()
  @IsString()
  message?: string;
}