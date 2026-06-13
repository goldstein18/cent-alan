import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get()
  getHealth() {
    return {
      status: 'ok',
      message: 'CENT API is running',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    };
  }

  @Get('health')
  getHealthCheck() {
    return {
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
