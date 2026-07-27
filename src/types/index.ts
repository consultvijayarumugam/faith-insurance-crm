import type { CallType, LeadStatus, UserRole } from "./database.types";

export type { UserRole, LeadStatus, CallType } from "./database.types";
export type { Database } from "./database.types";

export const LEAD_STATUSES: LeadStatus[] = [
  "New",
  "Contacted",
  "Quote Shared",
  "Converted",
  "Lost",
];

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
}

export interface Lead {
  id: string;
  agent_id: string;
  name: string;
  mobile_number: string;
  email: string | null;
  product_pitched: string | null;
  value: number;
  lead_status: LeadStatus;
  quote_shared: boolean;
  converted: boolean;
  policy_start_date: string | null;
  policy_end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadNote {
  id: string;
  lead_id: string;
  agent_id: string | null;
  note_text: string;
  call_type: CallType | null;
  created_at: string;
}
