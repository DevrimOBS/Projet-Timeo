import { IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  username!: string;

  @IsString()
  password!: string;

  // Optional one-time password for MFA/TOTP
  otp?: string;
}
