import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import 'reflect-metadata';
import * as fs from 'fs';
import * as https from 'https';

async function bootstrap(): Promise<void> {
	const app = await NestFactory.create(AppModule);

	app.enableCors({ origin: process.env.CORS_ORIGIN ?? "*" });
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
		const keyPath = process.env.HTTPS_KEY_FILE;
		const certPath = process.env.HTTPS_CERT_FILE;

		if (!keyPath || !certPath) {
			throw new Error('HTTPS_ENABLED=true but HTTPS_KEY_FILE or HTTPS_CERT_FILE not set');
		}

		if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
			throw new Error(`HTTPS certificate files not found: ${keyPath} or ${certPath}`);
		}

		const httpsOptions = {
			key: fs.readFileSync(keyPath),
			cert: fs.readFileSync(certPath),
		};

		await app.listen(port, 'localhost');
		const server = https.createServer(httpsOptions, app.getHttpServer());
		server.listen(port + 1, () => {
			console.log(`🔒 HTTPS server running on https://localhost:${port + 1}`);
		});
		console.log(`✅ HTTP server running on http://localhost:${port}`);
	} else {
		await app.listen(port);
		console.log(`✅ API server running on http://localhost:${port}`);
	}
}

void bootstrap();
