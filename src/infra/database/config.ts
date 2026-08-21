/**
 * Connection-pool tuning, kept separate from `client.ts` so it can be
 * imported (e.g. by tests) without triggering an eager Postgres connection.
 */
export const DATABASE_POOL_CONFIG = {
  /** Max simultaneous connections held by this process. */
  max: 10,
  /** Close idle connections after this many seconds. */
  idleTimeoutSeconds: 20,
} as const;
