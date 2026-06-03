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
const https = __importStar(require("https"));
const express_1 = require("express");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.use((0, express_1.json)({ limit: process.env.REQUEST_BODY_LIMIT ?? '25mb' }));
    app.use((0, express_1.urlencoded)({ extended: true, limit: process.env.REQUEST_BODY_LIMIT ?? '25mb' }));
    app.enableCors({ origin: process.env.CORS_ORIGIN ?? "*" });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true
    }));
    const port = Number(process.env.PORT ?? 3001);
    // HTTPS support (optional, for production)
    const useHttps = process.env.HTTPS_ENABLED === 'true';
    if (useHttps) {
        const pfxPath = process.env.HTTPS_PFX_FILE;
        const pfxPassword = process.env.HTTPS_PFX_PASSPHRASE;
        const keyPath = process.env.HTTPS_KEY_FILE;
        const certPath = process.env.HTTPS_CERT_FILE;
        let httpsOptions;
        if (pfxPath) {
            if (!fs.existsSync(pfxPath)) {
                throw new Error(`HTTPS certificate file not found: ${pfxPath}`);
            }
            httpsOptions = {
                pfx: fs.readFileSync(pfxPath),
                passphrase: pfxPassword
            };
        }
        else if (keyPath && certPath) {
            if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
                throw new Error(`HTTPS certificate files not found: ${keyPath} or ${certPath}`);
            }
            httpsOptions = {
                key: fs.readFileSync(keyPath),
                cert: fs.readFileSync(certPath)
            };
        }
        else {
            throw new Error('HTTPS_ENABLED=true but HTTPS_PFX_FILE or HTTPS_KEY_FILE/HTTPS_CERT_FILE not set');
        }
        await app.listen(port, '0.0.0.0');
        const httpAdapter = app.getHttpAdapter();
        const expressApp = httpAdapter.getInstance();
        const server = https.createServer(httpsOptions, expressApp);
        server.listen(port + 1, '0.0.0.0', () => {
            console.log(`🔒 HTTPS server running on https://localhost:${port + 1}`);
        });
        console.log(`✅ HTTP server running on http://localhost:${port}`);
    }
    else {
        await app.listen(port, '0.0.0.0');
        console.log(`✅ API server running on http://localhost:${port}`);
    }
}
void bootstrap();
