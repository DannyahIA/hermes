import type { AuthProvider } from '@/core/contracts/auth-provider';
import { Password } from '@/core/value-objects/password';

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
}

export class SignUpUseCase {
  constructor(private readonly authProvider: AuthProvider) {}

  async execute(input: SignUpInput): Promise<{ userId: string }> {
    // Throws ValidationError with a specific message before ever reaching
    // the network if the password doesn't meet the strength bar.
    new Password(input.password);

    return this.authProvider.signUp(input);
  }
}
