import { IsString } from "class-validator";

export class RotateRecoveryCodesDto {
	@IsString()
	otp!: string;
}