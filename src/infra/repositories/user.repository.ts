export interface UserRepository {
  findByEmail(email: string): Promise<unknown>;
  create(user: Record<string, unknown>): Promise<unknown>;
}
