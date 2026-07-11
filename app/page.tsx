"use client";

import { useMemo, useState } from "react";
import Papa from "papaparse";
import UploadDropzone from "@/components/UploadDropzone";
import DataTable from "@/components/DataTable";
import { CRM_FIELDS, ProcessLeadsResponse, RawRow } from "@/lib/types";

type Step = "upload" | "preview" | "processing" | "results";

export default function HomePage() {
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState<string>("");
  const [rawColumns, setRawColumns] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [processError, setProcessError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessLeadsResponse | null>(null);

  const handleFileSelected = (file: File) => {
    setUploadError(null);

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setUploadError("Please upload a valid .csv file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File is too large. Max size is 5MB.");
      return;
    }

    Papa.parse<RawRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const cols = res.meta.fields || [];
        const rows = (res.data || []).filter((r) =>
          Object.values(r).some((v) => String(v ?? "").trim() !== "")
        );

        if (rows.length === 0) {
          setUploadError("This CSV appears to be empty.");
          return;
        }

        setFileName(file.name);
        setRawColumns(cols);
        setRawRows(rows);
        setStep("preview");
      },
      error: (err) => {
        setUploadError(`Could not parse CSV: ${err.message}`);
      },
    });
  };

  const handleConfirmImport = async () => {
    setStep("processing");
    setProcessError(null);
    try {
      const res = await fetch("/api/process-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: rawRows }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to process leads.");
      }
      setResult(data as ProcessLeadsResponse);
      setStep("results");
    } catch (err: any) {
      setProcessError(err?.message || "Something went wrong.");
      setStep("preview");
    }
  };

  const handleReset = () => {
    setStep("upload");
    setFileName("");
    setRawColumns([]);
    setRawRows([]);
    setResult(null);
    setUploadError(null);
    setProcessError(null);
  };

  const skippedRows = useMemo(
    () =>
      (result?.skipped || []).map((s) => ({
        reason: s.reason,
        ...s.row,
      })),
    [result]
  );

  const skippedColumns = useMemo(() => {
    const cols = new Set<string>(["reason"]);
    for (const r of result?.skipped || []) {
      Object.keys(r.row).forEach((k) => cols.add(k));
    }
    return Array.from(cols);
  }, [result]);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 font-bold text-white">
            GE
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              GrowEasy CSV Importer
            </h1>
            <p className="text-sm text-gray-500">
              AI-powered lead import — any CSV layout, mapped automatically.
            </p>
          </div>
        </div>
      </header>

      <StepIndicator step={step} />

      {step === "upload" && (
        <section className="mt-8">
          <UploadDropzone onFileSelected={handleFileSelected} error={uploadError} />
        </section>
      )}

      {(step === "preview" || step === "processing") && (
        <section className="mt-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Preview: {fileName}
              </h2>
              <p className="text-sm text-gray-500">
                {rawRows.length} row{rawRows.length !== 1 ? "s" : ""} detected.
                No AI processing has happened yet — review below and confirm.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleReset}
                disabled={step === "processing"}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={step === "processing"}
                className="flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 disabled:opacity-60"
              >
                {step === "processing" && <Spinner />}
                {step === "processing" ? "Processing with AI…" : "Confirm Import"}
              </button>
            </div>
          </div>

          {processError && (
            <p className="text-sm font-medium text-red-600">{processError}</p>
          )}

          <DataTable columns={rawColumns} rows={rawRows} />

          {step === "processing" && (
            <div className="rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-700">
              Sending your data to the AI in batches and mapping it into
              GrowEasy CRM fields. This can take a little while for larger
              files — please don't close this tab.
            </div>
          )}
        </section>
      )}

      {step === "results" && result && (
        <section className="mt-8 space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-900">
              Import Results
            </h2>
            <button
              onClick={handleReset}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Import Another File
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Total Rows Received" value={result.totalReceived} tone="neutral" />
            <StatCard label="Successfully Imported" value={result.totalImported} tone="good" />
            <StatCard label="Skipped" value={result.totalSkipped} tone="warn" />
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-800">
              Imported CRM Records ({result.totalImported})
            </h3>
            <DataTable
              columns={CRM_FIELDS}
              rows={result.imported}
              emptyMessage="No records were successfully imported."
            />
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-800">
              Skipped Records ({result.totalSkipped})
            </h3>
            <DataTable
              columns={skippedColumns}
              rows={skippedRows}
              emptyMessage="Nothing was skipped — great data!"
            />
          </div>
        </section>
      )}
    </main>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "1. Upload CSV" },
    { key: "preview", label: "2. Preview" },
    { key: "processing", label: "3. Confirm & Process" },
    { key: "results", label: "4. Results" },
  ];
  const order: Step[] = ["upload", "preview", "processing", "results"];
  const currentIndex = order.indexOf(step);

  return (
    <ol className="flex flex-wrap gap-2 text-xs font-medium">
      {steps.map((s, i) => {
        const isActive = i === currentIndex;
        const isDone = i < currentIndex;
        return (
          <li
            key={s.key}
            className={`rounded-full px-3 py-1.5 ${
              isActive
                ? "bg-brand-500 text-white"
                : isDone
                ? "bg-brand-100 text-brand-700"
                : "bg-gray-100 text-gray-400"
            }`}
          >
            {s.label}
          </li>
        );
      })}
    </ol>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "good" | "warn";
}) {
  const toneClasses = {
    neutral: "bg-white border-gray-200 text-gray-900",
    good: "bg-green-50 border-green-200 text-green-800",
    warn: "bg-amber-50 border-amber-200 text-amber-800",
  }[tone];

  return (
    <div className={`rounded-xl border p-5 ${toneClasses}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">
        {label}
      </p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}
