import type { AuthProvider } from '@/core/contracts/auth-provider';

export interface SignInInput {
  email: string;
  password: string;
}

export class SignInUseCase {
  constructor(private readonly authProvider: AuthProvider) {}

  async execute(input: SignInInput): Promise<void> {
    await this.authProvider.signIn(input);
  }
}
