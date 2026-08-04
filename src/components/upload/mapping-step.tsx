"use client";

import { ArrowLeft } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import type { LeadField } from "@/lib/parsing/parse-file";
import { REQUIRED_MAPPING_FIELDS, type ColumnMapping } from "@/lib/parsing/validate-rows";

const FIELD_LABELS: Record<LeadField, string> = {
  name: "Lead name",
  mobile_number: "Mobile number",
  email: "Email",
  product_pitched: "Product pitched",
  value: "Value",
  lead_status: "Status",
  policy_start_date: "Policy start date",
  policy_end_date: "Policy end date",
};

const FIELD_ORDER: LeadField[] = [
  "name",
  "mobile_number",
  "email",
  "product_pitched",
  "value",
  "lead_status",
  "policy_start_date",
  "policy_end_date",
];

export function MappingStep({
  headers,
  rowCount,
  mapping,
  onChange,
  onContinue,
  onBack,
  validStatusNames,
}: {
  headers: string[];
  rowCount: number;
  mapping: ColumnMapping;
  onChange: (field: LeadField, column: string) => void;
  onContinue: () => void;
  onBack: () => void;
  validStatusNames: string[];
}) {
  const missingRequired = REQUIRED_MAPPING_FIELDS.filter((f) => !mapping[f]);
  const canContinue = missingRequired.length === 0;

  return (
    <div className="space-y-5">
      <Alert variant="info">
        Found {rowCount} row{rowCount === 1 ? "" : "s"} with {headers.length}{" "}
        column{headers.length === 1 ? "" : "s"}. Match each lead field below
        to a column from your file.
      </Alert>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FIELD_ORDER.map((field) => {
          const required = REQUIRED_MAPPING_FIELDS.includes(field);
          return (
            <div key={field} className="space-y-1.5">
              <Label htmlFor={`map-${field}`}>
                {FIELD_LABELS[field]}
                {required && <span className="text-rose-500"> *</span>}
              </Label>
              <Select
                id={`map-${field}`}
                value={mapping[field]}
                onChange={(e) => onChange(field, e.target.value)}
              >
                <option value="">
                  {required ? "Select a column…" : "Not mapped"}
                </option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </Select>
              {field === "lead_status" && (
                <p className="text-xs text-slate-400">
                  Recognized values: {validStatusNames.join(", ")}. Anything else (or blank) falls
                  back to &quot;{validStatusNames[0]}&quot;.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 border-t border-slate-100 pt-5">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Button>
        <Button type="button" onClick={onContinue} disabled={!canContinue}>
          Continue
        </Button>
        {!canContinue && (
          <p className="text-xs text-slate-400">
            Map lead name and mobile number to continue
          </p>
        )}
      </div>
    </div>
  );
}
