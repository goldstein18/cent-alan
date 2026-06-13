import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);

    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:8081',
      process.env.ADMIN_FRONTEND_URL,
      process.env.POS_FRONTEND_URL,
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:8081',
    ].filter(Boolean) as string[];

    app.use((req, res, next) => {
      if (req.method === 'OPTIONS') {
        const origin = req.headers.origin;
        const normalizedOrigin = origin ? origin.replace(/\/$/, '') : '';
        const isAllowed = !origin || allowedOrigins.some(allowed => allowed.replace(/\/$/, '') === normalizedOrigin);

        if (isAllowed) {
          res.setHeader('Access-Control-Allow-Origin', origin || '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Cache-Control, Accept, Origin');
          res.setHeader('Access-Control-Max-Age', '86400');
          res.setHeader('Access-Control-Allow-Credentials', 'true');
          return res.status(204).send();
        }
      }
      next();
    });

    app.enableCors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);

        const normalizedOrigin = origin.replace(/\/$/, '');
        const isAllowed = allowedOrigins.some(allowed => allowed.replace(/\/$/, '') === normalizedOrigin);
        if (isAllowed) return callback(null, true);

        return callback(new Error('Not allowed by CORS'), false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cache-Control', 'Accept', 'Origin'],
      exposedHeaders: ['Authorization', 'Content-Type'],
      preflightContinue: false,
      optionsSuccessStatus: 204,
      maxAge: 86400,
    });

    app.use(helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false,
    }));

    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));

    const config = new DocumentBuilder()
      .setTitle('CENT API')
      .setDescription('API para la aplicación financiera CENT')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    const port = process.env.PORT || 3001;
    await app.listen(port, '0.0.0.0');
  } catch (error) {
    console.error('Error starting API:', error);
    process.exit(1);
  }
}

bootstrap();
