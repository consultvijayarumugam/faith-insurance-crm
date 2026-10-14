import type {
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
