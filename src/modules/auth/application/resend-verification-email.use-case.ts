import type { AuthProvider } from '@/core/contracts/auth-provider';

export class ResendVerificationEmailUseCase {
  constructor(private readonly authProvider: AuthProvider) {}

  async execute(email: string): Promise<void> {
    await this.authProvider.resendVerificationEmail(email);
  }
}
