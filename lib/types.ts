// Allowed CRM status values (per assignment spec — do not change without
// updating the AI prompt in lib/aiMapper.ts as well).
export const CRM_STATUS_VALUES = [
  "GOOD_LEAD_FOLLOW_UP",
  "DID_NOT_CONNECT",
  "BAD_LEAD",
  "SALE_DONE",
] as const;
export type CrmStatus = (typeof CRM_STATUS_VALUES)[number] | "";

// Allowed data_source values. If the AI isn't confident, it must leave blank.
export const DATA_SOURCE_VALUES = [
  "leads_on_demand",
  "meridian_tower",
  "eden_park",
  "varah_swamy",
  "sarjapur_plots",
] as const;
export type DataSource = (typeof DATA_SOURCE_VALUES)[number] | "";

// The fixed GrowEasy CRM schema every uploaded CSV must be mapped into.
export interface CrmRecord {
  created_at: string;
  name: string;
  email: string;
  country_code: string;
  mobile_without_country_code: string;
  company: string;
  city: string;
  state: string;
  country: string;
  lead_owner: string;
  crm_status: CrmStatus;
  crm_note: string;
  data_source: DataSource;
  possession_time: string;
  description: string;
}

export const CRM_FIELDS: (keyof CrmRecord)[] = [
  "created_at",
  "name",
  "email",
  "country_code",
  "mobile_without_country_code",
  "company",
  "city",
  "state",
  "country",
  "lead_owner",
  "crm_status",
  "crm_note",
  "data_source",
  "possession_time",
  "description",
];

// A raw row from the uploaded CSV, before AI mapping. Keys are whatever
// column headers the source file happened to use.
export type RawRow = Record<string, string>;

export interface SkippedRecord {
  row: RawRow;
  reason: string;
}

export interface ProcessLeadsResponse {
  imported: CrmRecord[];
  skipped: SkippedRecord[];
  totalImported: number;
  totalSkipped: number;
  totalReceived: number;
}
