import { IsOptional, IsString } from "class-validator";

export class DisableMfaDto {
	@IsOptional()
	@IsString()
	otp?: string;

	@IsOptional()
	@IsString()
	recoveryCode?: string;
}