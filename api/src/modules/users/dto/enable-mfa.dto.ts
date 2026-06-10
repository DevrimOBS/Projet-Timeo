import { IsString } from "class-validator";

export class EnableMfaDto {
	@IsString()
	otp!: string;
}