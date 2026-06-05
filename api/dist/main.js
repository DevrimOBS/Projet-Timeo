"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
require("reflect-metadata");
const fs = __importStar(require("fs"));
const express = __importStar(require("express"));
function hasValidHttpsCertificate() {
    const pfxPath = process.env.HTTPS_PFX_FILE;
    const keyPath = process.env.HTTPS_KEY_FILE;
    const certPath = process.env.HTTPS_CERT_FILE;
    if (pfxPath) {
        return fs.existsSync(pfxPath);
    }
    if (keyPath && certPath) {
        return fs.existsSync(keyPath) && fs.existsSync(certPath);
    }
    return false;
}
function buildHttpsOptions() {
    const pfxPath = process.env.HTTPS_PFX_FILE;
    const pfxPassword = process.env.HTTPS_PFX_PASSPHRASE;
    const keyPath = process.env.HTTPS_KEY_FILE;
    const certPath = process.env.HTTPS_CERT_FILE;
    if (pfxPath) {
        if (!fs.existsSync(pfxPath)) {
            throw new Error(`HTTPS certificate file not found: ${pfxPath}`);
        }
        return {
            pfx: fs.readFileSync(pfxPath),
            passphrase: pfxPassword,
            minVersion: 'TLSv1.3'
        };
    }
    if (keyPath && certPath) {
        if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
            throw new Error(`HTTPS certificate files not found: ${keyPath} or ${certPath}`);
        }
        return {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certPath),
            minVersion: 'TLSv1.3'
        };
    }
    throw new Error('HTTPS_ENABLED=true but HTTPS_PFX_FILE or HTTPS_KEY_FILE/HTTPS_CERT_FILE not set');
}
async function bootstrap() {
    const useHttps = process.env.HTTPS_ENABLED === 'true';
    if (useHttps && !hasValidHttpsCertificate()) {
        throw new Error('HTTPS_ENABLED=true but certificate files are missing. Refusing to start without TLS.');
    }
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        bodyParser: false,
        httpsOptions: useHttps ? buildHttpsOptions() : undefined
    });
    const bodyLimit = process.env.API_BODY_LIMIT ?? "10mb";
    app.enableCors({ origin: process.env.CORS_ORIGIN ?? "*" });
    app.use(express.json({ limit: bodyLimit }));
    app.use(express.urlencoded({ extended: true, limit: bodyLimit }));
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true
    }));
    const port = Number(process.env.PORT ?? 3001);
    await app.listen(port, '0.0.0.0');
    console.log(`✅ API server running on ${useHttps ? 'https' : 'http'}://localhost:${port}`);
}
void bootstrap();
