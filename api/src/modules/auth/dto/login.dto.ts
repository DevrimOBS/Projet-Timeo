import { IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  username!: string;

  @IsString()
  password!: string;

  // Optional one-time password for MFA/TOTP
  @IsOptional()
  @IsString()
  otp?: string;

  @IsOptional()
  @IsString()
  recoveryCode?: string;
}
