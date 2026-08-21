/**
 * Hand-written, RFC-4180-ish CSV encode/decode — no external dependency
 * (per conventions.md's "menos dependências"). Only needs to be correct for
 * this app's own export format so import/export round-trips: comma field
 * separator, `"` quoting with `""` escaping, CRLF row separator.
 */

const NEEDS_QUOTING = /[",\r\n]/;

function escapeField(field: string): string {
  if (!NEEDS_QUOTING.test(field)) return field;
  return `"${field.replace(/"/g, '""')}"`;
}

/** Serializes rows of plain strings into a single CSV document (no trailing newline). */
export function buildCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeField).join(',')).join('\r\n');
}

/** Parses a CSV document back into rows of plain strings. Tolerates a leading UTF-8 BOM. */
export function parseCsv(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (char === '\r') {
      i += 1;
      continue;
    }
    if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }

    field += char;
    i += 1;
  }

  // A trailing line with no final newline still holds a field/row to flush.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}
