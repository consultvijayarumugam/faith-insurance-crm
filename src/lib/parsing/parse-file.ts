import Papa from "papaparse";

export interface ParsedFile {
  headers: string[];
  rows: Record<string, string>[];
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function parseCsv(file: File): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = (results.meta.fields ?? []).filter(Boolean);
        const rows = results.data.map((row) => {
          const normalized: Record<string, string> = {};
          headers.forEach((h) => {
            normalized[h] = cellToString(row[h]);
          });
          return normalized;
        });
        resolve({ headers, rows });
      },
      error: (err: Error) => reject(err),
    });
  });
}

async function parseExcel(file: File): Promise<ParsedFile> {
  // Dynamically imported so the (client-only) xlsx parser is never pulled
  // into a server bundle and only loads when someone actually uploads an
  // Excel file.
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return { headers: [], rows: [] };

  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  const headers = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];
  const rows = rawRows.map((row) => {
    const normalized: Record<string, string> = {};
    headers.forEach((h) => {
      normalized[h] = cellToString(row[h]);
    });
    return normalized;
  });

  return { headers, rows };
}

export async function parseLeadsFile(file: File): Promise<ParsedFile> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    return parseCsv(file);
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    return parseExcel(file);
  }
  throw new Error(
    "Unsupported file type. Please upload a .csv, .xlsx, or .xls file."
  );
}

const FIELD_ALIASES: Record<string, string[]> = {
  name: ["name", "full name", "customer name", "lead name"],
  mobile_number: ["mobile", "mobile number", "phone", "phone number", "contact"],
  email: ["email", "email address"],
  product_pitched: ["product", "product pitched", "policy type", "insurance type"],
  value: ["value", "premium", "amount", "sum assured"],
  lead_status: ["status", "lead status", "stage"],
  policy_start_date: ["policy start", "policy start date", "start date"],
  policy_end_date: ["policy end", "policy end date", "end date"],
};

export type LeadField = keyof typeof FIELD_ALIASES;

/** Best-effort auto-mapping of uploaded column headers to lead fields, so
 * the admin usually only has to confirm rather than map from scratch. */
export function guessColumnMapping(
  headers: string[]
): Record<LeadField, string> {
  const mapping = {} as Record<LeadField, string>;

  (Object.keys(FIELD_ALIASES) as LeadField[]).forEach((field) => {
    const aliases = FIELD_ALIASES[field];
    const match = headers.find((h) => aliases.includes(h.trim().toLowerCase()));
    mapping[field] = match ?? "";
  });

  return mapping;
}
