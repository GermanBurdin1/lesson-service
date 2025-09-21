import 'reflect-metadata'; 
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Глобальная валидация входных данных
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));
  
  app.enableCors({
    origin: 'http://localhost:4200', // или '*' если временно разрешаешь всё
  });
  
  // Добавляем middleware для логирования всех запросов
  app.use((req, res, next) => {
    console.log('📡 ВХОДЯЩИЙ ЗАПРОС:', req.method, req.url);
    next();
  });
  
  await app.listen(process.env.PORT || 3000);

  // --- Добавь этот блок для вывода всех роутов ---
  const server = app.getHttpServer();
  server._events.request._router.stack.forEach((r) => {
    if (r.route) {
      console.log('[ROUTE]', r.route.path);
    }
  });
  // --- Конец блока ---
}
bootstrap();