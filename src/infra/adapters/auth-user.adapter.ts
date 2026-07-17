import type { UserRepository } from '@/infra/repositories/user.repository';

export class AuthUserAdapter implements UserRepository {
  async findByEmail(email: string) {
    return { email, source: 'better-auth' };
  }

  async create(user: Record<string, unknown>) {
    return { ...user, source: 'better-auth' };
  }
}
