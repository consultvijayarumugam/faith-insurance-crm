import type { CallType, UserRole } from "./database.types";

export type { UserRole, CallType } from "./database.types";
export type { Database } from "./database.types";

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
}

export interface LeadNote {
  id: string;
  lead_id: string;
  agent_id: string | null;
  note_text: string;
  call_type: CallType | null;
  created_at: string;
}
