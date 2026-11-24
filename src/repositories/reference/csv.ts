/* A CSV reader for the vendored reference datasets (RFC 4180: fields may be quoted, a quoted
   field may hold commas, line breaks and doubled quotes). Every row becomes a record keyed by
   the header; nothing is converted here. */

export type CsvRow = Record<string, string>;

export function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < body.length; i++) {
    const char = body[i];
    if (quoted) {
      if (char === '"') {
        if (body[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && body[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...records] = rows.filter((cells) => !(cells.length === 1 && cells[0] === ""));
  if (!header) return [];
  return records.map((cells) => Object.fromEntries(header.map((name, index) => [name, cells[index] ?? ""])));
}

/** A blank field is null, never 0. */
export function numberOrNull(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`Not a number: "${value}"`);
  return number;
}

export const textOrNull = (value: string | undefined): string | null => (value === undefined || value.trim() === "" ? null : value);
