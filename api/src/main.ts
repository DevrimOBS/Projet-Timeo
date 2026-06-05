import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import 'reflect-metadata';
import * as fs from 'fs';
import * as express from "express";

type AppHttpsOptions = {
	pfx?: Buffer;
	passphrase?: string;
	key?: Buffer;
	cert?: Buffer;
	minVersion: 'TLSv1.3';
};

function hasValidHttpsCertificate(): boolean {
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

function buildHttpsOptions(): AppHttpsOptions {
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

async function bootstrap(): Promise<void> {
	const useHttps = process.env.HTTPS_ENABLED === 'true';

	if (useHttps && !hasValidHttpsCertificate()) {
		throw new Error('HTTPS_ENABLED=true but certificate files are missing. Refusing to start without TLS.');
	}

	const app = await NestFactory.create(AppModule, {
		bodyParser: false,
		httpsOptions: useHttps ? buildHttpsOptions() : undefined
	});
	const bodyLimit = process.env.API_BODY_LIMIT ?? "10mb";

	app.enableCors({ origin: process.env.CORS_ORIGIN ?? "*" });
	app.use(express.json({ limit: bodyLimit }));
	app.use(express.urlencoded({ extended: true, limit: bodyLimit }));
	app.useGlobalPipes(
		new ValidationPipe({
			whitelist: true,
			forbidNonWhitelisted: true,
			transform: true
		})
	);

	const port = Number(process.env.PORT ?? 3001);
	await app.listen(port, '0.0.0.0');
	console.log(`✅ API server running on ${useHttps ? 'https' : 'http'}://localhost:${port}`);
}

void bootstrap();
