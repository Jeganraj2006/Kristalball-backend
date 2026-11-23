import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

export const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === 'development'
      ? [
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'error' },
        ]
      : [{ emit: 'event', level: 'error' }],
});

prisma.$on('warn', (event) => {
  logger.warn({ prisma: event }, 'Prisma warning');
});

prisma.$on('error', (event) => {
  logger.error({ prisma: event }, 'Prisma error');
});

export async function checkDatabaseConnection(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
