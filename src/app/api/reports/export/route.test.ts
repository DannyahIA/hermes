import { describe, expect, it, vi } from 'vitest';

vi.mock('@/infra/auth/session', () => ({
  requireCurrentUserId: vi.fn().mockRejectedValue(new Error('redirect')),
}));

// The route imports Drizzle repositories, which open a real postgres
// connection and validate DATABASE_URL at module load. Stubbing the client
// keeps this test about the auth guard — and since the mock would throw if
// anything actually queried it, a passing test also proves the guard
// short-circuits before any repository is touched.
vi.mock('@/infra/database/client', () => ({
  get db(): never {
    throw new Error(
      'the database must not be reached on an unauthenticated request',
    );
  },
}));

describe('GET /api/reports/export', () => {
  it('returns 401 without touching any repository when the caller is not authenticated', async () => {
    const { GET } = await import('./route');
    const request = new Request(
      'http://localhost/api/reports/export?format=csv',
    ) as never;

    const response = await GET(request);

    expect(response.status).toBe(401);
  });
});
