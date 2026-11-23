import pino from 'pino';
import { env } from '../config/env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.token',
      'req.body.refreshToken',
      'authorization',
      'password',
      'token',
      'refreshToken',
    ],
    censor: '[REDACTED]',
  },
  base: null,
  timestamp: pino.stdTimeFunctions.isoTime,
});
