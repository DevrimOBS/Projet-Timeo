import { Type } from "class-transformer";
import { IsArray, IsDateString, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from "class-validator";

export class CreateVulnerabilityDto {
  @IsString()
  cve!: string;

  @IsOptional()
  @IsString()
  cwe?: string;

  @IsString()
  packageName!: string;

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
}

export class CreateContainerScanDto {
  @IsString()
  containerId!: string;

  @IsString()
  name!: string;

  @IsString()
  image!: string;

  @IsString()
  status!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVulnerabilityDto)
  vulnerabilities!: CreateVulnerabilityDto[];
}

export class CreateScanDto {
  @IsString()
  agentId!: string;

  @IsDateString()
  startedAt!: string;

  @IsDateString()
  finishedAt!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateContainerScanDto)
  containers!: CreateContainerScanDto[];
}
