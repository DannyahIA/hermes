export interface SignUpInput {
  name: string;
  email: string;
  password: string;
}

export interface SignInInput {
  email: string;
  password: string;
}

/**
 * Abstracts credential/session management away from whichever library
 * implements it (today: better-auth). `modules/auth` depends only on this
 * contract, never on better-auth directly — per architecture.md's
 * "Infrastructure is Replaceable" rule.
 */
export interface AuthProvider {
  signUp(input: SignUpInput): Promise<{ userId: string }>;
  signIn(input: SignInInput): Promise<void>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  resendVerificationEmail(email: string): Promise<void>;
}
