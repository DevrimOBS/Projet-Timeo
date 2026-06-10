import { Body, Controller, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { signToken } from '../../common/utils/jwt';
import { UsersService } from '../users/users.service';

interface LoginResponse {
  token: string;
  expiresIn: string;
}

@Controller('api/auth')
export class AuthController {
  constructor(private readonly usersService: UsersService) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() payload: LoginDto): Promise<LoginResponse> {
    const user = await this.usersService.authenticate(payload.username, payload.password);

    await this.usersService.verifyLoginSecondFactor(user, payload.otp, payload.recoveryCode);

    await this.usersService.markLoginSuccess(user.id);

    const token = signToken(user.username, user.role);
    return { token, expiresIn: process.env.AUTH_JWT_EXPIRES_IN ?? '8h' };
  }
}
