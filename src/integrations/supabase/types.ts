export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      applications: {
        Row: {
          cover_letter: string | null
          created_at: string
          id: string
          job_id: string
          match_id: string | null
          notes: string | null
          notified_at: string | null
          status: string
          tailored_cv_path: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cover_letter?: string | null
          created_at?: string
          id?: string
          job_id: string
          match_id?: string | null
          notes?: string | null
          notified_at?: string | null
          status?: string
          tailored_cv_path?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cover_letter?: string | null
          created_at?: string
          id?: string
          job_id?: string
          match_id?: string | null
          notes?: string | null
          notified_at?: string | null
          status?: string
          tailored_cv_path?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "job_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_state: {
        Row: {
          id: number
          last_job_fetch: string | null
          last_run: string | null
          telegram_offset: number
          updated_at: string
        }
        Insert: {
          id: number
          last_job_fetch?: string | null
          last_run?: string | null
          telegram_offset?: number
          updated_at?: string
        }
        Update: {
          id?: number
          last_job_fetch?: string | null
          last_run?: string | null
          telegram_offset?: number
          updated_at?: string
        }
        Relationships: []
      }
      cv_documents: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          id: string
          is_active: boolean
          mime_type: string | null
          size_bytes: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          is_active?: boolean
          mime_type?: string | null
          size_bytes?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          is_active?: boolean
          mime_type?: string | null
          size_bytes?: number | null
          user_id?: string
        }
        Relationships: []
      }
      job_matches: {
        Row: {
          created_at: string
          id: string
          job_id: string
          reasoning: string | null
          score: number
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          reasoning?: string | null
          score: number
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          reasoning?: string | null
          score?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_matches_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          company: string | null
          description: string | null
          external_id: string
          fetched_at: string
          id: string
          location: string | null
          posted_at: string | null
          remote: boolean | null
          source: string
          tags: string[] | null
          title: string
          url: string
        }
        Insert: {
          company?: string | null
          description?: string | null
          external_id: string
          fetched_at?: string
          id?: string
          location?: string | null
          posted_at?: string | null
          remote?: boolean | null
          source: string
          tags?: string[] | null
          title: string
          url: string
        }
        Update: {
          company?: string | null
          description?: string | null
          external_id?: string
          fetched_at?: string
          id?: string
          location?: string | null
          posted_at?: string | null
          remote?: boolean | null
          source?: string
          tags?: string[] | null
          title?: string
          url?: string
        }
        Relationships: []
      }
      parsed_profile: {
        Row: {
          certifications: Json | null
          created_at: string
          cv_document_id: string | null
          education: Json | null
          experience: Json | null
          id: string
          raw_text: string | null
          skills: string[] | null
          summary: string | null
          updated_at: string
          user_id: string
          years_experience: number | null
        }
        Insert: {
          certifications?: Json | null
          created_at?: string
          cv_document_id?: string | null
          education?: Json | null
          experience?: Json | null
          id?: string
          raw_text?: string | null
          skills?: string[] | null
          summary?: string | null
          updated_at?: string
          user_id: string
          years_experience?: number | null
        }
        Update: {
          certifications?: Json | null
          created_at?: string
          cv_document_id?: string | null
          education?: Json | null
          experience?: Json | null
          id?: string
          raw_text?: string | null
          skills?: string[] | null
          summary?: string | null
          updated_at?: string
          user_id?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "parsed_profile_cv_document_id_fkey"
            columns: ["cv_document_id"]
            isOneToOne: false
            referencedRelation: "cv_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          location: string | null
          remote_preference: string | null
          target_roles: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          location?: string | null
          remote_preference?: string | null
          target_roles?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          location?: string | null
          remote_preference?: string | null
          target_roles?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      telegram_settings: {
        Row: {
          chat_id: string | null
          daily_limit: number
          match_threshold: number
          paused: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          chat_id?: string | null
          daily_limit?: number
          match_threshold?: number
          paused?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          chat_id?: string | null
          daily_limit?: number
          match_threshold?: number
          paused?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
