import 'reflect-metadata'; 
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: 'http://localhost:4200', // или '*' если временно разрешаешь всё
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