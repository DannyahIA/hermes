const SPACES = /[\s  ]+/g;
const LEADING_SIGN = /^([+-])\s*/;
const CURRENCY = /^r\$\s*/i;

function toCents(value: number): number {
  // `|| 0` turns -0 into 0.
  return Math.round(value * 100) / 100 || 0;
}

/** "1.234.567" with "." — the first group has 1 to 3 digits, the rest 3. */
function isGrouped(digits: string, separator: string): boolean {
  const [first, ...rest] = digits.split(separator);
  return (
    /^\d{1,3}$/.test(first) &&
    rest.length > 0 &&
    rest.every((group) => /^\d{3}$/.test(group))
  );
}

/**
 * Reads an amount the way a person in Brazil writes it, or the way the
 * iPhone's Wallet hands it over: "R$ 1.234,56", "32,50", "32", and also a
 * decimal point ("1234.56", "23.9") or a plain number. When both "." and ","
 * appear, the last one is the decimal separator. A lone separator followed
 * by three digits groups thousands — "1.234" is 1234 — except a comma,
 * since "32,505" could be either 32.505 or 32505: that, like anything
 * else unreadable, is null. The sign is kept; the result is in cents
 * precision.
 */
export function parseAmount(input: string | number): number | null {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? toCents(input) : null;
  }

  let text = input.replace(SPACES, ' ').trim();
  let sign = 1;
  const signed = LEADING_SIGN.exec(text);
  if (signed) {
    sign = signed[1] === '-' ? -1 : 1;
    text = text.slice(signed[0].length);
  }
  text = text.replace(CURRENCY, '');
  if (!/^\d[\d.,]*$/.test(text)) return null;

  let integerPart = text;
  let decimalPart = '';
  const lastDot = text.lastIndexOf('.');
  const lastComma = text.lastIndexOf(',');

  if (lastDot >= 0 && lastComma >= 0) {
    const decimal = lastDot > lastComma ? '.' : ',';
    const thousands = decimal === '.' ? ',' : '.';
    const at = text.lastIndexOf(decimal);
    const whole = text.slice(0, at);
    if (whole.includes(decimal) || !isGrouped(whole, thousands)) return null;
    integerPart = whole.split(thousands).join('');
    decimalPart = text.slice(at + 1);
  } else if (lastDot >= 0 || lastComma >= 0) {
    const separator = lastDot >= 0 ? '.' : ',';
    const parts = text.split(separator);
    if (parts.length > 2) {
      if (!isGrouped(text, separator)) return null;
      integerPart = parts.join('');
    } else if (parts[1].length === 3) {
      if (separator === ',' || !isGrouped(text, separator)) return null;
      integerPart = parts.join('');
    } else {
      // "32,5", "23.9", or "12," halfway through typing "12,50".
      [integerPart, decimalPart] = parts;
    }
  }

  if (!/^\d+$/.test(integerPart) || !/^\d{0,2}$/.test(decimalPart)) {
    return null;
  }
  return toCents(sign * Number(`${integerPart}.${decimalPart || '0'}`));
}
