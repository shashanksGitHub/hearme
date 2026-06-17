import './load-env';
import 'reflect-metadata';
import * as Sentry from '@sentry/node';
import { Logger } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { loadServerEnv } from '@hearme/config';
import { AppModule } from './app.module';
import { SentryExceptionFilter } from './common/sentry/sentry.filter';

async function bootstrap(): Promise<void> {
  const env = loadServerEnv(process.env);

  // Error monitoring — no-ops if SENTRY_DSN is unset.
  if (env.SENTRY_DSN) {
    Sentry.init({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV, tracesSampleRate: 0 });
  }

  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Input validation is handled per-route with Zod schemas (see controllers),
  // so no global class-validator ValidationPipe is needed.
  if (env.API_GLOBAL_PREFIX) app.setGlobalPrefix(env.API_GLOBAL_PREFIX);
  app.enableCors({ origin: env.CORS_ORIGINS, credentials: true });

  // Capture unexpected errors in Sentry (only active when DSN is set).
  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new SentryExceptionFilter(httpAdapter));

  // Render/most PaaS inject the port to bind via $PORT; fall back to API_PORT locally.
  const port = Number(process.env.PORT) || env.API_PORT;
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`${env.APP_NAME} api listening on :${port}`);
}

void bootstrap();
