// Hand-written to match supabase/schema.sql. If you evolve the schema, either
// update this by hand or regenerate it with the Supabase CLI:
//   npx supabase gen types typescript --project-id <ref> > src/types/database.types.ts

export type UserRole = "agent" | "admin";

export type LeadFieldType = "text" | "number" | "date" | "select";

export type LeadFollowUpStatus = "pending" | "done" | "missed";

export type CallLogSource = "web" | "mobile";

export type AttendanceCorrectionStatus = "pending" | "approved" | "rejected";

export type AttendanceLocationStatus = "captured" | "denied" | "unavailable";

export type AllowanceVehicleType = "bike" | "car" | "other";

export type AllowanceEntryStatus = "draft" | "submitted" | "approved" | "rejected";

export type AllowanceClaimStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "partially_approved"
  | "rejected"
  | "paid";

export type CallType =
  | "Inbound Call"
  | "Outbound Call"
  | "WhatsApp"
  | "Email"
  | "Meeting"
  | "Other";

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          name: string;
          email: string;
          role: UserRole;
          birthday: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          email: string;
          role?: UserRole;
          birthday?: string | null;
        };
        Update: {
          name?: string;
          email?: string;
          role?: UserRole;
          birthday?: string | null;
        };
        Relationships: [];
      };
      lead_statuses: {
        Row: {
          id: string;
          name: string;
          color: string;
          sort_order: number;
          is_won: boolean;
          is_lost: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          color: string;
          sort_order?: number;
          is_won?: boolean;
          is_lost?: boolean;
        };
        Update: {
          name?: string;
          color?: string;
          sort_order?: number;
          is_won?: boolean;
          is_lost?: boolean;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          agent_id: string;
          name: string;
          mobile_number: string;
          email: string | null;
          product_pitched: string | null;
          value: number;
          status_id: string;
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
        };
        Insert: {
          id?: string;
          agent_id: string;
          name: string;
          mobile_number: string;
          email?: string | null;
          product_pitched?: string | null;
          value?: number;
          status_id?: string;
          policy_start_date?: string | null;
          policy_end_date?: string | null;
          next_follow_up_date?: string | null;
          proposal_amount?: number | null;
          proposal_sent_date?: string | null;
          proposal_notes?: string | null;
        };
        Update: {
          agent_id?: string;
          name?: string;
          mobile_number?: string;
          email?: string | null;
          product_pitched?: string | null;
          value?: number;
          status_id?: string;
          policy_start_date?: string | null;
          policy_end_date?: string | null;
          next_follow_up_date?: string | null;
          proposal_amount?: number | null;
          proposal_sent_date?: string | null;
          proposal_notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "leads_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_status_id_fkey";
            columns: ["status_id"];
            isOneToOne: false;
            referencedRelation: "lead_statuses";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_notes: {
        Row: {
          id: string;
          lead_id: string;
          agent_id: string | null;
          note_text: string;
          call_type: CallType | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          agent_id?: string | null;
          note_text: string;
          call_type?: CallType | null;
        };
        Update: {
          note_text?: string;
          call_type?: CallType | null;
        };
        Relationships: [
          {
            foreignKeyName: "lead_notes_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_notes_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_field_definitions: {
        Row: {
          id: string;
          name: string;
          field_type: LeadFieldType;
          options: string[] | null;
          is_required: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          field_type: LeadFieldType;
          options?: string[] | null;
          is_required?: boolean;
          sort_order?: number;
        };
        Update: {
          name?: string;
          field_type?: LeadFieldType;
          options?: string[] | null;
          is_required?: boolean;
          sort_order?: number;
        };
        Relationships: [];
      };
      lead_field_values: {
        Row: {
          id: string;
          lead_id: string;
          field_definition_id: string;
          value_text: string | null;
          value_number: number | null;
          value_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          field_definition_id: string;
          value_text?: string | null;
          value_number?: number | null;
          value_date?: string | null;
        };
        Update: {
          value_text?: string | null;
          value_number?: number | null;
          value_date?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "lead_field_values_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_field_values_field_definition_id_fkey";
            columns: ["field_definition_id"];
            isOneToOne: false;
            referencedRelation: "lead_field_definitions";
            referencedColumns: ["id"];
          },
        ];
      };
      tags: {
        Row: {
          id: string;
          name: string;
          color: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          color: string;
          created_by?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      lead_tags: {
        Row: {
          id: string;
          lead_id: string;
          tag_id: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          tag_id: string;
          created_by?: string | null;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: "lead_tags_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_follow_ups: {
        Row: {
          id: string;
          lead_id: string;
          agent_id: string;
          scheduled_at: string;
          status: LeadFollowUpStatus;
          notes: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          agent_id: string;
          scheduled_at: string;
          status?: LeadFollowUpStatus;
          notes?: string | null;
          completed_at?: string | null;
        };
        Update: {
          scheduled_at?: string;
          status?: LeadFollowUpStatus;
          notes?: string | null;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "lead_follow_ups_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };
      call_dispositions: {
        Row: {
          id: string;
          name: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          sort_order?: number;
        };
        Update: {
          name?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      call_logs: {
        Row: {
          id: string;
          lead_id: string;
          agent_id: string;
          disposition_id: string;
          duration_seconds: number;
          notes: string | null;
          source: CallLogSource;
          started_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          agent_id: string;
          disposition_id: string;
          duration_seconds?: number;
          notes?: string | null;
          source?: CallLogSource;
          started_at?: string;
        };
        Update: {
          disposition_id?: string;
          duration_seconds?: number;
          notes?: string | null;
          started_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "call_logs_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "call_logs_disposition_id_fkey";
            columns: ["disposition_id"];
            isOneToOne: false;
            referencedRelation: "call_dispositions";
            referencedColumns: ["id"];
          },
        ];
      };
      app_settings: {
        Row: {
          key: string;
          value: Record<string, unknown>;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Record<string, unknown>;
        };
        Update: {
          value?: Record<string, unknown>;
        };
        Relationships: [];
      };
      attendance_sessions: {
        Row: {
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
        };
        Insert: {
          id?: string;
          agent_id: string;
          work_date: string;
          punch_in_at?: string;
          punch_out_at?: string | null;
          punch_in_latitude?: number | null;
          punch_in_longitude?: number | null;
          punch_in_accuracy_m?: number | null;
          punch_in_location_status?: AttendanceLocationStatus | null;
          punch_out_latitude?: number | null;
          punch_out_longitude?: number | null;
          punch_out_accuracy_m?: number | null;
          punch_out_location_status?: AttendanceLocationStatus | null;
        };
        Update: {
          punch_in_at?: string;
          punch_out_at?: string | null;
          punch_in_latitude?: number | null;
          punch_in_longitude?: number | null;
          punch_in_accuracy_m?: number | null;
          punch_in_location_status?: AttendanceLocationStatus | null;
          punch_out_latitude?: number | null;
          punch_out_longitude?: number | null;
          punch_out_accuracy_m?: number | null;
          punch_out_location_status?: AttendanceLocationStatus | null;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      attendance_corrections: {
        Row: {
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
        };
        Insert: {
          id?: string;
          agent_id: string;
          work_date: string;
          requested_punch_in_at?: string | null;
          requested_punch_out_at?: string | null;
          reason: string;
          status?: AttendanceCorrectionStatus;
        };
        Update: {
          status?: AttendanceCorrectionStatus;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_corrections_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_corrections_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      retention_log: {
        Row: {
          id: string;
          run_at: string;
          mode: "dry_run" | "live";
          triggered_by: "cron" | "manual";
          counts: Record<string, number>;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      allowance_rates: {
        Row: {
          id: string;
          vehicle_type: AllowanceVehicleType;
          rate_per_km: number;
          effective_from: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          vehicle_type: AllowanceVehicleType;
          rate_per_km: number;
          effective_from: string;
        };
        Update: never;
        Relationships: [];
      };
      allowance_claims: {
        Row: {
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
        };
        Insert: {
          id?: string;
          agent_id: string;
          month: string;
          status?: AllowanceClaimStatus;
        };
        Update: {
          status?: AllowanceClaimStatus;
          submitted_at?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          paid_at?: string | null;
          payment_reference?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "allowance_claims_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      allowance_entries: {
        Row: {
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
        };
        Insert: {
          id?: string;
          claim_id: string;
          agent_id: string;
          entry_date: string;
          vehicle_type: AllowanceVehicleType;
          km: number;
          purpose: string;
          notes?: string | null;
          status?: AllowanceEntryStatus;
        };
        Update: {
          entry_date?: string;
          vehicle_type?: AllowanceVehicleType;
          km?: number;
          purpose?: string;
          notes?: string | null;
          status?: AllowanceEntryStatus;
          rejection_reason?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "allowance_entries_claim_id_fkey";
            columns: ["claim_id"];
            isOneToOne: false;
            referencedRelation: "allowance_claims";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "allowance_entries_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      allowance_entry_leads: {
        Row: {
          id: string;
          entry_id: string;
          lead_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          entry_id: string;
          lead_id: string;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: "allowance_entry_leads_entry_id_fkey";
            columns: ["entry_id"];
            isOneToOne: false;
            referencedRelation: "allowance_entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "allowance_entry_leads_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };
      allowance_expenses: {
        Row: {
          id: string;
          entry_id: string;
          category: string;
          amount: number;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          entry_id: string;
          category: string;
          amount: number;
          note?: string | null;
        };
        Update: {
          category?: string;
          amount?: number;
          note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "allowance_expenses_entry_id_fkey";
            columns: ["entry_id"];
            isOneToOne: false;
            referencedRelation: "allowance_entries";
            referencedColumns: ["id"];
          },
        ];
      };
      allowance_receipts: {
        Row: {
          id: string;
          entry_id: string;
          storage_path: string;
          file_name: string;
          content_type: string;
          size_bytes: number;
          uploaded_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          entry_id: string;
          storage_path: string;
          file_name: string;
          content_type: string;
          size_bytes: number;
          uploaded_by: string;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: "allowance_receipts_entry_id_fkey";
            columns: ["entry_id"];
            isOneToOne: false;
            referencedRelation: "allowance_entries";
            referencedColumns: ["id"];
          },
        ];
      };
      allowance_audit_log: {
        Row: {
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
        };
        Insert: {
          id?: string;
          entity_type: "entry" | "claim";
          entity_id: string;
          agent_id: string;
          action: string;
          actor_id: string;
          from_status?: string | null;
          to_status?: string | null;
          reason?: string | null;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      find_lead_by_mobile: {
        Args: { p_mobile: string };
        Returns: { lead_name: string; owner_name: string }[];
      };
      run_retention_cleanup: {
        Args: {
          p_years: number;
          p_dry_run: boolean;
          p_triggered_by?: string;
          p_batch_size?: number;
        };
        Returns: Record<string, number>;
      };
    };
    Enums: {
      user_role: UserRole;
      call_type: CallType;
      lead_field_type: LeadFieldType;
      lead_follow_up_status: LeadFollowUpStatus;
      call_log_source: CallLogSource;
      attendance_correction_status: AttendanceCorrectionStatus;
      attendance_location_status: AttendanceLocationStatus;
      allowance_vehicle_type: AllowanceVehicleType;
      allowance_entry_status: AllowanceEntryStatus;
      allowance_claim_status: AllowanceClaimStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
