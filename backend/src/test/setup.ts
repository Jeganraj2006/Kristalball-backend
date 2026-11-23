process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/kavach_test?schema=public';
process.env.CORS_ORIGIN ??= 'http://localhost:5173';
process.env.LOG_LEVEL ??= 'silent';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-that-is-long-enough-for-hs256';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-that-is-long-enough-for-hs256';
