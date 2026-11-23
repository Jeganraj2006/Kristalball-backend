import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';

describe('health routes', () => {
  it('serves a liveness response without requiring PostgreSQL', async () => {
    const app = createApp({ databaseHealthCheck: { check: async () => undefined } });

    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.headers['x-request-id']).toBeDefined();
  });

  it('returns unavailable when PostgreSQL is not ready', async () => {
    const app = createApp({
      databaseHealthCheck: {
        check: async () => Promise.reject(new Error('connection refused')),
      },
    });

    const response = await request(app).get('/api/v1/ready');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('error');
  });

  it('returns the API error contract for unknown routes', async () => {
    const app = createApp({ databaseHealthCheck: { check: async () => undefined } });

    const response = await request(app).get('/api/v1/unknown');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.error.correlationId).toBeDefined();
  });
});
