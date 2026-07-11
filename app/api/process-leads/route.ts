import { NextRequest, NextResponse } from "next/server";
import { mapRowsToCrm } from "@/lib/aiMapper";
import { ProcessLeadsResponse, RawRow } from "@/lib/types";

export const maxDuration = 60; // allow longer runtime for AI batches (Vercel)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rows: RawRow[] = body?.rows;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "Request body must include a non-empty 'rows' array." },
        { status: 400 }
      );
    }

    if (rows.length > 5000) {
      return NextResponse.json(
        { error: "Too many rows. Please upload a CSV with at most 5000 rows." },
        { status: 413 }
      );
    }

    const { records, skipped } = await mapRowsToCrm(rows);

    const response: ProcessLeadsResponse = {
      imported: records,
      skipped,
      totalImported: records.length,
      totalSkipped: skipped.length,
      totalReceived: rows.length,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err: any) {
    console.error("process-leads error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error while processing leads." },
      { status: 500 }
    );
  }
}
