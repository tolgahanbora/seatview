import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const DEFAULT_CORS_ORIGINS = [
  'http://127.0.0.1:4173',
  'http://localhost:4173',
  'http://127.0.0.1:5174',
  'http://localhost:5174',
  'http://127.0.0.1:4280',
  'http://localhost:4280',
];

function corsOrigins(): string[] {
  const extra =
    process.env.SEATVIEW_CORS_ORIGINS?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  return [...new Set([...DEFAULT_CORS_ORIGINS, ...extra])];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: corsOrigins(),
    allowedHeaders: [
      'Content-Type',
      'X-Business-Api-Key',
      'X-Seatview-Environment',
      'Authorization',
    ],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.SEATVIEW_LISTEN_HOST ?? '127.0.0.1';
  await app.listen(port, host);
}

bootstrap();
