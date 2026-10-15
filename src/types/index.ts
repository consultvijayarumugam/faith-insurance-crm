import type {
  AllowanceClaimStatus,
  AllowanceEntryStatus,
  AllowanceVehicleType,
  AttendanceCorrectionStatus,
  AttendanceLocationStatus,
  CallLogSource,
  CallType,
  LeadFieldType,
  LeadFollowUpStatus,
  UserRole,
} from "./database.types";

export type {
  UserRole,
  CallType,
  LeadFieldType,
  LeadFollowUpStatus,
  CallLogSource,
  AttendanceCorrectionStatus,
  AttendanceLocationStatus,
  AllowanceVehicleType,
  AllowanceEntryStatus,
  AllowanceClaimStatus,
} from "./database.types";
export type { Database } from "./database.types";

export interface TempPasswordResult {
  name: string;
  email: string;
  tempPassword: string;
}

export const CALL_TYPES: CallType[] = [
  "Inbound Call",
  "Outbound Call",
  "WhatsApp",
  "Email",
  "Meeting",
  "Other",
];

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  birthday: string | null;
}

export interface LeadStatusOption {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  is_won: boolean;
  is_lost: boolean;
}

export interface Lead {
  id: string;
  agent_id: string;
  name: string;
  mobile_number: string;
  email: string | null;
  product_pitched: string | null;
  value: number;
  status_id: string;
  status: LeadStatusOption;
  converted: boolean;
  converted_at: string | null;
  policy_start_date: string | null;
  policy_end_date: string | null;
  next_follow_up_date: string | null;
  proposal_amount: number | null;
  proposal_sent_date: string | null;
  proposal_notes: string | null;
  created_at: string;
  updated_at: string;
  /** Populated only where the page's query embeds lead_tags(tag:tags(*)) —
   * not every Lead-shaped query bothers to fetch tags. */
  tags?: Tag[];
}

export interface LeadNote {
  id: string;
  lead_id: string;
  agent_id: string | null;
  note_text: string;
  call_type: CallType | null;
  created_at: string;
}

export interface LeadFieldDefinition {
  id: string;
  name: string;
  field_type: LeadFieldType;
  options: string[] | null;
  is_required: boolean;
  sort_order: number;
}

export interface LeadFieldValue {
  id: string;
  lead_id: string;
  field_definition_id: string;
  value_text: string | null;
  value_number: number | null;
  value_date: string | null;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  created_by: string | null;
  created_at: string;
}

export interface CallDisposition {
  id: string;
  name: string;
  sort_order: number;
}

export interface CallLog {
  id: string;
  lead_id: string;
  agent_id: string;
  disposition_id: string;
  duration_seconds: number;
  notes: string | null;
  source: CallLogSource;
  started_at: string;
  created_at: string;
  /** Populated only where the query joins call_dispositions(name). */
  disposition_name?: string;
}

export interface PerformanceThreshold {
  min_calls_per_week: number;
}

export interface AttendanceSession {
  id: string;
  agent_id: string;
  work_date: string;
  punch_in_at: string;
  punch_out_at: string | null;
  punch_in_latitude: number | null;
  punch_in_longitude: number | null;
  punch_in_accuracy_m: number | null;
  punch_in_location_status: AttendanceLocationStatus | null;
  punch_out_latitude: number | null;
  punch_out_longitude: number | null;
  punch_out_accuracy_m: number | null;
  punch_out_location_status: AttendanceLocationStatus | null;
  created_at: string;
  /** Populated only where the query joins users(name). */
  agent_name?: string;
}

export interface AttendanceLocationSetting {
  require_location_for_punch: boolean;
}

export interface RetentionSetting {
  years: 1 | 2 | 3;
  dry_run: boolean;
}

export interface RetentionLog {
  id: string;
  run_at: string;
  mode: "dry_run" | "live";
  triggered_by: "cron" | "manual";
  counts: Record<string, number>;
}

export interface AttendanceCorrection {
  id: string;
  agent_id: string;
  work_date: string;
  requested_punch_in_at: string | null;
  requested_punch_out_at: string | null;
  reason: string;
  status: AttendanceCorrectionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  /** Populated only where the query joins users(name). */
  agent_name?: string;
}

export interface LeadFollowUp {
  id: string;
  lead_id: string;
  agent_id: string;
  scheduled_at: string;
  status: LeadFollowUpStatus;
  notes: string | null;
  completed_at: string | null;
  created_at: string;
  /** Populated only where the query joins leads(name) — the calendar views
   * need it, a plain per-lead follow-ups list doesn't. */
  lead_name?: string;
}

export interface AllowanceRate {
  id: string;
  vehicle_type: AllowanceVehicleType;
  rate_per_km: number;
  effective_from: string;
  created_at: string;
}

export interface AllowanceClaim {
  id: string;
  agent_id: string;
  month: string;
  status: AllowanceClaimStatus;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  paid_at: string | null;
  payment_reference: string | null;
  total_km: number;
  total_travel_amount: number;
  total_expenses_amount: number;
  total_claimed_amount: number;
  total_approved_amount: number;
  created_at: string;
  updated_at: string;
  /** Populated only where the query joins users(name). */
  agent_name?: string;
}

export interface AllowanceExpense {
  id: string;
  entry_id: string;
  category: string;
  amount: number;
  note: string | null;
  created_at: string;
}

export interface AllowanceReceipt {
  id: string;
  entry_id: string;
  storage_path: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  uploaded_by: string;
  created_at: string;
}

export interface AllowanceEntry {
  id: string;
  claim_id: string;
  agent_id: string;
  entry_date: string;
  vehicle_type: AllowanceVehicleType;
  km: number;
  purpose: string;
  travel_amount: number;
  notes: string | null;
  status: AllowanceEntryStatus;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  /** Populated only where the query embeds the related rows. */
  expenses?: AllowanceExpense[];
  receipts?: AllowanceReceipt[];
  leads?: { id: string; name: string }[];
}

export interface AllowanceAuditLogEntry {
  id: string;
  entity_type: "entry" | "claim";
  entity_id: string;
  agent_id: string;
  action: string;
  actor_id: string;
  from_status: string | null;
  to_status: string | null;
  reason: string | null;
  created_at: string;
  /** Populated only where the query joins users(name). */
  actor_name?: string;
}

export interface AllowanceSettings {
  daily_km_cap: number;
  monthly_amount_cap: number;
  expense_categories: string[];
  receipt_required_above_amount: number;
}
