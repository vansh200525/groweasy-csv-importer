"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [progress, setProgress] = useState(0);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  };

  // Simulated-but-honest progress: creeps toward 90% while the AI call is
  // in flight (we don't get real server-sent progress from a single
  // request/response call), then snaps to 100% the instant the response
  // arrives.
  useEffect(() => {
    if (step !== "processing") return;
    setProgress(8);
    const interval = setInterval(() => {
      setProgress((p) => (p < 90 ? p + Math.max(1, (90 - p) * 0.08) : p));
    }, 300);
    return () => clearInterval(interval);
  }, [step]);

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
      setProgress(100);
      setResult(data as ProcessLeadsResponse);
      setTimeout(() => setStep("results"), 300);
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
    setProgress(0);
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
    <main className="min-h-screen">
      <div className="border-b border-gray-200 bg-white/80 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 font-bold text-white shadow-md shadow-brand-500/30">
              GE
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                GrowEasy CSV Importer
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                AI-powered lead import, any CSV layout
              </p>
            </div>
          </div>
          <button
            onClick={toggleDark}
            aria-label="Toggle dark mode"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {isDark ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <StepIndicator step={step} />

        {step === "upload" && (
          <section className="mt-10">
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Import leads from any CSV
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-400">
                Facebook Ads exports, Google Ads exports, Excel sheets, real
                estate CRM exports, sales reports — upload it as-is. AI maps
                the columns for you.
              </p>
            </div>
            <UploadDropzone onFileSelected={handleFileSelected} error={uploadError} />
          </section>
        )}

        {(step === "preview" || step === "processing") && (
          <section className="mt-8 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Preview: {fileName}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {rawRows.length} row{rawRows.length !== 1 ? "s" : ""} detected.
                  No AI processing has happened yet — review below and confirm.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  disabled={step === "processing"}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmImport}
                  disabled={step === "processing"}
                  className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-brand-500/30 transition hover:from-brand-600 hover:to-brand-700 disabled:opacity-60"
                >
                  {step === "processing" && <Spinner />}
                  {step === "processing" ? "Processing with AI…" : "Confirm Import"}
                </button>
              </div>
            </div>

            {processError && (
              <p className="text-sm font-medium text-red-600 dark:text-red-400">
                {processError}
              </p>
            )}

            <DataTable columns={rawColumns} rows={rawRows} />

            {step === "processing" && (
              <div className="rounded-xl border border-brand-100 bg-brand-50 p-4 dark:border-brand-700/30 dark:bg-brand-900/20">
                <div className="flex items-center justify-between text-sm font-medium text-brand-700 dark:text-brand-300">
                  <span>Mapping your data into GrowEasy CRM fields…</span>
                  <span>{Math.min(99, Math.round(progress))}%</span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-brand-100 dark:bg-brand-900/40">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-300 ease-out"
                    style={{ width: `${Math.min(99, progress)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-brand-600/80 dark:text-brand-400/80">
                  Sending rows to the AI in batches — please don't close this tab.
                </p>
              </div>
            )}
          </section>
        )}

        {step === "results" && result && (
          <section className="mt-8 space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Import Results
              </h2>
              <button
                onClick={handleReset}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
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
              <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-200">
                Imported CRM Records ({result.totalImported})
              </h3>
              <DataTable
                columns={CRM_FIELDS}
                rows={result.imported}
                emptyMessage="No records were successfully imported."
              />
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-200">
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
      </div>
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
            className={`rounded-full px-3 py-1.5 transition-colors ${
              isActive
                ? "bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-sm"
                : isDone
                ? "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
                : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
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
    neutral:
      "bg-white border-gray-200 text-gray-900 dark:bg-gray-900 dark:border-gray-800 dark:text-white",
    good: "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300",
    warn: "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300",
  }[tone];

  return (
    <div className={`rounded-xl border p-5 shadow-sm ${toneClasses}`}>
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

function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.36 6.36l-.7-.7M6.34 6.34l-.7-.7m12.72 0l-.7.7M6.34 17.66l-.7.7M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 1020.354 15.354z" />
    </svg>
  );
}
