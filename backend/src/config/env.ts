import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));

dotenv.config({
  path: process.env.ENV_FILE ?? `${projectRoot}.env`,
});

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.url(),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
});

const parsedEnvironment = environmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  const invalidKeys = parsedEnvironment.error.issues.map((issue) => issue.path.join('.'));
  throw new Error(`Invalid environment configuration: ${invalidKeys.join(', ')}`);
}

export const env = {
  ...parsedEnvironment.data,
  CORS_ORIGINS: parsedEnvironment.data.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
};
