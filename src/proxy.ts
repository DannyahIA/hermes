export { authMiddleware as proxy } from '@/infra/auth/middleware';

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
