import { Type } from "class-transformer";
import { IsArray, IsDateString, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from "class-validator";

export class CreateVulnerabilityDto {
  @IsString()
  cve!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cwe?: string[];

  @IsString()
  package_name!: string;

  @IsOptional()
  @IsString()
  installedVersion?: string;

  @IsOptional()
  @IsString()
  fixedVersion?: string;

  @IsNumber()
  @Min(0)
  @Max(10)
  cvss!: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  remediation?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  source?: string;
}

export class CreateContainerScanDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsString()
  image!: string;

  @IsString()
  status!: string;

  @IsOptional()
  @IsDateString()
  created_at?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVulnerabilityDto)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVulnerabilityDto)
  vulnerabilities?: CreateVulnerabilityDto[];
}

export class CreateSummaryDto {
  @IsNumber()
  @Min(0)
  total_containers!: number;

  @IsNumber()
  @Min(0)
  healthy_containers!: number;

  @IsNumber()
  @Min(0)
  vulnerable_containers!: number;

  @IsNumber()
  @Min(0)
  total_vulnerabilities!: number;

  @IsNumber()
  @Min(0)
  @Max(10)
  global_risk_score!: number;
}

export class CreateScanDto {
  @IsString()
  agent_id!: string;

  @IsDateString()
  timestamp!: string;

  @IsString()
  scan_type!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateContainerScanDto)
  containers!: CreateContainerScanDto[];

  @ValidateNested()
  @Type(() => CreateSummaryDto)
  summary!: CreateSummaryDto;
}
