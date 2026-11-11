import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: [
      'http://127.0.0.1:4173',
      'http://localhost:4173',
      'http://127.0.0.1:4280',
      'http://localhost:4280',
    ],
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
  await app.listen(port, '127.0.0.1');
}

bootstrap();
