// Hand-written to match supabase/schema.sql. If you evolve the schema, either
// update this by hand or regenerate it with the Supabase CLI:
//   npx supabase gen types typescript --project-id <ref> > src/types/database.types.ts

export type UserRole = "agent" | "admin";

export type LeadStatus =
  | "New"
  | "Contacted"
  | "Quote Shared"
  | "Converted"
  | "Lost";

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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          email: string;
          role?: UserRole;
        };
        Update: {
          name?: string;
          email?: string;
          role?: UserRole;
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
          lead_status: LeadStatus;
          quote_shared: boolean;
          converted: boolean;
          policy_start_date: string | null;
          policy_end_date: string | null;
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
          lead_status?: LeadStatus;
          policy_start_date?: string | null;
          policy_end_date?: string | null;
        };
        Update: {
          agent_id?: string;
          name?: string;
          mobile_number?: string;
          email?: string | null;
          product_pitched?: string | null;
          value?: number;
          lead_status?: LeadStatus;
          policy_start_date?: string | null;
          policy_end_date?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "leads_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "users";
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      lead_status: LeadStatus;
      call_type: CallType;
    };
    CompositeTypes: Record<string, never>;
  };
}
