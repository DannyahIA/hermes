export class Currency {
  constructor(public readonly code: string) {
    if (!/^[A-Z]{3}$/.test(code)) {
      throw new Error('Currency code must be a three-letter ISO code.');
    }
  }
}
