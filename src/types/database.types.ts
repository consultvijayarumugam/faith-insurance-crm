// Hand-written to match supabase/schema.sql. If you evolve the schema, either
// update this by hand or regenerate it with the Supabase CLI:
//   npx supabase gen types typescript --project-id <ref> > src/types/database.types.ts

export type UserRole = "agent" | "admin";

export type LeadFieldType = "text" | "number" | "date" | "select";

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
    };
    Views: Record<string, never>;
    Functions: {
      find_lead_by_mobile: {
        Args: { p_mobile: string };
        Returns: { lead_name: string; owner_name: string }[];
      };
    };
    Enums: {
      user_role: UserRole;
      call_type: CallType;
      lead_field_type: LeadFieldType;
    };
    CompositeTypes: Record<string, never>;
  };
}
