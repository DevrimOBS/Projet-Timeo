import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import 'reflect-metadata';
import * as fs from 'fs';
import * as https from 'https';
import * as express from "express";

async function bootstrap(): Promise<void> {
	const app = await NestFactory.create(AppModule, { bodyParser: false });
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

	// HTTPS support (optional, for production)
	const useHttps = process.env.HTTPS_ENABLED === 'true';
	
	if (useHttps) {
		const pfxPath = process.env.HTTPS_PFX_FILE;
		const pfxPassword = process.env.HTTPS_PFX_PASSPHRASE;
		const keyPath = process.env.HTTPS_KEY_FILE;
		const certPath = process.env.HTTPS_CERT_FILE;

		let httpsOptions: { pfx?: Buffer; passphrase?: string; key?: Buffer; cert?: Buffer };

		if (pfxPath) {
			if (!fs.existsSync(pfxPath)) {
				throw new Error(`HTTPS certificate file not found: ${pfxPath}`);
			}
			httpsOptions = {
				pfx: fs.readFileSync(pfxPath),
				passphrase: pfxPassword
			};
		} else if (keyPath && certPath) {
			if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
				throw new Error(`HTTPS certificate files not found: ${keyPath} or ${certPath}`);
			}
			httpsOptions = {
				key: fs.readFileSync(keyPath),
				cert: fs.readFileSync(certPath)
			};
		} else {
			throw new Error('HTTPS_ENABLED=true but HTTPS_PFX_FILE or HTTPS_KEY_FILE/HTTPS_CERT_FILE not set');
		}

		await app.listen(port, '0.0.0.0');
		const httpAdapter = app.getHttpAdapter().getInstance();
		const expressApp = httpAdapter.getInstance();
		const server = https.createServer(httpsOptions, expressApp);
		server.listen(port + 1, '0.0.0.0', () => {
			console.log(`🔒 HTTPS server running on https://localhost:${port + 1}`);
		});
		console.log(`✅ HTTP server running on http://localhost:${port}`);
	} else {
		await app.listen(port, '0.0.0.0');
		console.log(`✅ API server running on http://localhost:${port}`);
	}
}

void bootstrap();
