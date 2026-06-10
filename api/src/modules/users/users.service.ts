import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { DatabaseService } from "../../database/database.service";
import { Role } from "../../common/enums/role.enum";
import { hashPassword, verifyPassword } from "../../common/utils/password";
import speakeasy from "speakeasy";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

interface UserRow {
	id: string;
	username: string;
	password_hash: string;
	role: Role;
	is_active: boolean;
	created_at: string;
	updated_at: string;
	last_login_at: string | null;
	mfa_enabled: boolean;
	mfa_secret: string | null;
	mfa_pending_secret: string | null;
	mfa_recovery_codes: string[];
	mfa_configured_at: string | null;
}

export interface PublicUser {
	id: string;
	username: string;
	role: Role;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
	lastLoginAt: string | null;
	mfaEnabled: boolean;
	mfaConfiguredAt: string | null;
}

export interface AuthenticatedUser {
	id: string;
	username: string;
	role: Role;
	mfaEnabled: boolean;
	mfaSecret: string | null;
	mfaRecoveryCodes: string[];
}

export interface MfaSetupResponse {
	secret: string;
	otpauthUrl: string;
	recoveryCodes: string[];
}

@Injectable()
export class UsersService {
	constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

	async authenticate(username: string, password: string): Promise<AuthenticatedUser> {
		const normalizedUsername = username.trim()
		if (!normalizedUsername) {
			throw new UnauthorizedException("invalid credentials");
		}

		const user = await this.findByUsername(normalizedUsername);
		if (!user || !user.is_active) {
			throw new UnauthorizedException("invalid credentials");
		}

		if (!verifyPassword(password, user.password_hash)) {
			throw new UnauthorizedException("invalid credentials");
		}

		return {
			id: user.id,
			username: user.username,
			role: user.role,
			mfaEnabled: user.mfa_enabled,
			mfaSecret: user.mfa_secret,
			mfaRecoveryCodes: this.normalizeRecoveryCodes(user.mfa_recovery_codes)
		};
	}

	async markLoginSuccess(userId: string): Promise<void> {
		const user = await this.getExistingUser(userId);
		await this.db.query(`UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1`, [user.id]);
	}

	async listUsers(): Promise<PublicUser[]> {
		const result = await this.db.query<UserRow>(
			`SELECT id, username, password_hash, role, is_active, created_at, updated_at, last_login_at,
			        mfa_enabled, mfa_secret, mfa_pending_secret, mfa_recovery_codes, mfa_configured_at
			 FROM users
			 ORDER BY created_at ASC`
		);

		return result.rows.map((row) => this.toPublicUser(row));
	}

	async createUser(payload: CreateUserDto): Promise<PublicUser> {
		const username = payload.username.trim();
		const password = payload.password.trim();

		if (!username || !password) {
			throw new BadRequestException("invalid user data");
		}

		try {
			const result = await this.db.query<UserRow>(
				`INSERT INTO users (id, username, password_hash, role, is_active)
				 VALUES ($1, $2, $3, $4, $5)
				 RETURNING id, username, password_hash, role, is_active, created_at, updated_at, last_login_at,
				           mfa_enabled, mfa_secret, mfa_pending_secret, mfa_recovery_codes, mfa_configured_at`,
				[randomUUID(), username, hashPassword(password), payload.role, payload.is_active ?? true]
			);

			return this.toPublicUser(result.rows[0]);
		} catch (error) {
			this.throwIfConflict(error);
			throw error;
		}
	}

	async updateUser(userId: string, payload: UpdateUserDto): Promise<PublicUser> {
		const updates: string[] = [];
		const values: unknown[] = [];
		let index = 1;

		if (payload.username !== undefined) {
			if (!payload.username.trim()) {
				throw new BadRequestException("invalid user data");
			}
			updates.push(`username = $${index++}`);
			values.push(payload.username.trim());
		}
		if (payload.password !== undefined) {
			if (!payload.password.trim()) {
				throw new BadRequestException("invalid user data");
			}
			updates.push(`password_hash = $${index++}`);
			values.push(hashPassword(payload.password.trim()));
		}
		if (payload.role !== undefined) {
			updates.push(`role = $${index++}`);
			values.push(payload.role);
		}
		if (payload.is_active !== undefined) {
			updates.push(`is_active = $${index++}`);
			values.push(payload.is_active);
		}

		if (updates.length === 0) {
			const existing = await this.findById(userId);
			if (!existing) {
				throw new NotFoundException("User not found");
			}
			return this.toPublicUser(existing);
		}

		updates.push(`updated_at = NOW()`);
		values.push(userId);

		try {
			const result = await this.db.query<UserRow>(
				`UPDATE users
				 SET ${updates.join(", ")}
				 WHERE id = $${index}
				 RETURNING id, username, password_hash, role, is_active, created_at, updated_at, last_login_at,
				           mfa_enabled, mfa_secret, mfa_pending_secret, mfa_recovery_codes, mfa_configured_at`,
				values
			);

			if (result.rows.length === 0) {
				throw new NotFoundException("User not found");
			}

			return this.toPublicUser(result.rows[0]);
		} catch (error) {
			this.throwIfConflict(error);
			throw error;
		}
	}

	async getCurrentUser(userRef: string): Promise<PublicUser> {
		const user = await this.getExistingUser(userRef);
		return this.toPublicUser(user);
	}

	async beginMfaSetup(userRef: string): Promise<MfaSetupResponse> {
		const user = await this.getExistingUser(userRef);

		const secret = speakeasy.generateSecret({
			name: `NoviSec (${user.username})`,
			issuer: "NoviSec Docker Auditor",
			length: 32,
		});
		const recoveryCodes = this.generateRecoveryCodes();
		const hashedRecoveryCodes = recoveryCodes.map((code) => hashPassword(code));

		await this.db.query(
			`UPDATE users
			 SET mfa_pending_secret = $2,
			     mfa_recovery_codes = $3::jsonb,
			     updated_at = NOW()
			 WHERE id = $1`,
			[user.id, secret.base32, JSON.stringify(hashedRecoveryCodes)]
		);

		return {
			secret: secret.base32,
			otpauthUrl: secret.otpauth_url ?? "",
			recoveryCodes,
		};
	}

	async enableMfa(userRef: string, otp: string): Promise<PublicUser> {
		const user = await this.getExistingUser(userRef);

		const pendingSecret = user.mfa_pending_secret;
		if (!pendingSecret) {
			throw new BadRequestException("MFA setup has not been initialized");
		}

		if (!this.verifyTotp(pendingSecret, otp)) {
			throw new UnauthorizedException("invalid otp");
		}

		const result = await this.db.query<UserRow>(
			`UPDATE users
			 SET mfa_enabled = TRUE,
			     mfa_secret = mfa_pending_secret,
			     mfa_pending_secret = NULL,
			     mfa_configured_at = NOW(),
			     updated_at = NOW()
			 WHERE id = $1
			 RETURNING id, username, password_hash, role, is_active, created_at, updated_at, last_login_at,
			           mfa_enabled, mfa_secret, mfa_pending_secret, mfa_recovery_codes, mfa_configured_at`,
			[user.id]
		);

		return this.toPublicUser(result.rows[0]);
	}

	async disableMfa(userRef: string): Promise<PublicUser> {
		const user = await this.getExistingUser(userRef);
		const result = await this.db.query<UserRow>(
			`UPDATE users
			 SET mfa_enabled = FALSE,
			     mfa_secret = NULL,
			     mfa_pending_secret = NULL,
			     mfa_recovery_codes = '[]'::jsonb,
			     mfa_configured_at = NULL,
			     updated_at = NOW()
			 WHERE id = $1
			 RETURNING id, username, password_hash, role, is_active, created_at, updated_at, last_login_at,
			           mfa_enabled, mfa_secret, mfa_pending_secret, mfa_recovery_codes, mfa_configured_at`,
			[user.id]
		);

		if (result.rows.length === 0) {
			throw new NotFoundException("User not found");
		}

		return this.toPublicUser(result.rows[0]);
	}

	async disableOwnMfa(userRef: string, otp?: string, recoveryCode?: string): Promise<PublicUser> {
		const user = await this.getExistingUser(userRef);

		if (!user.mfa_enabled || !user.mfa_secret) {
			throw new BadRequestException("MFA is not enabled");
		}

		const verifiedByOtp = otp ? this.verifyTotp(user.mfa_secret, otp) : false;
		const verifiedByRecovery = recoveryCode ? await this.consumeRecoveryCode(user, recoveryCode) : false;

		if (!verifiedByOtp && !verifiedByRecovery) {
			throw new UnauthorizedException("invalid otp or recovery code");
		}

		return this.disableMfa(user.id);
	}

	async rotateRecoveryCodes(userRef: string, otp: string): Promise<{ recoveryCodes: string[] }> {
		const user = await this.getExistingUser(userRef);

		if (!user.mfa_enabled || !user.mfa_secret) {
			throw new BadRequestException("MFA is not enabled");
		}

		if (!this.verifyTotp(user.mfa_secret, otp)) {
			throw new UnauthorizedException("invalid otp");
		}

		const recoveryCodes = this.generateRecoveryCodes();
		const hashedRecoveryCodes = recoveryCodes.map((code) => hashPassword(code));

		await this.db.query(
			`UPDATE users SET mfa_recovery_codes = $2::jsonb, updated_at = NOW() WHERE id = $1`,
			[user.id, JSON.stringify(hashedRecoveryCodes)]
		);

		return { recoveryCodes };
	}

	async verifyLoginSecondFactor(user: AuthenticatedUser, otp?: string, recoveryCode?: string): Promise<void> {
		if (!user.mfaEnabled) {
			return;
		}

		if (otp && user.mfaSecret && this.verifyTotp(user.mfaSecret, otp)) {
			return;
		}

		if (recoveryCode) {
			const dbUser = await this.findById(user.id);
			if (dbUser && await this.consumeRecoveryCode(dbUser, recoveryCode)) {
				return;
			}
		}

		throw new UnauthorizedException("invalid credentials or otp");
	}

	async findByUsername(username: string): Promise<UserRow | null> {
		const result = await this.db.query<UserRow>(
			`SELECT id, username, password_hash, role, is_active, created_at, updated_at, last_login_at,
			        mfa_enabled, mfa_secret, mfa_pending_secret, mfa_recovery_codes, mfa_configured_at
			 FROM users
			 WHERE username = $1
			 LIMIT 1`,
			[username.trim()]
		);

		return result.rows[0] ?? null;
	}

	async findById(userId: string): Promise<UserRow | null> {
		const result = await this.db.query<UserRow>(
			`SELECT id, username, password_hash, role, is_active, created_at, updated_at, last_login_at,
			        mfa_enabled, mfa_secret, mfa_pending_secret, mfa_recovery_codes, mfa_configured_at
			 FROM users
			 WHERE id = $1
			 LIMIT 1`,
			[userId]
		);

		return result.rows[0] ?? null;
	}

	async findBySubject(subject: string): Promise<UserRow | null> {
		const normalized = subject.trim();
		if (!normalized) {
			return null;
		}

		const result = await this.db.query<UserRow>(
			`SELECT id, username, password_hash, role, is_active, created_at, updated_at, last_login_at,
			        mfa_enabled, mfa_secret, mfa_pending_secret, mfa_recovery_codes, mfa_configured_at
			 FROM users
			 WHERE id::text = $1 OR username = $1
			 LIMIT 1`,
			[normalized]
		);

		return result.rows[0] ?? null;
	}

	private toPublicUser(row: UserRow): PublicUser {
		return {
			id: row.id,
			username: row.username,
			role: row.role,
			isActive: row.is_active,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
			lastLoginAt: row.last_login_at,
			mfaEnabled: row.mfa_enabled,
			mfaConfiguredAt: row.mfa_configured_at
		};
	}

	private verifyTotp(secret: string, otp: string): boolean {
		return speakeasy.totp.verify({
			secret,
			encoding: "base32",
			token: otp.trim(),
			window: 1,
		});
	}

	private generateRecoveryCodes(): string[] {
		return Array.from({ length: 8 }, () => randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase());
	}

	private normalizeRecoveryCodes(value: unknown): string[] {
		if (Array.isArray(value)) {
			return value.filter((item): item is string => typeof item === "string");
		}

		return [];
	}

	private async consumeRecoveryCode(user: UserRow, recoveryCode: string): Promise<boolean> {
		const normalizedCode = recoveryCode.trim();
		if (!normalizedCode) {
			return false;
		}

		const hashes = this.normalizeRecoveryCodes(user.mfa_recovery_codes);
		const matchedIndex = hashes.findIndex((hash) => verifyPassword(normalizedCode, hash));
		if (matchedIndex < 0) {
			return false;
		}

		hashes.splice(matchedIndex, 1);
		await this.db.query(`UPDATE users SET mfa_recovery_codes = $2::jsonb, updated_at = NOW() WHERE id = $1`, [
			user.id,
			JSON.stringify(hashes)
		]);
		return true;
	}

	private async getExistingUser(userRef: string): Promise<UserRow> {
		const user = await this.findBySubject(userRef);
		if (!user) {
			throw new NotFoundException("User not found");
		}

		return user;
	}

	private throwIfConflict(error: unknown): void {
		const code = typeof error === "object" && error !== null ? (error as { code?: string }).code : undefined;
		if (code === "23505") {
			throw new ConflictException("username already exists");
		}
	}
}