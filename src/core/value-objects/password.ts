export class Password {
  constructor(public readonly value: string) {
    if (value.length < 8) {
      throw new Error('Password must contain at least 8 characters.');
    }
  }
}
