import crypto from "crypto";

const PBKDF2_ITERATIONS = 210000;
const PBKDF2_KEY_LENGTH = 32;
const PBKDF2_DIGEST = "sha256";

export function hashPassword(password: string): string {
	const salt = crypto.randomBytes(16).toString("hex");
	const derived = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LENGTH, PBKDF2_DIGEST);
	return `pbkdf2$${PBKDF2_ITERATIONS}$${salt}$${derived.toString("hex")}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
	const parts = storedHash.split("$");
	if (parts.length !== 4 || parts[0] !== "pbkdf2") {
		return false;
	}

	const iterations = Number(parts[1]);
	const salt = parts[2];
	const expectedHex = parts[3];

	if (!Number.isFinite(iterations) || !salt || !expectedHex) {
		return false;
	}

	const actual = crypto.pbkdf2Sync(password, salt, iterations, expectedHex.length / 2, PBKDF2_DIGEST).toString("hex");
	const expected = Buffer.from(expectedHex, "hex");
	const received = Buffer.from(actual, "hex");

	if (expected.length !== received.length) {
		return false;
	}

	return crypto.timingSafeEqual(expected, received);
}