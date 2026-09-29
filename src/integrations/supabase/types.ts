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
      assessment_correction_policies: {
        Row: {
          admissible_value_kinds: string[] | null
          applies_when_period_closing: string
          class_id: string | null
          created_at: string
          definition: Json
          homologated_at: string | null
          homologation_act_ref: string | null
          id: string
          logical_policy_id: string
          outcome: string
          required_capabilities: string[]
          requirement_codes: string[]
          status: string
          supersedes_version_id: string | null
          valid_from: string | null
          valid_until: string | null
          version: number
        }
        Insert: {
          admissible_value_kinds?: string[] | null
          applies_when_period_closing: string
          class_id?: string | null
          created_at?: string
          definition: Json
          homologated_at?: string | null
          homologation_act_ref?: string | null
          id?: string
          logical_policy_id: string
          outcome: string
          required_capabilities?: string[]
          requirement_codes?: string[]
          status?: string
          supersedes_version_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
          version: number
        }
        Update: {
          admissible_value_kinds?: string[] | null
          applies_when_period_closing?: string
          class_id?: string | null
          created_at?: string
          definition?: Json
          homologated_at?: string | null
          homologation_act_ref?: string | null
          id?: string
          logical_policy_id?: string
          outcome?: string
          required_capabilities?: string[]
          requirement_codes?: string[]
          status?: string
          supersedes_version_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "assessment_correction_policies_supersedes_version_id_fkey"
            columns: ["supersedes_version_id"]
            isOneToOne: false
            referencedRelation: "assessment_correction_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_entry_batch_acts: {
        Row: {
          author_person_id: string
          author_user_id: string
          authorizing_engagement_id: string
          capability_policy_id: string
          capability_policy_version: number
          class_id: string
          committed_at: string
          configuration_id: string | null
          configuration_version: number | null
          consulted_closing_id: string | null
          id: string
          instrument_id: string
          period_id: string
          plan_id: string
          version_ids: string[]
        }
        Insert: {
          author_person_id: string
          author_user_id: string
          authorizing_engagement_id: string
          capability_policy_id: string
          capability_policy_version: number
          class_id: string
          committed_at?: string
          configuration_id?: string | null
          configuration_version?: number | null
          consulted_closing_id?: string | null
          id?: string
          instrument_id: string
          period_id: string
          plan_id: string
          version_ids: string[]
        }
        Update: {
          author_person_id?: string
          author_user_id?: string
          authorizing_engagement_id?: string
          capability_policy_id?: string
          capability_policy_version?: number
          class_id?: string
          committed_at?: string
          configuration_id?: string | null
          configuration_version?: number | null
          consulted_closing_id?: string | null
          id?: string
          instrument_id?: string
          period_id?: string
          plan_id?: string
          version_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "assessment_entry_batch_acts_author_person_id_fkey"
            columns: ["author_person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_entry_batch_acts_authorizing_engagement_id_fkey"
            columns: ["authorizing_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_entry_batch_acts_capability_policy_id_fkey"
            columns: ["capability_policy_id"]
            isOneToOne: false
            referencedRelation: "capability_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_entry_versions: {
        Row: {
          author_person_id: string
          author_user_id: string
          authorizing_engagement_id: string
          batch_plan_id: string
          capability_policy_id: string
          capability_policy_version: number
          class_id: string
          consulted_closing_id: string | null
          id: string
          instrument_id: string
          logical_entry_id: string
          origin: string
          origin_metadata: Json
          period_id: string
          placement: Json
          recorded_at: string
          rectification: Json | null
          student_id: string
          supersedes_version_id: string | null
          value: Json
          value_label: string | null
          version_number: number
        }
        Insert: {
          author_person_id: string
          author_user_id: string
          authorizing_engagement_id: string
          batch_plan_id: string
          capability_policy_id: string
          capability_policy_version: number
          class_id: string
          consulted_closing_id?: string | null
          id?: string
          instrument_id: string
          logical_entry_id: string
          origin?: string
          origin_metadata?: Json
          period_id: string
          placement?: Json
          recorded_at?: string
          rectification?: Json | null
          student_id: string
          supersedes_version_id?: string | null
          value: Json
          value_label?: string | null
          version_number: number
        }
        Update: {
          author_person_id?: string
          author_user_id?: string
          authorizing_engagement_id?: string
          batch_plan_id?: string
          capability_policy_id?: string
          capability_policy_version?: number
          class_id?: string
          consulted_closing_id?: string | null
          id?: string
          instrument_id?: string
          logical_entry_id?: string
          origin?: string
          origin_metadata?: Json
          period_id?: string
          placement?: Json
          recorded_at?: string
          rectification?: Json | null
          student_id?: string
          supersedes_version_id?: string | null
          value?: Json
          value_label?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "assessment_entry_versions_author_person_id_fkey"
            columns: ["author_person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_entry_versions_authorizing_engagement_id_fkey"
            columns: ["authorizing_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_entry_versions_capability_policy_id_fkey"
            columns: ["capability_policy_id"]
            isOneToOne: false
            referencedRelation: "capability_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_entry_versions_instrument_fk"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "assessment_instruments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_entry_versions_supersedes_version_id_fkey"
            columns: ["supersedes_version_id"]
            isOneToOne: true
            referencedRelation: "assessment_entry_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_instruments: {
        Row: {
          author_person_id: string
          author_user_id: string
          authorizing_engagement_id: string
          capability_policy_id: string
          capability_policy_version: number
          class_id: string
          created_at: string
          definition: Json
          id: string
          instrument_type_id: string
          period_id: string
        }
        Insert: {
          author_person_id: string
          author_user_id: string
          authorizing_engagement_id: string
          capability_policy_id: string
          capability_policy_version: number
          class_id: string
          created_at?: string
          definition: Json
          id: string
          instrument_type_id: string
          period_id: string
        }
        Update: {
          author_person_id?: string
          author_user_id?: string
          authorizing_engagement_id?: string
          capability_policy_id?: string
          capability_policy_version?: number
          class_id?: string
          created_at?: string
          definition?: Json
          id?: string
          instrument_type_id?: string
          period_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_instruments_author_person_id_fkey"
            columns: ["author_person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_instruments_authorizing_engagement_id_fkey"
            columns: ["authorizing_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_instruments_capability_policy_id_fkey"
            columns: ["capability_policy_id"]
            isOneToOne: false
            referencedRelation: "capability_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      capability_policies: {
        Row: {
          created_at: string
          homologated_at: string | null
          homologation_act_ref: string | null
          id: string
          logical_policy_id: string
          status: string
          supersedes_version_id: string | null
          valid_from: string | null
          valid_until: string | null
          version: number
        }
        Insert: {
          created_at?: string
          homologated_at?: string | null
          homologation_act_ref?: string | null
          id?: string
          logical_policy_id: string
          status?: string
          supersedes_version_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
          version: number
        }
        Update: {
          created_at?: string
          homologated_at?: string | null
          homologation_act_ref?: string | null
          id?: string
          logical_policy_id?: string
          status?: string
          supersedes_version_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "capability_policies_supersedes_version_id_fkey"
            columns: ["supersedes_version_id"]
            isOneToOne: false
            referencedRelation: "capability_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      capability_policy_rules: {
        Row: {
          capability_id: string
          engagement_kind_id: string
          id: string
          policy_id: string
          scope_dimensions: string[]
        }
        Insert: {
          capability_id: string
          engagement_kind_id: string
          id?: string
          policy_id: string
          scope_dimensions?: string[]
        }
        Update: {
          capability_id?: string
          engagement_kind_id?: string
          id?: string
          policy_id?: string
          scope_dimensions?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "capability_policy_rules_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "capability_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_objectives: {
        Row: {
          age_group_id: string
          code: string
          created_at: string
          experience_field_id: string
          id: string
          official_text: string
          source_edition: string
        }
        Insert: {
          age_group_id: string
          code: string
          created_at?: string
          experience_field_id: string
          id: string
          official_text: string
          source_edition: string
        }
        Update: {
          age_group_id?: string
          code?: string
          created_at?: string
          experience_field_id?: string
          id?: string
          official_text?: string
          source_edition?: string
        }
        Relationships: []
      }
      descriptive_report_versions: {
        Row: {
          author_person_id: string
          author_user_id: string
          authorizing_engagement_id: string
          capability_policy_id: string
          capability_policy_version: number
          class_id: string
          correction_reason: string | null
          id: string
          logical_report_id: string
          objective_ids: string[]
          officialized_at: string
          period_id: string
          report_text: string
          student_id: string
          supersedes_version_id: string | null
          version_number: number
        }
        Insert: {
          author_person_id: string
          author_user_id: string
          authorizing_engagement_id: string
          capability_policy_id: string
          capability_policy_version: number
          class_id: string
          correction_reason?: string | null
          id?: string
          logical_report_id: string
          objective_ids?: string[]
          officialized_at?: string
          period_id: string
          report_text: string
          student_id: string
          supersedes_version_id?: string | null
          version_number: number
        }
        Update: {
          author_person_id?: string
          author_user_id?: string
          authorizing_engagement_id?: string
          capability_policy_id?: string
          capability_policy_version?: number
          class_id?: string
          correction_reason?: string | null
          id?: string
          logical_report_id?: string
          objective_ids?: string[]
          officialized_at?: string
          period_id?: string
          report_text?: string
          student_id?: string
          supersedes_version_id?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "descriptive_report_versions_author_person_id_fkey"
            columns: ["author_person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "descriptive_report_versions_authorizing_engagement_id_fkey"
            columns: ["authorizing_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "descriptive_report_versions_capability_policy_id_fkey"
            columns: ["capability_policy_id"]
            isOneToOne: false
            referencedRelation: "capability_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "descriptive_report_versions_supersedes_version_id_fkey"
            columns: ["supersedes_version_id"]
            isOneToOne: true
            referencedRelation: "descriptive_report_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      institutional_engagements: {
        Row: {
          class_id: string | null
          component_id: string | null
          created_at: string
          engagement_kind_id: string
          id: string
          originating_act_ref: string | null
          period_id: string | null
          person_id: string
          position_label_snapshot: string | null
          school_id: string | null
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          class_id?: string | null
          component_id?: string | null
          created_at?: string
          engagement_kind_id: string
          id?: string
          originating_act_ref?: string | null
          period_id?: string | null
          person_id: string
          position_label_snapshot?: string | null
          school_id?: string | null
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          class_id?: string | null
          component_id?: string | null
          created_at?: string
          engagement_kind_id?: string
          id?: string
          originating_act_ref?: string | null
          period_id?: string | null
          person_id?: string
          position_label_snapshot?: string | null
          school_id?: string | null
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "institutional_engagements_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
        ]
      }
      institutional_persons: {
        Row: {
          created_at: string
          display_name: string
          id: string
          institutional_identifier: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          institutional_identifier?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          institutional_identifier?: string | null
        }
        Relationships: []
      }
      period_closing_events: {
        Row: {
          acted_at: string
          action: string
          author_person_id: string
          author_user_id: string
          authorizing_engagement_id: string
          capability_policy_id: string
          capability_policy_version: number
          class_id: string
          closing_version_id: string | null
          detail: string
          exercised_capability: string
          id: string
          justification: string | null
          period_id: string
          preceding_event_id: string | null
          scope: Json
          scope_key: string
          sequence: number
        }
        Insert: {
          acted_at?: string
          action: string
          author_person_id: string
          author_user_id: string
          authorizing_engagement_id: string
          capability_policy_id: string
          capability_policy_version: number
          class_id: string
          closing_version_id?: string | null
          detail?: string
          exercised_capability: string
          id?: string
          justification?: string | null
          period_id: string
          preceding_event_id?: string | null
          scope: Json
          scope_key: string
          sequence: number
        }
        Update: {
          acted_at?: string
          action?: string
          author_person_id?: string
          author_user_id?: string
          authorizing_engagement_id?: string
          capability_policy_id?: string
          capability_policy_version?: number
          class_id?: string
          closing_version_id?: string | null
          detail?: string
          exercised_capability?: string
          id?: string
          justification?: string | null
          period_id?: string
          preceding_event_id?: string | null
          scope?: Json
          scope_key?: string
          sequence?: number
        }
        Relationships: [
          {
            foreignKeyName: "period_closing_events_author_person_id_fkey"
            columns: ["author_person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "period_closing_events_authorizing_engagement_id_fkey"
            columns: ["authorizing_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "period_closing_events_capability_policy_id_fkey"
            columns: ["capability_policy_id"]
            isOneToOne: false
            referencedRelation: "capability_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "period_closing_events_preceding_event_id_fkey"
            columns: ["preceding_event_id"]
            isOneToOne: true
            referencedRelation: "period_closing_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "period_closing_events_version_fk"
            columns: ["closing_version_id"]
            isOneToOne: false
            referencedRelation: "period_closing_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      period_closing_versions: {
        Row: {
          author_person_id: string
          author_user_id: string
          authorizing_engagement_id: string
          capability_policy_id: string
          capability_policy_version: number
          class_id: string
          closed_at: string
          configuration_id: string
          configuration_version: number | null
          id: string
          justification: string | null
          period_id: string
          preceding_closing_id: string | null
          record: Json
          revision_kind: string | null
          rule_id: string
          rule_version: number
          scope_key: string
          used_entry_version_ids: string[]
          version_number: number
        }
        Insert: {
          author_person_id: string
          author_user_id: string
          authorizing_engagement_id: string
          capability_policy_id: string
          capability_policy_version: number
          class_id: string
          closed_at?: string
          configuration_id: string
          configuration_version?: number | null
          id?: string
          justification?: string | null
          period_id: string
          preceding_closing_id?: string | null
          record: Json
          revision_kind?: string | null
          rule_id: string
          rule_version: number
          scope_key: string
          used_entry_version_ids?: string[]
          version_number: number
        }
        Update: {
          author_person_id?: string
          author_user_id?: string
          authorizing_engagement_id?: string
          capability_policy_id?: string
          capability_policy_version?: number
          class_id?: string
          closed_at?: string
          configuration_id?: string
          configuration_version?: number | null
          id?: string
          justification?: string | null
          period_id?: string
          preceding_closing_id?: string | null
          record?: Json
          revision_kind?: string | null
          rule_id?: string
          rule_version?: number
          scope_key?: string
          used_entry_version_ids?: string[]
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "period_closing_versions_author_person_id_fkey"
            columns: ["author_person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "period_closing_versions_authorizing_engagement_id_fkey"
            columns: ["authorizing_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "period_closing_versions_capability_policy_id_fkey"
            columns: ["capability_policy_id"]
            isOneToOne: false
            referencedRelation: "capability_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "period_closing_versions_preceding_closing_id_fkey"
            columns: ["preceding_closing_id"]
            isOneToOne: true
            referencedRelation: "period_closing_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_person_links: {
        Row: {
          created_at: string
          person_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          person_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          person_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_person_links_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assessment_value_problem: { Args: { _v: Json }; Returns: string }
      can_read_closing: {
        Args: { _class: string; _period: string }
        Returns: boolean
      }
      create_assessment_instrument: {
        Args: {
          _class: string
          _definition: Json
          _id: string
          _instrument_type: string
          _period: string
        }
        Returns: string
      }
      current_closing_for_instrument: {
        Args: { _instrument: string }
        Returns: string
      }
      current_closing_id: { Args: { _scope_key: string }; Returns: string }
      current_person_id: { Args: never; Returns: string }
      effective_capabilities: {
        Args: { _on?: string }
        Returns: {
          capability_id: string
          class_id: string
          component_id: string
          engagement_id: string
          period_id: string
          policy_id: string
          policy_version: number
          school_id: string
        }[]
      }
      has_capability: {
        Args: { _capability: string; _class: string; _period?: string }
        Returns: boolean
      }
      officialize_descriptive_report: {
        Args: {
          _base_version_id: string
          _class: string
          _objective_ids: string[]
          _period: string
          _reason: string
          _student: string
          _text: string
        }
        Returns: string
      }
      record_period_closing_act: {
        Args: {
          _action: string
          _detail: string
          _expected_closing_id: string
          _expected_last_event_id: string
          _justification: string
          _period: string
          _record: Json
          _scope: Json
          _scope_key: string
        }
        Returns: string
      }
      register_assessment_results: {
        Args: {
          _configuration_id: string
          _configuration_version: number
          _expected_closing_id: string
          _instrument: string
          _operations: Json
          _plan_id: string
        }
        Returns: string
      }
      scope_key_matches: {
        Args: {
          _class: string
          _period: string
          _scope: Json
          _scope_key: string
        }
        Returns: boolean
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
