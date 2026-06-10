import { BadRequestException, Body, Controller, HttpCode, Inject, Post, Req, UsePipes, ValidationPipe } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { LoginDto } from './dto/login.dto';
import { signToken } from '../../common/utils/jwt';
import { UsersService } from '../users/users.service';

interface LoginResponse {
  token: string;
  expiresIn: string;
}

@Controller('api/auth')
export class AuthController {
  private readonly usersService: UsersService;

  constructor(@Inject(UsersService) usersService: UsersService) {
    this.usersService = usersService;
  }

  @Post('login')
  @HttpCode(200)
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  )
  @Throttle({
    default: {
      ttl: Number(process.env.AUTH_LOGIN_RATE_LIMIT_TTL_MS ?? 60_000),
      limit: Number(process.env.AUTH_LOGIN_RATE_LIMIT_LIMIT ?? 20),
      getTracker: (req: Record<string, unknown>) => {
        const ip = String((req.ip as string | undefined) ?? (req.ips as string[] | undefined)?.[0] ?? 'unknown');
        const body = (req.body as Record<string, unknown> | undefined) ?? {};
        const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : 'anonymous';
        return `${ip}:${username}`;
      }
    }
  })
  async login(@Body() payload: LoginDto, @Req() req: Request): Promise<LoginResponse> {
    const allowedKeys = new Set(['username', 'password', 'otp', 'recoveryCode']);
    const incomingBody = (req.body ?? {}) as Record<string, unknown>;
    const unexpectedFields = Object.keys(incomingBody).filter((key) => !allowedKeys.has(key));
    if (unexpectedFields.length > 0) {
      throw new BadRequestException(`Unexpected fields: ${unexpectedFields.join(', ')}`);
    }

    const user = await this.usersService.authenticate(payload.username, payload.password);

    await this.usersService.verifyLoginSecondFactor(user, payload.otp, payload.recoveryCode);

    await this.usersService.markLoginSuccess(user.id);

    const token = signToken(user.username, user.role);
    return { token, expiresIn: process.env.AUTH_JWT_EXPIRES_IN ?? '8h' };
  }
}
