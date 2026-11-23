import { disconnectDatabase, checkDatabaseConnection } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

try {
  await checkDatabaseConnection();
  logger.info('PostgreSQL connectivity verified');
} finally {
  await disconnectDatabase();
}
