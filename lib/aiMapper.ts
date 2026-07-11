import {
  CrmRecord,
  RawRow,
  SkippedRecord,
  CRM_STATUS_VALUES,
  DATA_SOURCE_VALUES,
} from "./types";

const AI_PROVIDER = (process.env.AI_PROVIDER || "anthropic").toLowerCase();
const BATCH_SIZE = Number(process.env.AI_BATCH_SIZE || 20);

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

function buildSystemPrompt(): string {
  return `You are a data-mapping engine for GrowEasy CRM. You will receive an array of raw lead records extracted from an arbitrary CSV file (column names/layout are unknown and vary between files: Facebook Lead Ads exports, Google Ads exports, Excel sheets, real-estate CRM exports, sales reports, manually created spreadsheets, etc).

Your job: map each raw record into the fixed GrowEasy CRM schema below, using your best judgement about which source column(s) correspond to which target field, even when column names are ambiguous, abbreviated, or in a different language.

TARGET SCHEMA (every output record must have exactly these keys):
- created_at: lead creation date/time. Must be a string parseable by JavaScript's "new Date(created_at)". If no date is present, use an empty string.
- name: the lead's full name.
- email: the PRIMARY email address only.
- country_code: phone country code, e.g. "+91". Infer from the number/context if possible; else empty string.
- mobile_without_country_code: the PRIMARY phone number, digits only, without the country code.
- company: company/organization name.
- city: city.
- state: state/province.
- country: country.
- lead_owner: the person/agent who owns this lead (often an email or name).
- crm_status: MUST be exactly one of ${CRM_STATUS_VALUES.join(", ")}, or an empty string if nothing in the data indicates status. Infer from any status/stage/remark columns using your judgement (e.g. "closed won" / "deal closed" -> SALE_DONE; "not interested" -> BAD_LEAD; "no answer" / "unreachable" -> DID_NOT_CONNECT; "interested" / "follow up" / "callback" -> GOOD_LEAD_FOLLOW_UP).
- crm_note: free text. Put here: remarks, follow-up notes, extra comments, and any EXTRA emails or phone numbers beyond the primary ones (clearly labeled, e.g. "Alt email: x@y.com; Alt phone: 555-1234").
- data_source: MUST be exactly one of ${DATA_SOURCE_VALUES.join(", ")}, or an empty string if you are not confident which one applies. Do not guess loosely — only set this if the raw data clearly references one of these.
- possession_time: property possession timeframe, if present (real estate context), else empty string.
- description: any additional descriptive text that doesn't fit elsewhere, else empty string.

RULES:
1. If a record has NEITHER an email NOR a mobile number anywhere in its raw data, you must SKIP it (do not include it in "records"; instead add it to "skipped" with a short reason).
2. If multiple emails exist in a raw record, use the first as "email" and append the rest into crm_note.
3. If multiple phone numbers exist, use the first as "mobile_without_country_code" (split out any country code into country_code) and append the rest into crm_note.
4. Never invent data that isn't present or reasonably inferable. Use empty string "" for unknown fields (never null, never omit the key).
5. crm_status and data_source must ONLY use the exact allowed values given above, or "".
6. Keep every value as a single-line string (no raw newlines) — use "\\n" if you need to represent a line break within crm_note or description.

OUTPUT FORMAT — respond with ONLY valid JSON, no markdown fences, no commentary, matching exactly this shape:
{
  "records": [ { ...CrmRecord }, ... ],
  "skipped": [ { "index": <original array index of the input row>, "reason": "<short reason>" }, ... ]
}

The "index" in skipped must refer to the 0-based position of the row in the INPUT array you were given for this batch.`;
}

function buildUserPrompt(batch: RawRow[]): string {
  return `Map the following ${batch.length} raw CSV rows (as a JSON array, 0-indexed) into the GrowEasy CRM schema. Return only the JSON object described in your instructions.\n\nINPUT:\n${JSON.stringify(
    batch,
    null,
    0
  )}`;
}

// ---------------------------------------------------------------------------
// Provider calls
// ---------------------------------------------------------------------------

interface AiBatchResult {
  records: CrmRecord[];
  skipped: { index: number; reason: string }[];
}

async function callAnthropic(batch: RawRow[]): Promise<AiBatchResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      system: buildSystemPrompt(),
      messages: [{ role: "user", content: buildUserPrompt(batch) }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text = (data.content || [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("");

  return parseAiJson(text);
}

async function callOpenAI(batch: RawRow[]): Promise<AiBatchResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildUserPrompt(batch) },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "";
  return parseAiJson(text);
}

function parseAiJson(text: string): AiBatchResult {
  const cleaned = text
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/, "")
    .replace(/```$/, "")
    .trim();

  const parsed = JSON.parse(cleaned);
  return {
    records: Array.isArray(parsed.records) ? parsed.records : [],
    skipped: Array.isArray(parsed.skipped) ? parsed.skipped : [],
  };
}

async function callAiProvider(batch: RawRow[]): Promise<AiBatchResult> {
  if (AI_PROVIDER === "openai") return callOpenAI(batch);
  return callAnthropic(batch);
}

// ---------------------------------------------------------------------------
// Batch orchestration with retry
// ---------------------------------------------------------------------------

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}

export async function mapRowsToCrm(rows: RawRow[]): Promise<{
  records: CrmRecord[];
  skipped: SkippedRecord[];
}> {
  const batches: RawRow[][] = [];
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    batches.push(rows.slice(i, i + BATCH_SIZE));
  }

  const records: CrmRecord[] = [];
  const skipped: SkippedRecord[] = [];

  for (const batch of batches) {
    try {
      const result = await withRetry(() => callAiProvider(batch));
      records.push(...sanitizeRecords(result.records));
      for (const s of result.skipped) {
        const row = batch[s.index];
        if (row) skipped.push({ row, reason: s.reason || "Skipped by AI" });
      }
    } catch (err: any) {
      // If a whole batch fails even after retries, mark every row in it
      // as skipped rather than losing the request entirely.
      for (const row of batch) {
        skipped.push({
          row,
          reason: `AI processing failed: ${err?.message || "unknown error"}`,
        });
      }
    }
  }

  return { records, skipped };
}

function sanitizeRecords(records: any[]): CrmRecord[] {
  return records.map((r) => ({
    created_at: safeString(r.created_at),
    name: safeString(r.name),
    email: safeString(r.email),
    country_code: safeString(r.country_code),
    mobile_without_country_code: safeString(r.mobile_without_country_code),
    company: safeString(r.company),
    city: safeString(r.city),
    state: safeString(r.state),
    country: safeString(r.country),
    lead_owner: safeString(r.lead_owner),
    crm_status: CRM_STATUS_VALUES.includes(r.crm_status)
      ? r.crm_status
      : "",
    crm_note: safeString(r.crm_note),
    data_source: DATA_SOURCE_VALUES.includes(r.data_source)
      ? r.data_source
      : "",
    possession_time: safeString(r.possession_time),
    description: safeString(r.description),
  }));
}

function safeString(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).replace(/\r?\n/g, "\\n");
}
