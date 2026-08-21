import type { AuthProvider } from '@/core/contracts/auth-provider';

export class SignOutUseCase {
  constructor(private readonly authProvider: AuthProvider) {}

  async execute(): Promise<void> {
    await this.authProvider.signOut();
  }
}
