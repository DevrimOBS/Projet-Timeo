import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import 'reflect-metadata';
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
	await app.listen(port);
}

void bootstrap();
