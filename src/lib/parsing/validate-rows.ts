import { makeBulkLeadRowSchema, type BulkLeadRow } from "@/lib/validations/lead";
import type { LeadField, ParsedFile } from "./parse-file";

export type ColumnMapping = Record<LeadField, string>;

export const REQUIRED_MAPPING_FIELDS: LeadField[] = ["name", "mobile_number"];

export type RowResult =
  | {
      status: "valid";
      rowNumber: number;
      data: BulkLeadRow;
      isDuplicate: boolean;
      duplicateReason?: string;
    }
  | {
      status: "invalid";
      rowNumber: number;
      preview: string;
      errors: string[];
    };

/** Pure categorization: every parsed row becomes exactly one RowResult, so
 * a handful of bad rows never blocks the rest from being previewed or
 * imported. `existingMobileNumbers` should already be restricted to numbers
 * that appear in this file (a targeted `.in()` lookup), not the whole table. */
export function buildRowResults(
  parsedFile: ParsedFile,
  mapping: ColumnMapping,
  existingMobileNumbers: Set<string>,
  validStatusNames: string[]
): RowResult[] {
  const bulkLeadRowSchema = makeBulkLeadRowSchema(validStatusNames);
  const seenInFile = new Map<string, number>();
  const results: RowResult[] = [];

  parsedFile.rows.forEach((row, index) => {
    const rowNumber = index + 2; // 1-based + header row

    const raw = {
      name: mapping.name ? (row[mapping.name] ?? "") : "",
      mobile_number: mapping.mobile_number ? (row[mapping.mobile_number] ?? "") : "",
      email: mapping.email ? (row[mapping.email] ?? "") : "",
      product_pitched: mapping.product_pitched
        ? (row[mapping.product_pitched] ?? "")
        : "",
      value: mapping.value ? (row[mapping.value] ?? "") : "",
      lead_status: mapping.lead_status ? (row[mapping.lead_status] ?? "") : "",
      policy_start_date: mapping.policy_start_date
        ? (row[mapping.policy_start_date] ?? "")
        : "",
      policy_end_date: mapping.policy_end_date
        ? (row[mapping.policy_end_date] ?? "")
        : "",
    };

    const isBlankRow = Object.values(raw).every((v) => v === "");
    if (isBlankRow) return;

    const parsed = bulkLeadRowSchema.safeParse(raw);
    if (!parsed.success) {
      results.push({
        status: "invalid",
        rowNumber,
        preview: raw.name || raw.mobile_number || "(empty row)",
        errors: Array.from(new Set(parsed.error.issues.map((i) => i.message))),
      });
      return;
    }

    const mobile = parsed.data.mobile_number;
    let isDuplicate = false;
    let duplicateReason: string | undefined;

    if (existingMobileNumbers.has(mobile)) {
      isDuplicate = true;
      duplicateReason = "Already exists in your leads";
    } else if (seenInFile.has(mobile)) {
      isDuplicate = true;
      duplicateReason = `Duplicate of row ${seenInFile.get(mobile)} in this file`;
    } else {
      seenInFile.set(mobile, rowNumber);
    }

    results.push({
      status: "valid",
      rowNumber,
      data: parsed.data,
      isDuplicate,
      duplicateReason,
    });
  });

  return results;
}
