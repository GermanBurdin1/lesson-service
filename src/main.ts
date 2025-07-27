import 'reflect-metadata'; 
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: 'http://localhost:4200', // ou '*' si on autorise tout temporairement
  });
  await app.listen(process.env.PORT || 3000);

  // --- bloc pour afficher toutes les routes ---
  const server = app.getHttpServer();
  server._events.request._router.stack.forEach((r) => {
    if (r.route) {
      console.log('[ROUTE]', r.route.path);
    }
  });
  // --- fin du bloc ---
  // TODO : ajouter un health check endpoint
}
bootstrap();