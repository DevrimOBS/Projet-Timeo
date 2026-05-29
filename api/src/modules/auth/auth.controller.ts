import { Body, Controller, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { signToken } from '../../common/utils/jwt';
import { Role } from '../../common/enums/role.enum';
import speakeasy from 'speakeasy';

interface LoginResponse {
  token: string;
  expiresIn: string;
}

@Controller('api/auth')
export class AuthController {
  @Post('login')
  @HttpCode(200)
  login(@Body() payload: LoginDto): LoginResponse {
    const username = payload.username?.trim();
    const password = payload.password?.trim();

    // Basic local user check using environment variables (dev-mode)
    const adminUser = process.env.ADMIN_USER ?? 'admin';
    const adminPass = process.env.ADMIN_PASSWORD ?? 'admin-pass';

    const viewerUser = process.env.VIEWER_USER ?? 'viewer';
    const viewerPass = process.env.VIEWER_PASSWORD ?? 'viewer-pass';

    const agentUser = process.env.AGENT_USER ?? 'agent';
    const agentPass = process.env.AGENT_PASSWORD ?? 'agent-pass';

    if (username === adminUser && password === adminPass) {
      // If MFA is enabled, require OTP verification
      if (process.env.AUTH_MFA_ENABLED === 'true') {
        const secret = process.env.ADMIN_MFA_SECRET;
        if (!secret || !payload.otp || !speakeasy.totp.verify({ secret, encoding: 'base32', token: payload.otp })) {
          throw new UnauthorizedException('invalid credentials or otp');
        }
      }
      const token = signToken('admin', Role.ADMIN);
      return { token, expiresIn: process.env.AUTH_JWT_EXPIRES_IN ?? '8h' };
    }

    if (username === viewerUser && password === viewerPass) {
      if (process.env.AUTH_MFA_ENABLED === 'true') {
        const secret = process.env.VIEWER_MFA_SECRET;
        if (!secret || !payload.otp || !speakeasy.totp.verify({ secret, encoding: 'base32', token: payload.otp })) {
          throw new UnauthorizedException('invalid credentials or otp');
        }
      }
      const token = signToken('viewer', Role.VIEWER);
      return { token, expiresIn: process.env.AUTH_JWT_EXPIRES_IN ?? '8h' };
    }

    if (username === agentUser && password === agentPass) {
      if (process.env.AUTH_MFA_ENABLED === 'true') {
        const secret = process.env.AGENT_MFA_SECRET;
        if (!secret || !payload.otp || !speakeasy.totp.verify({ secret, encoding: 'base32', token: payload.otp })) {
          throw new UnauthorizedException('invalid credentials or otp');
        }
      }
      const token = signToken('agent', Role.AGENT);
      return { token, expiresIn: process.env.AUTH_JWT_EXPIRES_IN ?? '8h' };
    }

    throw new UnauthorizedException('invalid credentials');
  }
}
