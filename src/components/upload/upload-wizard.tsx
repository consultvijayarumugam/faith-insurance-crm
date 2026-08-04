"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  parseLeadsFile,
  guessColumnMapping,
  type ParsedFile,
  type LeadField,
} from "@/lib/parsing/parse-file";
import { buildRowResults, type ColumnMapping, type RowResult } from "@/lib/parsing/validate-rows";
import { bulkImportLeads, type BulkImportResult } from "@/lib/actions/leads";
import { MAX_BULK_IMPORT_ROWS } from "@/lib/constants";
import { FileStep } from "./file-step";
import { MappingStep } from "./mapping-step";
import { PreviewStep } from "./preview-step";
import { ResultStep } from "./result-step";

type Step = "file" | "mapping" | "checking" | "preview" | "result";

const EMPTY_MAPPING: ColumnMapping = {
  name: "",
  mobile_number: "",
  email: "",
  product_pitched: "",
  value: "",
  lead_status: "",
  policy_start_date: "",
  policy_end_date: "",
};

const STEPS: { key: Step; label: string }[] = [
  { key: "file", label: "Upload" },
  { key: "mapping", label: "Map columns" },
  { key: "preview", label: "Review" },
  { key: "result", label: "Done" },
];

export function UploadWizard({
  agents,
  statusNames,
}: {
  agents: { id: string; name: string }[];
  statusNames: string[];
}) {
  const [step, setStep] = React.useState<Step>("file");
  const [parsing, setParsing] = React.useState(false);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [parsedFile, setParsedFile] = React.useState<ParsedFile | null>(null);
  const [mapping, setMapping] = React.useState<ColumnMapping>(EMPTY_MAPPING);

  const [rowResults, setRowResults] = React.useState<RowResult[]>([]);
  const [selectedAgentId, setSelectedAgentId] = React.useState("");
  const [includeDuplicates, setIncludeDuplicates] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [importError, setImportError] = React.useState<string | null>(null);
  const [importResult, setImportResult] = React.useState<BulkImportResult | null>(null);

  async function handleFileSelected(file: File) {
    setParsing(true);
    setFileError(null);
    try {
      const parsed = await parseLeadsFile(file);
      if (parsed.rows.length === 0) {
        throw new Error("No data rows found in this file.");
      }
      if (parsed.rows.length > MAX_BULK_IMPORT_ROWS) {
        throw new Error(
          `This file has ${parsed.rows.length} rows. Please split it into batches of ${MAX_BULK_IMPORT_ROWS} or fewer.`
        );
      }
      setParsedFile(parsed);
      setMapping((prev) => ({ ...prev, ...guessColumnMapping(parsed.headers) }));
      setStep("mapping");
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Could not read this file.");
    } finally {
      setParsing(false);
    }
  }

  function handleMappingChange(field: LeadField, column: string) {
    setMapping((prev) => ({ ...prev, [field]: column }));
  }

  async function handleMappingContinue() {
    if (!parsedFile) return;
    setStep("checking");

    const mobileColumn = mapping.mobile_number;
    const candidates = Array.from(
      new Set(
        parsedFile.rows
          .map((row) => (mobileColumn ? row[mobileColumn]?.trim() : ""))
          .filter((v): v is string => Boolean(v))
      )
    );

    let existing = new Set<string>();
    if (candidates.length > 0) {
      const supabase = createClient();
      const { data } = await supabase
        .from("leads")
        .select("mobile_number")
        .in("mobile_number", candidates);
      existing = new Set((data ?? []).map((r) => r.mobile_number));
    }

    setRowResults(buildRowResults(parsedFile, mapping, existing, statusNames));
    setStep("preview");
  }

  async function handleImport() {
    setImporting(true);
    setImportError(null);

    const payload = rowResults
      .filter(
        (r): r is Extract<RowResult, { status: "valid" }> =>
          r.status === "valid" && (!r.isDuplicate || includeDuplicates)
      )
      .map((r) => ({ sourceRowNumber: r.rowNumber, data: r.data }));

    const result = await bulkImportLeads(selectedAgentId, payload);

    setImporting(false);
    if ("error" in result) {
      setImportError(result.error);
      return;
    }
    setImportResult(result);
    setStep("result");
  }

  function handleReset() {
    setStep("file");
    setParsing(false);
    setFileError(null);
    setParsedFile(null);
    setMapping(EMPTY_MAPPING);
    setRowResults([]);
    setSelectedAgentId("");
    setIncludeDuplicates(false);
    setImporting(false);
    setImportError(null);
    setImportResult(null);
  }

  const activeIndex = STEPS.findIndex((s) => s.key === step || (step === "checking" && s.key === "mapping"));

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-400">
        {STEPS.map((s, i) => (
          <li key={s.key} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full",
                i <= activeIndex ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-400"
              )}
            >
              {i + 1}
            </span>
            <span className={i <= activeIndex ? "text-slate-700" : undefined}>
              {s.label}
            </span>
            {i < STEPS.length - 1 && <span className="mx-1 text-slate-300">/</span>}
          </li>
        ))}
      </ol>

      <Card>
        <CardContent>
          {step === "file" && (
            <FileStep onFileSelected={handleFileSelected} parsing={parsing} error={fileError} />
          )}

          {step === "mapping" && parsedFile && (
            <MappingStep
              headers={parsedFile.headers}
              rowCount={parsedFile.rows.length}
              mapping={mapping}
              onChange={handleMappingChange}
              onContinue={handleMappingContinue}
              onBack={handleReset}
              validStatusNames={statusNames}
            />
          )}

          {step === "checking" && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking for duplicate mobile numbers…
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-4">
              {importError && <Alert variant="error">{importError}</Alert>}
              <PreviewStep
                results={rowResults}
                agents={agents}
                selectedAgentId={selectedAgentId}
                onAgentChange={setSelectedAgentId}
                includeDuplicates={includeDuplicates}
                onIncludeDuplicatesChange={setIncludeDuplicates}
                onImport={handleImport}
                onBack={() => setStep("mapping")}
                importing={importing}
              />
            </div>
          )}

          {step === "result" && importResult && (
            <ResultStep result={importResult} onReset={handleReset} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
