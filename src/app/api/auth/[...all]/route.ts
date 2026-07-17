import { toNextJsHandler } from 'better-auth/next-js';

import { auth } from '@/infra/auth/server';

export const { GET, POST } = toNextJsHandler(auth);
