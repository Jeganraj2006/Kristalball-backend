import { createApp } from './app.js';
import { env } from './config/env.js';
import { disconnectDatabase } from './lib/prisma.js';
import { logger } from './lib/logger.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, environment: env.NODE_ENV }, 'KAVACH API started');
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info({ signal }, 'Shutting down KAVACH API');
  server.close(async (closeError) => {
    if (closeError) {
      logger.error({ err: closeError }, 'HTTP server did not close cleanly');
      process.exitCode = 1;
    }

    await disconnectDatabase();
    process.exit();
  });
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
