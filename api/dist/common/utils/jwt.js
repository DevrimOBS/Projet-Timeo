"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signToken = signToken;
exports.verifyToken = verifyToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const secret = process.env.AUTH_JWT_SECRET ?? 'dev_jwt_secret';
const expiresIn = (process.env.AUTH_JWT_EXPIRES_IN ?? '8h');
function signToken(subject, role) {
    const payload = { sub: subject, role };
    return jsonwebtoken_1.default.sign(payload, secret, { expiresIn });
}
function verifyToken(token) {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        return decoded;
    }
    catch (err) {
        return null;
    }
}
exports.default = { signToken, verifyToken };
