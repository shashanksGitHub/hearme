import './load-env';
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { loadServerEnv } from '@hearme/config';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const env = loadServerEnv(process.env);
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Input validation is handled per-route with Zod schemas (see controllers),
  // so no global class-validator ValidationPipe is needed.
  app.enableCors({ origin: env.CORS_ORIGINS, credentials: true });

  // Render/most PaaS inject the port to bind via $PORT; fall back to API_PORT locally.
  const port = Number(process.env.PORT) || env.API_PORT;
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`${env.APP_NAME} api listening on :${port}`);
}

void bootstrap();
