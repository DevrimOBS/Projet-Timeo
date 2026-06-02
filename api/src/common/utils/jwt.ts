import jwt, { SignOptions } from 'jsonwebtoken';

export interface JwtPayload {
  sub: string;
  role: string;
}

const secret = process.env.AUTH_JWT_SECRET ?? 'dev_jwt_secret';
const expiresIn = (process.env.AUTH_JWT_EXPIRES_IN ?? '8h') as SignOptions['expiresIn'];

export function signToken(subject: string, role: string): string {
  const payload: JwtPayload = { sub: subject, role };
  return jwt.sign(payload, secret, { expiresIn });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;
    return decoded;
  } catch (err) {
    return null;
  }
}

export default { signToken, verifyToken };
