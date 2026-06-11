import { beforeAll, afterAll } from 'vitest';

// Test environment setup
beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  process.env.CLIENT_URL = 'http://localhost:5173';
  process.env.FRONTEND_URL = 'http://localhost:5173';
});

afterAll(() => {
  // Cleanup
});
