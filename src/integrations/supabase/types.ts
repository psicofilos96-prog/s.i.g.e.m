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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      academic_standing_batch_acts: {
        Row: {
          author_person_id: string
          author_user_id: string
          authorizing_engagement_id: string
          capability_policy_id: string
          capability_policy_version: number
          class_id: string
          committed_at: string
          cycle_id: string
          id: string
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
          cycle_id: string
          id?: string
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
          cycle_id?: string
          id?: string
          plan_id?: string
          version_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "academic_standing_batch_acts_author_person_id_fkey"
            columns: ["author_person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_standing_batch_acts_authorizing_engagement_id_fkey"
            columns: ["authorizing_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_standing_batch_acts_capability_policy_id_fkey"
            columns: ["capability_policy_id"]
            isOneToOne: false
            referencedRelation: "capability_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_standing_versions: {
        Row: {
          author_person_id: string
          author_user_id: string
          authorizing_engagement_id: string
          batch_plan_id: string
          capability_policy_id: string
          capability_policy_version: number
          class_id: string
          cycle_id: string
          deliberation_id: string | null
          id: string
          logical_standing_id: string
          minute_id: string | null
          record: Json
          registered_at: string
          rule_set_id: string
          rule_set_version: number
          standing_id: string
          student_id: string
          supersedes_version_id: string | null
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
          cycle_id: string
          deliberation_id?: string | null
          id?: string
          logical_standing_id: string
          minute_id?: string | null
          record: Json
          registered_at?: string
          rule_set_id: string
          rule_set_version: number
          standing_id: string
          student_id: string
          supersedes_version_id?: string | null
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
          cycle_id?: string
          deliberation_id?: string | null
          id?: string
          logical_standing_id?: string
          minute_id?: string | null
          record?: Json
          registered_at?: string
          rule_set_id?: string
          rule_set_version?: number
          standing_id?: string
          student_id?: string
          supersedes_version_id?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "academic_standing_versions_author_person_id_fkey"
            columns: ["author_person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_standing_versions_authorizing_engagement_id_fkey"
            columns: ["authorizing_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_standing_versions_capability_policy_id_fkey"
            columns: ["capability_policy_id"]
            isOneToOne: false
            referencedRelation: "capability_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_standing_versions_deliberation_id_fkey"
            columns: ["deliberation_id"]
            isOneToOne: false
            referencedRelation: "collegial_deliberations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_standing_versions_minute_id_fkey"
            columns: ["minute_id"]
            isOneToOne: false
            referencedRelation: "collegial_minute_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_standing_versions_supersedes_version_id_fkey"
            columns: ["supersedes_version_id"]
            isOneToOne: true
            referencedRelation: "academic_standing_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      account_credential_events: {
        Row: {
          act_ref: string | null
          created_at: string
          id: string
          kind: string
          login: string | null
          recorded_by: string
          user_id: string
        }
        Insert: {
          act_ref?: string | null
          created_at?: string
          id?: string
          kind: string
          login?: string | null
          recorded_by: string
          user_id: string
        }
        Update: {
          act_ref?: string | null
          created_at?: string
          id?: string
          kind?: string
          login?: string | null
          recorded_by?: string
          user_id?: string
        }
        Relationships: []
      }
      allocation_curricular_position_axes: {
        Row: {
          position_version_id: string
          scheme_id: string
          value_id: string
          value_version: number
        }
        Insert: {
          position_version_id: string
          scheme_id: string
          value_id: string
          value_version: number
        }
        Update: {
          position_version_id?: string
          scheme_id?: string
          value_id?: string
          value_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "allocation_curricular_position_axes_position_version_id_fkey"
            columns: ["position_version_id"]
            isOneToOne: false
            referencedRelation: "allocation_curricular_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      allocation_curricular_positions: {
        Row: {
          allocation_logical_id: string
          annulled: boolean
          change_reason: string | null
          class_id: string
          created_at: string
          id: string
          originating_act_ref: string | null
          position_logical_id: string
          recorded_by: string
          school_id: string
          supersedes_id: string | null
          valid_from: string
          valid_until: string | null
          version: number
        }
        Insert: {
          allocation_logical_id: string
          annulled?: boolean
          change_reason?: string | null
          class_id: string
          created_at?: string
          id?: string
          originating_act_ref?: string | null
          position_logical_id: string
          recorded_by: string
          school_id: string
          supersedes_id?: string | null
          valid_from: string
          valid_until?: string | null
          version: number
        }
        Update: {
          allocation_logical_id?: string
          annulled?: boolean
          change_reason?: string | null
          class_id?: string
          created_at?: string
          id?: string
          originating_act_ref?: string | null
          position_logical_id?: string
          recorded_by?: string
          school_id?: string
          supersedes_id?: string | null
          valid_from?: string
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "allocation_curricular_positions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "allocation_curricular_positions"
            referencedColumns: ["id"]
          },
        ]
      }
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
      assessment_instrument_status_events: {
        Row: {
          acted_at: string
          author_person_id: string
          author_user_id: string
          authorizing_engagement_id: string
          capability_policy_id: string
          capability_policy_version: number
          id: string
          instrument_id: string
          preceding_event_id: string | null
          sequence: number
          status: string
        }
        Insert: {
          acted_at?: string
          author_person_id: string
          author_user_id: string
          authorizing_engagement_id: string
          capability_policy_id: string
          capability_policy_version: number
          id?: string
          instrument_id: string
          preceding_event_id?: string | null
          sequence: number
          status: string
        }
        Update: {
          acted_at?: string
          author_person_id?: string
          author_user_id?: string
          authorizing_engagement_id?: string
          capability_policy_id?: string
          capability_policy_version?: number
          id?: string
          instrument_id?: string
          preceding_event_id?: string | null
          sequence?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_instrument_status_eve_authorizing_engagement_id_fkey"
            columns: ["authorizing_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_instrument_status_events_author_person_id_fkey"
            columns: ["author_person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_instrument_status_events_capability_policy_id_fkey"
            columns: ["capability_policy_id"]
            isOneToOne: false
            referencedRelation: "capability_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_instrument_status_events_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "assessment_instruments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_instrument_status_events_preceding_event_id_fkey"
            columns: ["preceding_event_id"]
            isOneToOne: true
            referencedRelation: "assessment_instrument_status_events"
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
      assessment_norm_versions: {
        Row: {
          academic_year_id: string
          class_ids: string[]
          created_at: string
          definition: Json
          homologation_act_ref: string
          id: string
          logical_id: string
          norm_kind: string
          recorded_at: string
          recorded_by_person_id: string
          recorded_by_user_id: string
          stage_ids: string[]
          supersedes_id: string | null
          valid_from: string | null
          valid_until: string | null
          version: number
        }
        Insert: {
          academic_year_id: string
          class_ids?: string[]
          created_at?: string
          definition: Json
          homologation_act_ref: string
          id?: string
          logical_id: string
          norm_kind: string
          recorded_at?: string
          recorded_by_person_id: string
          recorded_by_user_id: string
          stage_ids?: string[]
          supersedes_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
          version: number
        }
        Update: {
          academic_year_id?: string
          class_ids?: string[]
          created_at?: string
          definition?: Json
          homologation_act_ref?: string
          id?: string
          logical_id?: string
          norm_kind?: string
          recorded_at?: string
          recorded_by_person_id?: string
          recorded_by_user_id?: string
          stage_ids?: string[]
          supersedes_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "assessment_norm_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "assessment_norm_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_calculation_policies: {
        Row: {
          created_at: string
          definition: Json
          homologated_at: string | null
          homologation_act_ref: string | null
          id: string
          status: string
          valid_from: string | null
          valid_until: string | null
          version: number
        }
        Insert: {
          created_at?: string
          definition: Json
          homologated_at?: string | null
          homologation_act_ref?: string | null
          id: string
          status?: string
          valid_from?: string | null
          valid_until?: string | null
          version: number
        }
        Update: {
          created_at?: string
          definition?: Json
          homologated_at?: string | null
          homologation_act_ref?: string | null
          id?: string
          status?: string
          valid_from?: string | null
          valid_until?: string | null
          version?: number
        }
        Relationships: []
      }
      attendance_closing_events: {
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
          plan_id: string
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
          detail: string
          exercised_capability: string
          id?: string
          justification?: string | null
          period_id: string
          plan_id: string
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
          plan_id?: string
          preceding_event_id?: string | null
          scope?: Json
          scope_key?: string
          sequence?: number
        }
        Relationships: [
          {
            foreignKeyName: "attendance_closing_events_author_person_id_fkey"
            columns: ["author_person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_closing_events_authorizing_engagement_id_fkey"
            columns: ["authorizing_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_closing_events_capability_policy_id_fkey"
            columns: ["capability_policy_id"]
            isOneToOne: false
            referencedRelation: "capability_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_closing_events_closing_version_id_fkey"
            columns: ["closing_version_id"]
            isOneToOne: false
            referencedRelation: "attendance_closing_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_closing_events_preceding_event_id_fkey"
            columns: ["preceding_event_id"]
            isOneToOne: true
            referencedRelation: "attendance_closing_events"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_closing_versions: {
        Row: {
          author_person_id: string
          author_user_id: string
          authorizing_engagement_id: string
          capability_policy_id: string
          capability_policy_version: number
          class_id: string
          closed_at: string
          id: string
          justification: string | null
          lesson_logical_ids: string[]
          period_id: string
          preceding_closing_id: string | null
          record: Json
          revision_kind: string | null
          scope_key: string
          used_attendance_version_ids: string[]
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
          id?: string
          justification?: string | null
          lesson_logical_ids: string[]
          period_id: string
          preceding_closing_id?: string | null
          record: Json
          revision_kind?: string | null
          scope_key: string
          used_attendance_version_ids: string[]
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
          id?: string
          justification?: string | null
          lesson_logical_ids?: string[]
          period_id?: string
          preceding_closing_id?: string | null
          record?: Json
          revision_kind?: string | null
          scope_key?: string
          used_attendance_version_ids?: string[]
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "attendance_closing_versions_author_person_id_fkey"
            columns: ["author_person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_closing_versions_authorizing_engagement_id_fkey"
            columns: ["authorizing_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_closing_versions_capability_policy_id_fkey"
            columns: ["capability_policy_id"]
            isOneToOne: false
            referencedRelation: "capability_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_closing_versions_preceding_closing_id_fkey"
            columns: ["preceding_closing_id"]
            isOneToOne: true
            referencedRelation: "attendance_closing_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_occurrence_types: {
        Row: {
          code: string
          created_at: string
          description: string
          homologation_act_ref: string
          id: string
          label: string
          requires_document: boolean
          status: string
          valid_from: string
          valid_until: string | null
          version: number
        }
        Insert: {
          code: string
          created_at?: string
          description?: string
          homologation_act_ref: string
          id: string
          label: string
          requires_document?: boolean
          status?: string
          valid_from: string
          valid_until?: string | null
          version: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          homologation_act_ref?: string
          id?: string
          label?: string
          requires_document?: boolean
          status?: string
          valid_from?: string
          valid_until?: string | null
          version?: number
        }
        Relationships: []
      }
      attendance_record_versions: {
        Row: {
          author_person_id: string
          author_user_id: string
          authorizing_engagement_id: string
          capability_policy_id: string
          capability_policy_version: number
          class_id: string
          component_id: string
          consulted_closing_id: string | null
          id: string
          lesson_logical_id: string
          lesson_version_id: string
          logical_attendance_id: string
          marks: Json
          plan_id: string
          recorded_at: string
          rectification: Json | null
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
          component_id: string
          consulted_closing_id?: string | null
          id?: string
          lesson_logical_id: string
          lesson_version_id: string
          logical_attendance_id: string
          marks: Json
          plan_id: string
          recorded_at?: string
          rectification?: Json | null
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
          component_id?: string
          consulted_closing_id?: string | null
          id?: string
          lesson_logical_id?: string
          lesson_version_id?: string
          logical_attendance_id?: string
          marks?: Json
          plan_id?: string
          recorded_at?: string
          rectification?: Json | null
          supersedes_version_id?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "attendance_record_versions_author_person_id_fkey"
            columns: ["author_person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_record_versions_authorizing_engagement_id_fkey"
            columns: ["authorizing_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_record_versions_capability_policy_id_fkey"
            columns: ["capability_policy_id"]
            isOneToOne: false
            referencedRelation: "capability_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_record_versions_lesson_version_id_fkey"
            columns: ["lesson_version_id"]
            isOneToOne: false
            referencedRelation: "lesson_record_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_record_versions_supersedes_version_id_fkey"
            columns: ["supersedes_version_id"]
            isOneToOne: true
            referencedRelation: "attendance_record_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      attribute_value_definitions: {
        Row: {
          change_reason: string | null
          created_at: string
          homologation_act_ref: string | null
          label: string
          recorded_by: string | null
          recorded_by_person_id: string | null
          scheme_id: string
          status: string
          valid_from: string | null
          value_id: string
          version: number
        }
        Insert: {
          change_reason?: string | null
          created_at?: string
          homologation_act_ref?: string | null
          label: string
          recorded_by?: string | null
          recorded_by_person_id?: string | null
          scheme_id: string
          status: string
          valid_from?: string | null
          value_id: string
          version: number
        }
        Update: {
          change_reason?: string | null
          created_at?: string
          homologation_act_ref?: string | null
          label?: string
          recorded_by?: string | null
          recorded_by_person_id?: string | null
          scheme_id?: string
          status?: string
          valid_from?: string | null
          value_id?: string
          version?: number
        }
        Relationships: []
      }
      calendar_authority_designations: {
        Row: {
          capabilities: string[]
          engagement_id: string
          id: string
          origin: string
          person_id: string
          recorded_at: string
          user_id: string
        }
        Insert: {
          capabilities: string[]
          engagement_id: string
          id?: string
          origin: string
          person_id: string
          recorded_at?: string
          user_id: string
        }
        Update: {
          capabilities?: string[]
          engagement_id?: string
          id?: string
          origin?: string
          person_id?: string
          recorded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_authority_designations_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: true
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_authority_designations_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_composition_norm_configuration_records: {
        Row: {
          created_at: string
          version_id: string
        }
        Insert: {
          created_at?: string
          version_id: string
        }
        Update: {
          created_at?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_composition_norm_configuration_records_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: true
            referencedRelation: "calendar_composition_norm_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_composition_norm_dimension_rules: {
        Row: {
          dimension_id: string
          on_absence: string
          operation: string
          version_id: string
        }
        Insert: {
          dimension_id: string
          on_absence: string
          operation: string
          version_id: string
        }
        Update: {
          dimension_id?: string
          on_absence?: string
          operation?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_composition_norm_dimension_rules_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "calendar_composition_norm_multiplicity"
            referencedColumns: ["version_id"]
          },
        ]
      }
      calendar_composition_norm_effect_bindings: {
        Row: {
          created_at: string
          dimension_id: string
          effect_contract_version: number
          effect_primitive: string
          version_id: string
        }
        Insert: {
          created_at?: string
          dimension_id: string
          effect_contract_version: number
          effect_primitive: string
          version_id: string
        }
        Update: {
          created_at?: string
          dimension_id?: string
          effect_contract_version?: number
          effect_primitive?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_composition_norm_effect_bindings_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "calendar_composition_norm_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_composition_norm_homologations: {
        Row: {
          created_at: string
          decision: string
          effective_from: string
          exercised_capability_id: string
          homologation_act_ref: string
          id: string
          reason: string | null
          recorded_by: string
          recorded_by_person_id: string
          recorded_via_engagement_id: string
          sequence: number
          supersedes_id: string | null
          version_id: string
        }
        Insert: {
          created_at?: string
          decision: string
          effective_from: string
          exercised_capability_id: string
          homologation_act_ref: string
          id?: string
          reason?: string | null
          recorded_by: string
          recorded_by_person_id: string
          recorded_via_engagement_id: string
          sequence: number
          supersedes_id?: string | null
          version_id: string
        }
        Update: {
          created_at?: string
          decision?: string
          effective_from?: string
          exercised_capability_id?: string
          homologation_act_ref?: string
          id?: string
          reason?: string | null
          recorded_by?: string
          recorded_by_person_id?: string
          recorded_via_engagement_id?: string
          sequence?: number
          supersedes_id?: string | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_composition_norm_homol_recorded_via_engagement_id_fkey"
            columns: ["recorded_via_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_composition_norm_homologati_recorded_by_person_id_fkey"
            columns: ["recorded_by_person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_composition_norm_homologations_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "calendar_composition_norm_homologations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_composition_norm_homologations_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "calendar_composition_norm_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_composition_norm_multiplicity: {
        Row: {
          operation: string
          version_id: string
        }
        Insert: {
          operation: string
          version_id: string
        }
        Update: {
          operation?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_composition_norm_multiplicity_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: true
            referencedRelation: "calendar_composition_norm_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_composition_norm_versions: {
        Row: {
          change_kind: string
          change_reason: string | null
          created_at: string
          id: string
          norm_id: string
          originating_act_ref: string
          recorded_by: string
          recorded_by_person_id: string
          recorded_via_engagement_id: string
          supersedes_id: string | null
          valid_from: string
          valid_until: string | null
          version: number
        }
        Insert: {
          change_kind: string
          change_reason?: string | null
          created_at?: string
          id?: string
          norm_id: string
          originating_act_ref: string
          recorded_by: string
          recorded_by_person_id: string
          recorded_via_engagement_id: string
          supersedes_id?: string | null
          valid_from: string
          valid_until?: string | null
          version: number
        }
        Update: {
          change_kind?: string
          change_reason?: string | null
          created_at?: string
          id?: string
          norm_id?: string
          originating_act_ref?: string
          recorded_by?: string
          recorded_by_person_id?: string
          recorded_via_engagement_id?: string
          supersedes_id?: string | null
          valid_from?: string
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "calendar_composition_norm_versi_recorded_via_engagement_id_fkey"
            columns: ["recorded_via_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_composition_norm_versions_norm_id_fkey"
            columns: ["norm_id"]
            isOneToOne: false
            referencedRelation: "calendar_composition_norms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_composition_norm_versions_recorded_by_person_id_fkey"
            columns: ["recorded_by_person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_composition_norm_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "calendar_composition_norm_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_composition_norms: {
        Row: {
          created_at: string
          id: string
        }
        Insert: {
          created_at?: string
          id: string
        }
        Update: {
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      calendar_day_type_versions: {
        Row: {
          change_kind: string
          change_reason: string | null
          created_at: string
          day_type_id: string
          id: string
          label: string
          originating_act_ref: string
          recorded_by: string
          recorded_by_person_id: string | null
          recorded_via_engagement_id: string | null
          school_day_effect: boolean | null
          supersedes_id: string | null
          version: number
        }
        Insert: {
          change_kind: string
          change_reason?: string | null
          created_at?: string
          day_type_id: string
          id?: string
          label: string
          originating_act_ref: string
          recorded_by: string
          recorded_by_person_id?: string | null
          recorded_via_engagement_id?: string | null
          school_day_effect?: boolean | null
          supersedes_id?: string | null
          version: number
        }
        Update: {
          change_kind?: string
          change_reason?: string | null
          created_at?: string
          day_type_id?: string
          id?: string
          label?: string
          originating_act_ref?: string
          recorded_by?: string
          recorded_by_person_id?: string | null
          recorded_via_engagement_id?: string | null
          school_day_effect?: boolean | null
          supersedes_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "calendar_day_type_versions_day_type_id_fkey"
            columns: ["day_type_id"]
            isOneToOne: false
            referencedRelation: "calendar_day_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_day_type_versions_recorded_by_person_id_fkey"
            columns: ["recorded_by_person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_day_type_versions_recorded_via_engagement_id_fkey"
            columns: ["recorded_via_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_day_type_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "calendar_day_type_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_day_types: {
        Row: {
          created_at: string
          id: string
        }
        Insert: {
          created_at?: string
          id: string
        }
        Update: {
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      calendar_network_day_type_links: {
        Row: {
          code: string
          created_at: string
          day_type_id: string
        }
        Insert: {
          code: string
          created_at?: string
          day_type_id: string
        }
        Update: {
          code?: string
          created_at?: string
          day_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_network_day_type_links_day_type_id_fkey"
            columns: ["day_type_id"]
            isOneToOne: true
            referencedRelation: "calendar_day_types"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_network_period_links: {
        Row: {
          created_at: string
          period_id: string
          period_key: string
          source_key: string
        }
        Insert: {
          created_at?: string
          period_id: string
          period_key: string
          source_key: string
        }
        Update: {
          created_at?: string
          period_id?: string
          period_key?: string
          source_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_network_period_links_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: true
            referencedRelation: "institutional_academic_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_network_period_links_source_key_fkey"
            columns: ["source_key"]
            isOneToOne: false
            referencedRelation: "calendar_network_source_links"
            referencedColumns: ["source_key"]
          },
        ]
      }
      calendar_network_source_links: {
        Row: {
          academic_year_id: string
          calendar_id: string
          created_at: string
          period_organization_id: string
          source_key: string
        }
        Insert: {
          academic_year_id: string
          calendar_id: string
          created_at?: string
          period_organization_id: string
          source_key: string
        }
        Update: {
          academic_year_id?: string
          calendar_id?: string
          created_at?: string
          period_organization_id?: string
          source_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_network_source_links_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "institutional_academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_network_source_links_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: true
            referencedRelation: "institutional_calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_network_source_links_period_organization_id_fkey"
            columns: ["period_organization_id"]
            isOneToOne: false
            referencedRelation: "institutional_period_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_network_year_links: {
        Row: {
          academic_year_id: string
          civil_year: number
          created_at: string
        }
        Insert: {
          academic_year_id: string
          civil_year: number
          created_at?: string
        }
        Update: {
          academic_year_id?: string
          civil_year?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_network_year_links_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: true
            referencedRelation: "institutional_academic_years"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_version_applicability_conditions: {
        Row: {
          allocation_logical_id: string | null
          condition_kind: string
          id: string
          position_logical_id: string | null
          scheme_id: string | null
          school_id: string | null
          scope_id: string
          value_id: string | null
          value_version: number | null
        }
        Insert: {
          allocation_logical_id?: string | null
          condition_kind: string
          id?: string
          position_logical_id?: string | null
          scheme_id?: string | null
          school_id?: string | null
          scope_id: string
          value_id?: string | null
          value_version?: number | null
        }
        Update: {
          allocation_logical_id?: string | null
          condition_kind?: string
          id?: string
          position_logical_id?: string | null
          scheme_id?: string | null
          school_id?: string | null
          scope_id?: string
          value_id?: string | null
          value_version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_version_applicabilit_scheme_id_value_id_value_ver_fkey"
            columns: ["scheme_id", "value_id", "value_version"]
            isOneToOne: false
            referencedRelation: "attribute_value_definitions"
            referencedColumns: ["scheme_id", "value_id", "version"]
          },
          {
            foreignKeyName: "calendar_version_applicability_conditions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_version_applicability_conditions_scope_id_fkey"
            columns: ["scope_id"]
            isOneToOne: false
            referencedRelation: "calendar_version_applicability_scopes"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_version_applicability_records: {
        Row: {
          created_at: string
          scope_count: number
          version_id: string
        }
        Insert: {
          created_at?: string
          scope_count: number
          version_id: string
        }
        Update: {
          created_at?: string
          scope_count?: number
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_version_applicability_records_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: true
            referencedRelation: "calendar_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_version_applicability_scope_windows: {
        Row: {
          scope_id: string
          window_from: string
          window_until: string
        }
        Insert: {
          scope_id: string
          window_from: string
          window_until: string
        }
        Update: {
          scope_id?: string
          window_from?: string
          window_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_version_applicability_scope_windows_scope_id_fkey"
            columns: ["scope_id"]
            isOneToOne: true
            referencedRelation: "calendar_version_applicability_scopes"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_version_applicability_scopes: {
        Row: {
          id: string
          label: string | null
          scope_key: string
          version_id: string
        }
        Insert: {
          id?: string
          label?: string | null
          scope_key: string
          version_id: string
        }
        Update: {
          id?: string
          label?: string | null
          scope_key?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_version_applicability_scopes_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "calendar_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_version_context_pending: {
        Row: {
          created_at: string
          reason: string
          version_id: string
        }
        Insert: {
          created_at?: string
          reason: string
          version_id: string
        }
        Update: {
          created_at?: string
          reason?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_version_context_pending_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: true
            referencedRelation: "calendar_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_version_council_configurations: {
        Row: {
          act_ref: string
          created_at: string
          declares_none: boolean
          recorded_by: string
          recorded_by_person_id: string
          recorded_via_engagement_id: string
          version_id: string
        }
        Insert: {
          act_ref: string
          created_at?: string
          declares_none: boolean
          recorded_by: string
          recorded_by_person_id: string
          recorded_via_engagement_id: string
          version_id: string
        }
        Update: {
          act_ref?: string
          created_at?: string
          declares_none?: boolean
          recorded_by?: string
          recorded_by_person_id?: string
          recorded_via_engagement_id?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_version_council_config_recorded_via_engagement_id_fkey"
            columns: ["recorded_via_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_version_council_configurati_recorded_by_person_id_fkey"
            columns: ["recorded_by_person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_version_council_configurations_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: true
            referencedRelation: "calendar_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_version_council_roles: {
        Row: {
          day_type_id: string
          role_label: string
          source_proposal: string | null
          version_id: string
        }
        Insert: {
          day_type_id: string
          role_label: string
          source_proposal?: string | null
          version_id: string
        }
        Update: {
          day_type_id?: string
          role_label?: string
          source_proposal?: string | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_version_council_roles_day_type_id_fkey"
            columns: ["day_type_id"]
            isOneToOne: false
            referencedRelation: "calendar_day_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_version_council_roles_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "calendar_version_council_configurations"
            referencedColumns: ["version_id"]
          },
        ]
      }
      calendar_version_day_assignments: {
        Row: {
          day: string
          day_type_version_id: string
          version_id: string
        }
        Insert: {
          day: string
          day_type_version_id: string
          version_id: string
        }
        Update: {
          day?: string
          day_type_version_id?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_version_day_assignments_day_type_version_id_fkey"
            columns: ["day_type_version_id"]
            isOneToOne: false
            referencedRelation: "calendar_day_type_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_version_day_assignments_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "calendar_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_version_events: {
        Row: {
          day_type_version_id: string
          ends_on: string
          id: string
          label: string
          starts_on: string
          version_id: string
        }
        Insert: {
          day_type_version_id: string
          ends_on: string
          id?: string
          label: string
          starts_on: string
          version_id: string
        }
        Update: {
          day_type_version_id?: string
          ends_on?: string
          id?: string
          label?: string
          starts_on?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_version_events_day_type_version_id_fkey"
            columns: ["day_type_version_id"]
            isOneToOne: false
            referencedRelation: "calendar_day_type_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_version_events_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "calendar_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_version_homologations: {
        Row: {
          calendar_version_id: string
          created_at: string
          decision: string
          effective_from: string
          exercised_capability_id: string
          homologation_act_ref: string
          id: string
          reason: string | null
          recorded_by: string
          recorded_by_person_id: string | null
          recorded_via_engagement_id: string
          sequence: number
          supersedes_id: string | null
        }
        Insert: {
          calendar_version_id: string
          created_at?: string
          decision: string
          effective_from: string
          exercised_capability_id: string
          homologation_act_ref: string
          id?: string
          reason?: string | null
          recorded_by: string
          recorded_by_person_id?: string | null
          recorded_via_engagement_id: string
          sequence: number
          supersedes_id?: string | null
        }
        Update: {
          calendar_version_id?: string
          created_at?: string
          decision?: string
          effective_from?: string
          exercised_capability_id?: string
          homologation_act_ref?: string
          id?: string
          reason?: string | null
          recorded_by?: string
          recorded_by_person_id?: string | null
          recorded_via_engagement_id?: string
          sequence?: number
          supersedes_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_version_homologations_calendar_version_id_fkey"
            columns: ["calendar_version_id"]
            isOneToOne: false
            referencedRelation: "calendar_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_version_homologations_recorded_by_person_id_fkey"
            columns: ["recorded_by_person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_version_homologations_recorded_via_engagement_id_fkey"
            columns: ["recorded_via_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_version_homologations_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "calendar_version_homologations"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_version_periods: {
        Row: {
          period_id: string
          version_id: string
        }
        Insert: {
          period_id: string
          version_id: string
        }
        Update: {
          period_id?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_version_periods_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "institutional_academic_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_version_periods_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "calendar_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_version_presentation_snapshots: {
        Row: {
          created_at: string
          declared_by_user_note: string | null
          presentation: Json
          recorded_by: string
          recorded_by_person_id: string
          recorded_via_engagement_id: string
          source_digest: string
          source_entry_id: string | null
          source_key: string | null
          source_kind: string
          source_raw: Json | null
          version_id: string
        }
        Insert: {
          created_at?: string
          declared_by_user_note?: string | null
          presentation: Json
          recorded_by: string
          recorded_by_person_id: string
          recorded_via_engagement_id: string
          source_digest: string
          source_entry_id?: string | null
          source_key?: string | null
          source_kind: string
          source_raw?: Json | null
          version_id: string
        }
        Update: {
          created_at?: string
          declared_by_user_note?: string | null
          presentation?: Json
          recorded_by?: string
          recorded_by_person_id?: string
          recorded_via_engagement_id?: string
          source_digest?: string
          source_entry_id?: string | null
          source_key?: string | null
          source_kind?: string
          source_raw?: Json | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_version_presentation_snapshots_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: true
            referencedRelation: "calendar_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_version_ranges: {
        Row: {
          day_type_version_id: string
          ends_on: string
          id: string
          starts_on: string
          version_id: string
        }
        Insert: {
          day_type_version_id: string
          ends_on: string
          id?: string
          starts_on: string
          version_id: string
        }
        Update: {
          day_type_version_id?: string
          ends_on?: string
          id?: string
          starts_on?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_version_ranges_day_type_version_id_fkey"
            columns: ["day_type_version_id"]
            isOneToOne: false
            referencedRelation: "calendar_day_type_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_version_ranges_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "calendar_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_versions: {
        Row: {
          academic_year_id: string
          calendar_id: string
          change_kind: string
          change_reason: string | null
          created_at: string
          id: string
          originating_act_ref: string
          period_organization_id: string
          recorded_by: string
          recorded_by_person_id: string | null
          recorded_via_engagement_id: string | null
          supersedes_id: string | null
          valid_from: string
          valid_until: string | null
          version: number
        }
        Insert: {
          academic_year_id: string
          calendar_id: string
          change_kind: string
          change_reason?: string | null
          created_at?: string
          id?: string
          originating_act_ref: string
          period_organization_id: string
          recorded_by: string
          recorded_by_person_id?: string | null
          recorded_via_engagement_id?: string | null
          supersedes_id?: string | null
          valid_from: string
          valid_until?: string | null
          version: number
        }
        Update: {
          academic_year_id?: string
          calendar_id?: string
          change_kind?: string
          change_reason?: string | null
          created_at?: string
          id?: string
          originating_act_ref?: string
          period_organization_id?: string
          recorded_by?: string
          recorded_by_person_id?: string | null
          recorded_via_engagement_id?: string | null
          supersedes_id?: string | null
          valid_from?: string
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "calendar_versions_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "institutional_calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_versions_period_organization_id_academic_year_id_fkey"
            columns: ["period_organization_id", "academic_year_id"]
            isOneToOne: false
            referencedRelation: "institutional_period_organizations"
            referencedColumns: ["id", "academic_year_id"]
          },
          {
            foreignKeyName: "calendar_versions_recorded_by_person_id_fkey"
            columns: ["recorded_by_person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_versions_recorded_via_engagement_id_fkey"
            columns: ["recorded_via_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "calendar_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      capability_policies: {
        Row: {
          created_at: string
          homologated_at: string | null
          homologated_by: string | null
          homologation_act_ref: string | null
          homologation_origin: string | null
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
          homologated_by?: string | null
          homologation_act_ref?: string | null
          homologation_origin?: string | null
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
          homologated_by?: string | null
          homologation_act_ref?: string | null
          homologation_origin?: string | null
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
      class_allocation_ending_versions: {
        Row: {
          allocation_logical_id: string
          annulled: boolean
          class_id: string
          correction_reason: string | null
          created_at: string
          ended_on: string | null
          id: string
          originating_act_ref: string | null
          reason_text: string | null
          recorded_by: string
          school_id: string
          supersedes_id: string | null
          version: number
        }
        Insert: {
          allocation_logical_id: string
          annulled?: boolean
          class_id: string
          correction_reason?: string | null
          created_at?: string
          ended_on?: string | null
          id?: string
          originating_act_ref?: string | null
          reason_text?: string | null
          recorded_by: string
          school_id: string
          supersedes_id?: string | null
          version: number
        }
        Update: {
          allocation_logical_id?: string
          annulled?: boolean
          class_id?: string
          correction_reason?: string | null
          created_at?: string
          ended_on?: string | null
          id?: string
          originating_act_ref?: string | null
          reason_text?: string | null
          recorded_by?: string
          school_id?: string
          supersedes_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_allocation_ending_versions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "institutional_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_allocation_ending_versions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_allocation_ending_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "class_allocation_ending_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      class_capacity_records: {
        Row: {
          annulled: boolean
          basis_text: string | null
          change_reason: string | null
          class_id: string
          created_at: string
          id: string
          logical_id: string
          originating_act_ref: string | null
          recorded_by: string
          reference_limit: number | null
          school_id: string
          supersedes_id: string | null
          valid_from: string
          valid_until: string | null
          version: number
        }
        Insert: {
          annulled?: boolean
          basis_text?: string | null
          change_reason?: string | null
          class_id: string
          created_at?: string
          id?: string
          logical_id: string
          originating_act_ref?: string | null
          recorded_by: string
          reference_limit?: number | null
          school_id: string
          supersedes_id?: string | null
          valid_from: string
          valid_until?: string | null
          version: number
        }
        Update: {
          annulled?: boolean
          basis_text?: string | null
          change_reason?: string | null
          class_id?: string
          created_at?: string
          id?: string
          logical_id?: string
          originating_act_ref?: string | null
          recorded_by?: string
          reference_limit?: number | null
          school_id?: string
          supersedes_id?: string | null
          valid_from?: string
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_capacity_records_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "institutional_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_capacity_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_capacity_records_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "class_capacity_records"
            referencedColumns: ["id"]
          },
        ]
      }
      class_enrollment_episode_endings: {
        Row: {
          created_at: string
          ended_on: string
          episode_id: string
          originating_act_ref: string | null
          reason_label: string | null
        }
        Insert: {
          created_at?: string
          ended_on: string
          episode_id: string
          originating_act_ref?: string | null
          reason_label?: string | null
        }
        Update: {
          created_at?: string
          ended_on?: string
          episode_id?: string
          originating_act_ref?: string | null
          reason_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_enrollment_episode_endings_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: true
            referencedRelation: "class_enrollment_episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_enrollment_episodes: {
        Row: {
          class_id: string
          class_label_snapshot: string
          correction_reason: string | null
          created_at: string
          cycle_id: string | null
          enrollment_id: string
          id: string
          logical_id: string | null
          originating_act_ref: string | null
          participation_logical_id: string | null
          recorded_by: string | null
          school_id: string
          student_id: string
          supersedes_id: string | null
          valid_from: string
        }
        Insert: {
          class_id: string
          class_label_snapshot: string
          correction_reason?: string | null
          created_at?: string
          cycle_id?: string | null
          enrollment_id: string
          id: string
          logical_id?: string | null
          originating_act_ref?: string | null
          participation_logical_id?: string | null
          recorded_by?: string | null
          school_id: string
          student_id: string
          supersedes_id?: string | null
          valid_from: string
        }
        Update: {
          class_id?: string
          class_label_snapshot?: string
          correction_reason?: string | null
          created_at?: string
          cycle_id?: string | null
          enrollment_id?: string
          id?: string
          logical_id?: string | null
          originating_act_ref?: string | null
          participation_logical_id?: string | null
          recorded_by?: string | null
          school_id?: string
          student_id?: string
          supersedes_id?: string | null
          valid_from?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_enrollment_episodes_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "school_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_enrollment_episodes_school_fk"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_enrollment_episodes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "institutional_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_enrollment_episodes_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "class_enrollment_episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_journey_intervals: {
        Row: {
          ends_at: string
          starts_at: string
          version_id: string
          weekday: number
        }
        Insert: {
          ends_at: string
          starts_at: string
          version_id: string
          weekday: number
        }
        Update: {
          ends_at?: string
          starts_at?: string
          version_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_journey_intervals_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "class_journey_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      class_journey_versions: {
        Row: {
          change_kind: string
          change_reason: string | null
          created_at: string
          id: string
          journey_id: string
          originating_act_ref: string
          recorded_by: string
          recorded_by_person_id: string | null
          supersedes_id: string | null
          valid_from: string
          valid_until: string | null
          version: number
        }
        Insert: {
          change_kind: string
          change_reason?: string | null
          created_at?: string
          id?: string
          journey_id: string
          originating_act_ref: string
          recorded_by: string
          recorded_by_person_id?: string | null
          supersedes_id?: string | null
          valid_from: string
          valid_until?: string | null
          version: number
        }
        Update: {
          change_kind?: string
          change_reason?: string | null
          created_at?: string
          id?: string
          journey_id?: string
          originating_act_ref?: string
          recorded_by?: string
          recorded_by_person_id?: string | null
          supersedes_id?: string | null
          valid_from?: string
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_journey_versions_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "class_journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_journey_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "class_journey_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      class_journeys: {
        Row: {
          class_id: string
          created_at: string
          id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_journeys_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: true
            referencedRelation: "institutional_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_offering_axis_values: {
        Row: {
          offering_version_id: string
          scheme_id: string
          value_id: string
          value_version: number
        }
        Insert: {
          offering_version_id: string
          scheme_id: string
          value_id: string
          value_version: number
        }
        Update: {
          offering_version_id?: string
          scheme_id?: string
          value_id?: string
          value_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_offering_axis_values_offering_version_id_fkey"
            columns: ["offering_version_id"]
            isOneToOne: false
            referencedRelation: "class_offering_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_offering_axis_values_scheme_id_value_id_value_versio_fkey"
            columns: ["scheme_id", "value_id", "value_version"]
            isOneToOne: false
            referencedRelation: "attribute_value_definitions"
            referencedColumns: ["scheme_id", "value_id", "version"]
          },
        ]
      }
      class_offering_versions: {
        Row: {
          class_id: string
          correction_reason: string | null
          created_at: string
          id: string
          logical_id: string
          originating_act_ref: string | null
          recorded_by: string
          supersedes_id: string | null
          valid_from: string | null
          valid_until: string | null
          version: number
        }
        Insert: {
          class_id: string
          correction_reason?: string | null
          created_at?: string
          id?: string
          logical_id: string
          originating_act_ref?: string | null
          recorded_by: string
          supersedes_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
          version: number
        }
        Update: {
          class_id?: string
          correction_reason?: string | null
          created_at?: string
          id?: string
          logical_id?: string
          originating_act_ref?: string | null
          recorded_by?: string
          supersedes_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_offering_versions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "institutional_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_offering_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "class_offering_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      class_schedule_block_engagements: {
        Row: {
          block_id: string
          engagement_id: string
        }
        Insert: {
          block_id: string
          engagement_id: string
        }
        Update: {
          block_id?: string
          engagement_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_schedule_block_engagements_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "class_schedule_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedule_block_engagements_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      class_schedule_blocks: {
        Row: {
          block_key: string
          component_id: string | null
          ends_at: string
          id: string
          nature_scheme_id: string | null
          nature_value_id: string | null
          nature_value_version: number | null
          starts_at: string
          version_id: string
          weekday: number
        }
        Insert: {
          block_key: string
          component_id?: string | null
          ends_at: string
          id?: string
          nature_scheme_id?: string | null
          nature_value_id?: string | null
          nature_value_version?: number | null
          starts_at: string
          version_id: string
          weekday: number
        }
        Update: {
          block_key?: string
          component_id?: string | null
          ends_at?: string
          id?: string
          nature_scheme_id?: string | null
          nature_value_id?: string | null
          nature_value_version?: number | null
          starts_at?: string
          version_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_schedule_blocks_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "institutional_curricular_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedule_blocks_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "class_schedule_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      class_schedule_versions: {
        Row: {
          change_kind: string
          change_reason: string | null
          created_at: string
          id: string
          originating_act_ref: string
          recorded_by: string
          recorded_by_person_id: string | null
          schedule_id: string
          supersedes_id: string | null
          valid_from: string
          valid_until: string | null
          version: number
        }
        Insert: {
          change_kind: string
          change_reason?: string | null
          created_at?: string
          id?: string
          originating_act_ref: string
          recorded_by: string
          recorded_by_person_id?: string | null
          schedule_id: string
          supersedes_id?: string | null
          valid_from: string
          valid_until?: string | null
          version: number
        }
        Update: {
          change_kind?: string
          change_reason?: string | null
          created_at?: string
          id?: string
          originating_act_ref?: string
          recorded_by?: string
          recorded_by_person_id?: string | null
          schedule_id?: string
          supersedes_id?: string | null
          valid_from?: string
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_schedule_versions_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "class_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedule_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "class_schedule_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      class_schedules: {
        Row: {
          class_id: string
          created_at: string
          id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_schedules_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: true
            referencedRelation: "institutional_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_shift_versions: {
        Row: {
          class_id: string
          correction_reason: string | null
          created_at: string
          id: string
          logical_id: string
          originating_act_ref: string | null
          recorded_by: string
          shift_scheme_id: string
          shift_value_id: string
          shift_value_version: number
          supersedes_id: string | null
          valid_from: string | null
          valid_until: string | null
          version: number
        }
        Insert: {
          class_id: string
          correction_reason?: string | null
          created_at?: string
          id?: string
          logical_id: string
          originating_act_ref?: string | null
          recorded_by: string
          shift_scheme_id?: string
          shift_value_id: string
          shift_value_version: number
          supersedes_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
          version: number
        }
        Update: {
          class_id?: string
          correction_reason?: string | null
          created_at?: string
          id?: string
          logical_id?: string
          originating_act_ref?: string | null
          recorded_by?: string
          shift_scheme_id?: string
          shift_value_id?: string
          shift_value_version?: number
          supersedes_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_shift_versions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "institutional_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_shift_versions_shift_scheme_id_shift_value_id_shift__fkey"
            columns: [
              "shift_scheme_id",
              "shift_value_id",
              "shift_value_version",
            ]
            isOneToOne: false
            referencedRelation: "attribute_value_definitions"
            referencedColumns: ["scheme_id", "value_id", "version"]
          },
          {
            foreignKeyName: "class_shift_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "class_shift_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      class_specific_matrix_association_homologations: {
        Row: {
          association_version_id: string
          created_at: string
          decision: string
          effective_from: string
          exercised_capability_id: string
          homologation_act_ref: string | null
          id: string
          reason: string | null
          recorded_by: string
          recorded_by_person_id: string | null
          recorded_via_engagement_id: string
          sequence: number
          supersedes_id: string | null
        }
        Insert: {
          association_version_id: string
          created_at?: string
          decision: string
          effective_from: string
          exercised_capability_id: string
          homologation_act_ref?: string | null
          id?: string
          reason?: string | null
          recorded_by: string
          recorded_by_person_id?: string | null
          recorded_via_engagement_id: string
          sequence: number
          supersedes_id?: string | null
        }
        Update: {
          association_version_id?: string
          created_at?: string
          decision?: string
          effective_from?: string
          exercised_capability_id?: string
          homologation_act_ref?: string | null
          id?: string
          reason?: string | null
          recorded_by?: string
          recorded_by_person_id?: string | null
          recorded_via_engagement_id?: string
          sequence?: number
          supersedes_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_specific_matrix_association_h_association_version_id_fkey"
            columns: ["association_version_id"]
            isOneToOne: false
            referencedRelation: "class_specific_matrix_association_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_specific_matrix_association_homologati_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "class_specific_matrix_association_homologations"
            referencedColumns: ["id"]
          },
        ]
      }
      class_specific_matrix_association_versions: {
        Row: {
          association_id: string
          change_kind: string
          change_reason: string | null
          created_at: string
          id: string
          recorded_by: string
          recorded_by_person_id: string | null
          recorded_via_engagement_id: string
          specific_act_ref: string | null
          supersedes_id: string | null
          target_column_key: string | null
          target_matrix_id: string
          valid_from: string
          valid_until: string | null
          version: number
        }
        Insert: {
          association_id: string
          change_kind: string
          change_reason?: string | null
          created_at?: string
          id?: string
          recorded_by: string
          recorded_by_person_id?: string | null
          recorded_via_engagement_id: string
          specific_act_ref?: string | null
          supersedes_id?: string | null
          target_column_key?: string | null
          target_matrix_id: string
          valid_from: string
          valid_until?: string | null
          version: number
        }
        Update: {
          association_id?: string
          change_kind?: string
          change_reason?: string | null
          created_at?: string
          id?: string
          recorded_by?: string
          recorded_by_person_id?: string | null
          recorded_via_engagement_id?: string
          specific_act_ref?: string | null
          supersedes_id?: string | null
          target_column_key?: string | null
          target_matrix_id?: string
          valid_from?: string
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_specific_matrix_association_version_target_matrix_id_fkey"
            columns: ["target_matrix_id"]
            isOneToOne: false
            referencedRelation: "institutional_curricular_matrices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_specific_matrix_association_versions_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "class_specific_matrix_associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_specific_matrix_association_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "class_specific_matrix_association_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      class_specific_matrix_associations: {
        Row: {
          class_id: string
          created_at: string
          id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_specific_matrix_associations_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "institutional_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      collegial_body_configurations: {
        Row: {
          conduct_capabilities: string[]
          created_at: string
          definition: Json
          homologated_at: string | null
          homologation_act_ref: string | null
          id: string
          status: string
          version: number
        }
        Insert: {
          conduct_capabilities?: string[]
          created_at?: string
          definition: Json
          homologated_at?: string | null
          homologation_act_ref?: string | null
          id: string
          status: string
          version: number
        }
        Update: {
          conduct_capabilities?: string[]
          created_at?: string
          definition?: Json
          homologated_at?: string | null
          homologation_act_ref?: string | null
          id?: string
          status?: string
          version?: number
        }
        Relationships: []
      }
      collegial_deliberations: {
        Row: {
          agenda_item_id: string
          author_person_id: string
          author_user_id: string
          authorizing_engagement_id: string
          capability_policy_id: string
          capability_policy_version: number
          class_id: string
          document: Json
          id: string
          plan_id: string
          recorded_at: string
          session_id: string
          student_id: string | null
        }
        Insert: {
          agenda_item_id: string
          author_person_id: string
          author_user_id: string
          authorizing_engagement_id: string
          capability_policy_id: string
          capability_policy_version: number
          class_id: string
          document: Json
          id: string
          plan_id: string
          recorded_at?: string
          session_id: string
          student_id?: string | null
        }
        Update: {
          agenda_item_id?: string
          author_person_id?: string
          author_user_id?: string
          authorizing_engagement_id?: string
          capability_policy_id?: string
          capability_policy_version?: number
          class_id?: string
          document?: Json
          id?: string
          plan_id?: string
          recorded_at?: string
          session_id?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collegial_deliberations_author_person_id_fkey"
            columns: ["author_person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collegial_deliberations_authorizing_engagement_id_fkey"
            columns: ["authorizing_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collegial_deliberations_capability_policy_id_fkey"
            columns: ["capability_policy_id"]
            isOneToOne: false
            referencedRelation: "capability_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      collegial_minute_versions: {
        Row: {
          author_person_id: string
          author_user_id: string
          authorizing_engagement_id: string
          capability_policy_id: string
          capability_policy_version: number
          class_id: string
          closed_at: string
          deliberation_ids: string[]
          document: Json
          id: string
          plan_id: string
          preceding_minute_id: string | null
          rectification_justification: string | null
          session_id: string
          version: number
        }
        Insert: {
          author_person_id: string
          author_user_id: string
          authorizing_engagement_id: string
          capability_policy_id: string
          capability_policy_version: number
          class_id: string
          closed_at?: string
          deliberation_ids: string[]
          document: Json
          id: string
          plan_id: string
          preceding_minute_id?: string | null
          rectification_justification?: string | null
          session_id: string
          version: number
        }
        Update: {
          author_person_id?: string
          author_user_id?: string
          authorizing_engagement_id?: string
          capability_policy_id?: string
          capability_policy_version?: number
          class_id?: string
          closed_at?: string
          deliberation_ids?: string[]
          document?: Json
          id?: string
          plan_id?: string
          preceding_minute_id?: string | null
          rectification_justification?: string | null
          session_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "collegial_minute_versions_author_person_id_fkey"
            columns: ["author_person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collegial_minute_versions_authorizing_engagement_id_fkey"
            columns: ["authorizing_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collegial_minute_versions_capability_policy_id_fkey"
            columns: ["capability_policy_id"]
            isOneToOne: false
            referencedRelation: "capability_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collegial_minute_versions_preceding_minute_id_fkey"
            columns: ["preceding_minute_id"]
            isOneToOne: true
            referencedRelation: "collegial_minute_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      collegial_session_events: {
        Row: {
          acted_at: string
          author_person_id: string
          author_user_id: string
          authorizing_engagement_id: string
          body_configuration_version: number
          body_id: string
          capability_policy_id: string
          capability_policy_version: number
          class_id: string
          document: Json
          id: string
          kind: string
          plan_id: string
          preceding_event_id: string | null
          sequence: number
          session_id: string
        }
        Insert: {
          acted_at?: string
          author_person_id: string
          author_user_id: string
          authorizing_engagement_id: string
          body_configuration_version: number
          body_id: string
          capability_policy_id: string
          capability_policy_version: number
          class_id: string
          document: Json
          id?: string
          kind: string
          plan_id: string
          preceding_event_id?: string | null
          sequence: number
          session_id: string
        }
        Update: {
          acted_at?: string
          author_person_id?: string
          author_user_id?: string
          authorizing_engagement_id?: string
          body_configuration_version?: number
          body_id?: string
          capability_policy_id?: string
          capability_policy_version?: number
          class_id?: string
          document?: Json
          id?: string
          kind?: string
          plan_id?: string
          preceding_event_id?: string | null
          sequence?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collegial_session_events_author_person_id_fkey"
            columns: ["author_person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collegial_session_events_authorizing_engagement_id_fkey"
            columns: ["authorizing_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collegial_session_events_body_id_body_configuration_versio_fkey"
            columns: ["body_id", "body_configuration_version"]
            isOneToOne: false
            referencedRelation: "collegial_body_configurations"
            referencedColumns: ["id", "version"]
          },
          {
            foreignKeyName: "collegial_session_events_capability_policy_id_fkey"
            columns: ["capability_policy_id"]
            isOneToOne: false
            referencedRelation: "capability_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collegial_session_events_preceding_event_id_fkey"
            columns: ["preceding_event_id"]
            isOneToOne: true
            referencedRelation: "collegial_session_events"
            referencedColumns: ["id"]
          },
        ]
      }
      curricular_component_versions: {
        Row: {
          change_reason: string | null
          component_id: string
          created_at: string
          id: string
          is_active: boolean
          official_name: string
          originating_act_ref: string
          recorded_by: string
          recorded_by_person_id: string | null
          recorded_via_engagement_id: string
          short_name: string | null
          supersedes_id: string | null
          valid_from: string
          version: number
        }
        Insert: {
          change_reason?: string | null
          component_id: string
          created_at?: string
          id?: string
          is_active: boolean
          official_name: string
          originating_act_ref: string
          recorded_by: string
          recorded_by_person_id?: string | null
          recorded_via_engagement_id: string
          short_name?: string | null
          supersedes_id?: string | null
          valid_from: string
          version: number
        }
        Update: {
          change_reason?: string | null
          component_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          official_name?: string
          originating_act_ref?: string
          recorded_by?: string
          recorded_by_person_id?: string | null
          recorded_via_engagement_id?: string
          short_name?: string | null
          supersedes_id?: string | null
          valid_from?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "curricular_component_versions_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "institutional_curricular_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curricular_component_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "curricular_component_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      curricular_correspondence_profile_homologations: {
        Row: {
          created_at: string
          decision: string
          effective_from: string
          exercised_capability_id: string
          homologation_act_ref: string | null
          id: string
          profile_version_id: string
          reason: string | null
          recorded_by: string
          recorded_by_person_id: string | null
          recorded_via_engagement_id: string
          sequence: number
          supersedes_id: string | null
        }
        Insert: {
          created_at?: string
          decision: string
          effective_from: string
          exercised_capability_id: string
          homologation_act_ref?: string | null
          id?: string
          profile_version_id: string
          reason?: string | null
          recorded_by: string
          recorded_by_person_id?: string | null
          recorded_via_engagement_id: string
          sequence: number
          supersedes_id?: string | null
        }
        Update: {
          created_at?: string
          decision?: string
          effective_from?: string
          exercised_capability_id?: string
          homologation_act_ref?: string | null
          id?: string
          profile_version_id?: string
          reason?: string | null
          recorded_by?: string
          recorded_by_person_id?: string | null
          recorded_via_engagement_id?: string
          sequence?: number
          supersedes_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "curricular_correspondence_profile_homol_profile_version_id_fkey"
            columns: ["profile_version_id"]
            isOneToOne: false
            referencedRelation: "curricular_correspondence_profile_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curricular_correspondence_profile_homologati_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "curricular_correspondence_profile_homologations"
            referencedColumns: ["id"]
          },
        ]
      }
      curricular_correspondence_profile_nature_axis: {
        Row: {
          profile_version_id: string
          scheme_id: string
        }
        Insert: {
          profile_version_id: string
          scheme_id: string
        }
        Update: {
          profile_version_id?: string
          scheme_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "curricular_correspondence_profile_natur_profile_version_id_fkey"
            columns: ["profile_version_id"]
            isOneToOne: true
            referencedRelation: "curricular_correspondence_profile_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      curricular_correspondence_profile_nature_gates: {
        Row: {
          effect: string
          profile_version_id: string
          scheme_id: string
          value_id: string
          value_version: number
        }
        Insert: {
          effect: string
          profile_version_id: string
          scheme_id: string
          value_id: string
          value_version: number
        }
        Update: {
          effect?: string
          profile_version_id?: string
          scheme_id?: string
          value_id?: string
          value_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "curricular_correspondence_pro_profile_version_id_scheme_id_fkey"
            columns: ["profile_version_id", "scheme_id"]
            isOneToOne: false
            referencedRelation: "curricular_correspondence_profile_nature_axis"
            referencedColumns: ["profile_version_id", "scheme_id"]
          },
        ]
      }
      curricular_correspondence_profile_position_keys: {
        Row: {
          profile_version_id: string
          scheme_id: string
        }
        Insert: {
          profile_version_id: string
          scheme_id: string
        }
        Update: {
          profile_version_id?: string
          scheme_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "curricular_correspondence_profile_posit_profile_version_id_fkey"
            columns: ["profile_version_id"]
            isOneToOne: false
            referencedRelation: "curricular_correspondence_profile_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      curricular_correspondence_profile_versions: {
        Row: {
          applicability_rule_scheme_id: string | null
          applicability_rule_value_id: string | null
          applicability_rule_value_version: number | null
          change_kind: string
          change_reason: string | null
          created_at: string
          id: string
          originating_act_ref: string | null
          profile_id: string
          recorded_by: string
          recorded_by_person_id: string | null
          recorded_via_engagement_id: string
          supersedes_id: string | null
          valid_from: string
          valid_until: string | null
          version: number
        }
        Insert: {
          applicability_rule_scheme_id?: string | null
          applicability_rule_value_id?: string | null
          applicability_rule_value_version?: number | null
          change_kind: string
          change_reason?: string | null
          created_at?: string
          id?: string
          originating_act_ref?: string | null
          profile_id: string
          recorded_by: string
          recorded_by_person_id?: string | null
          recorded_via_engagement_id: string
          supersedes_id?: string | null
          valid_from: string
          valid_until?: string | null
          version: number
        }
        Update: {
          applicability_rule_scheme_id?: string | null
          applicability_rule_value_id?: string | null
          applicability_rule_value_version?: number | null
          change_kind?: string
          change_reason?: string | null
          created_at?: string
          id?: string
          originating_act_ref?: string | null
          profile_id?: string
          recorded_by?: string
          recorded_by_person_id?: string | null
          recorded_via_engagement_id?: string
          supersedes_id?: string | null
          valid_from?: string
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "curricular_correspondence_profile_versions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "curricular_correspondence_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curricular_correspondence_profile_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "curricular_correspondence_profile_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      curricular_correspondence_profiles: {
        Row: {
          created_at: string
          id: string
        }
        Insert: {
          created_at?: string
          id: string
        }
        Update: {
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      curricular_matrix_applicability: {
        Row: {
          academic_year_id: string | null
          dimension: string
          id: string
          matrix_version_id: string
          scheme_id: string | null
          school_id: string | null
          value_id: string | null
          value_version: number | null
        }
        Insert: {
          academic_year_id?: string | null
          dimension: string
          id?: string
          matrix_version_id: string
          scheme_id?: string | null
          school_id?: string | null
          value_id?: string | null
          value_version?: number | null
        }
        Update: {
          academic_year_id?: string | null
          dimension?: string
          id?: string
          matrix_version_id?: string
          scheme_id?: string | null
          school_id?: string | null
          value_id?: string | null
          value_version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "curricular_matrix_applicability_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "institutional_academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curricular_matrix_applicability_matrix_version_id_fkey"
            columns: ["matrix_version_id"]
            isOneToOne: false
            referencedRelation: "curricular_matrix_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curricular_matrix_applicability_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
        ]
      }
      curricular_matrix_items: {
        Row: {
          component_id: string | null
          component_label_snapshot: string | null
          element_scheme_id: string | null
          element_value_id: string | null
          element_value_version: number | null
          id: string
          item_key: string
          matrix_version_id: string
          position: number
          quantity: number | null
          unit_scheme_id: string | null
          unit_value_id: string | null
          unit_value_version: number | null
        }
        Insert: {
          component_id?: string | null
          component_label_snapshot?: string | null
          element_scheme_id?: string | null
          element_value_id?: string | null
          element_value_version?: number | null
          id?: string
          item_key: string
          matrix_version_id: string
          position: number
          quantity?: number | null
          unit_scheme_id?: string | null
          unit_value_id?: string | null
          unit_value_version?: number | null
        }
        Update: {
          component_id?: string | null
          component_label_snapshot?: string | null
          element_scheme_id?: string | null
          element_value_id?: string | null
          element_value_version?: number | null
          id?: string
          item_key?: string
          matrix_version_id?: string
          position?: number
          quantity?: number | null
          unit_scheme_id?: string | null
          unit_value_id?: string | null
          unit_value_version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "curricular_matrix_items_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "institutional_curricular_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curricular_matrix_items_matrix_version_id_fkey"
            columns: ["matrix_version_id"]
            isOneToOne: false
            referencedRelation: "curricular_matrix_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      curricular_matrix_layout_cells: {
        Row: {
          column_key: string
          id: string
          matrix_version_id: string
          numeric_literal: number | null
          row_key: string
          source_text: string
          unit_scheme_id: string | null
          unit_value_id: string | null
          unit_value_version: number | null
        }
        Insert: {
          column_key: string
          id?: string
          matrix_version_id: string
          numeric_literal?: number | null
          row_key: string
          source_text: string
          unit_scheme_id?: string | null
          unit_value_id?: string | null
          unit_value_version?: number | null
        }
        Update: {
          column_key?: string
          id?: string
          matrix_version_id?: string
          numeric_literal?: number | null
          row_key?: string
          source_text?: string
          unit_scheme_id?: string | null
          unit_value_id?: string | null
          unit_value_version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "curricular_matrix_layout_cell_matrix_version_id_column_key_fkey"
            columns: ["matrix_version_id", "column_key"]
            isOneToOne: false
            referencedRelation: "curricular_matrix_layout_columns"
            referencedColumns: ["matrix_version_id", "column_key"]
          },
          {
            foreignKeyName: "curricular_matrix_layout_cells_matrix_version_id_fkey"
            columns: ["matrix_version_id"]
            isOneToOne: false
            referencedRelation: "curricular_matrix_layouts"
            referencedColumns: ["matrix_version_id"]
          },
          {
            foreignKeyName: "curricular_matrix_layout_cells_matrix_version_id_row_key_fkey"
            columns: ["matrix_version_id", "row_key"]
            isOneToOne: false
            referencedRelation: "curricular_matrix_layout_rows"
            referencedColumns: ["matrix_version_id", "row_key"]
          },
        ]
      }
      curricular_matrix_layout_columns: {
        Row: {
          column_key: string
          header_text: string
          id: string
          matrix_version_id: string
          parent_column_key: string | null
          position: number
          ref_scheme_id: string | null
          ref_value_id: string | null
          ref_value_version: number | null
        }
        Insert: {
          column_key: string
          header_text: string
          id?: string
          matrix_version_id: string
          parent_column_key?: string | null
          position: number
          ref_scheme_id?: string | null
          ref_value_id?: string | null
          ref_value_version?: number | null
        }
        Update: {
          column_key?: string
          header_text?: string
          id?: string
          matrix_version_id?: string
          parent_column_key?: string | null
          position?: number
          ref_scheme_id?: string | null
          ref_value_id?: string | null
          ref_value_version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "curricular_matrix_layout_colu_matrix_version_id_parent_col_fkey"
            columns: ["matrix_version_id", "parent_column_key"]
            isOneToOne: false
            referencedRelation: "curricular_matrix_layout_columns"
            referencedColumns: ["matrix_version_id", "column_key"]
          },
          {
            foreignKeyName: "curricular_matrix_layout_columns_matrix_version_id_fkey"
            columns: ["matrix_version_id"]
            isOneToOne: false
            referencedRelation: "curricular_matrix_layouts"
            referencedColumns: ["matrix_version_id"]
          },
        ]
      }
      curricular_matrix_layout_groups: {
        Row: {
          group_key: string
          id: string
          label_text: string
          matrix_version_id: string
          parent_group_key: string | null
          position: number
        }
        Insert: {
          group_key: string
          id?: string
          label_text: string
          matrix_version_id: string
          parent_group_key?: string | null
          position: number
        }
        Update: {
          group_key?: string
          id?: string
          label_text?: string
          matrix_version_id?: string
          parent_group_key?: string | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "curricular_matrix_layout_grou_matrix_version_id_parent_gro_fkey"
            columns: ["matrix_version_id", "parent_group_key"]
            isOneToOne: false
            referencedRelation: "curricular_matrix_layout_groups"
            referencedColumns: ["matrix_version_id", "group_key"]
          },
          {
            foreignKeyName: "curricular_matrix_layout_groups_matrix_version_id_fkey"
            columns: ["matrix_version_id"]
            isOneToOne: false
            referencedRelation: "curricular_matrix_layouts"
            referencedColumns: ["matrix_version_id"]
          },
        ]
      }
      curricular_matrix_layout_notes: {
        Row: {
          id: string
          marker: string | null
          matrix_version_id: string
          note_key: string
          note_text: string
          position: number
        }
        Insert: {
          id?: string
          marker?: string | null
          matrix_version_id: string
          note_key: string
          note_text: string
          position: number
        }
        Update: {
          id?: string
          marker?: string | null
          matrix_version_id?: string
          note_key?: string
          note_text?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "curricular_matrix_layout_notes_matrix_version_id_fkey"
            columns: ["matrix_version_id"]
            isOneToOne: false
            referencedRelation: "curricular_matrix_layouts"
            referencedColumns: ["matrix_version_id"]
          },
        ]
      }
      curricular_matrix_layout_rows: {
        Row: {
          group_key: string | null
          id: string
          item_key: string | null
          label_text: string | null
          matrix_version_id: string
          position: number
          row_key: string
          row_role: string
        }
        Insert: {
          group_key?: string | null
          id?: string
          item_key?: string | null
          label_text?: string | null
          matrix_version_id: string
          position: number
          row_key: string
          row_role: string
        }
        Update: {
          group_key?: string | null
          id?: string
          item_key?: string | null
          label_text?: string | null
          matrix_version_id?: string
          position?: number
          row_key?: string
          row_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "curricular_matrix_layout_rows_matrix_version_id_fkey"
            columns: ["matrix_version_id"]
            isOneToOne: false
            referencedRelation: "curricular_matrix_layouts"
            referencedColumns: ["matrix_version_id"]
          },
          {
            foreignKeyName: "curricular_matrix_layout_rows_matrix_version_id_group_key_fkey"
            columns: ["matrix_version_id", "group_key"]
            isOneToOne: false
            referencedRelation: "curricular_matrix_layout_groups"
            referencedColumns: ["matrix_version_id", "group_key"]
          },
          {
            foreignKeyName: "curricular_matrix_layout_rows_matrix_version_id_item_key_fkey"
            columns: ["matrix_version_id", "item_key"]
            isOneToOne: true
            referencedRelation: "curricular_matrix_items"
            referencedColumns: ["matrix_version_id", "item_key"]
          },
        ]
      }
      curricular_matrix_layouts: {
        Row: {
          matrix_version_id: string
          recorded_at: string
          source_document_sha256: string | null
          source_locator: string
          source_page: string | null
        }
        Insert: {
          matrix_version_id: string
          recorded_at?: string
          source_document_sha256?: string | null
          source_locator: string
          source_page?: string | null
        }
        Update: {
          matrix_version_id?: string
          recorded_at?: string
          source_document_sha256?: string | null
          source_locator?: string
          source_page?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "curricular_matrix_layouts_matrix_version_id_fkey"
            columns: ["matrix_version_id"]
            isOneToOne: true
            referencedRelation: "curricular_matrix_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      curricular_matrix_version_homologations: {
        Row: {
          created_at: string
          decision: string
          effective_from: string
          exercised_capability_id: string
          homologation_act_ref: string | null
          id: string
          matrix_version_id: string
          reason: string | null
          recorded_by: string
          recorded_by_person_id: string | null
          recorded_via_engagement_id: string
          sequence: number
          supersedes_id: string | null
        }
        Insert: {
          created_at?: string
          decision: string
          effective_from: string
          exercised_capability_id: string
          homologation_act_ref?: string | null
          id?: string
          matrix_version_id: string
          reason?: string | null
          recorded_by: string
          recorded_by_person_id?: string | null
          recorded_via_engagement_id: string
          sequence: number
          supersedes_id?: string | null
        }
        Update: {
          created_at?: string
          decision?: string
          effective_from?: string
          exercised_capability_id?: string
          homologation_act_ref?: string | null
          id?: string
          matrix_version_id?: string
          reason?: string | null
          recorded_by?: string
          recorded_by_person_id?: string | null
          recorded_via_engagement_id?: string
          sequence?: number
          supersedes_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "curricular_matrix_version_homologations_matrix_version_id_fkey"
            columns: ["matrix_version_id"]
            isOneToOne: false
            referencedRelation: "curricular_matrix_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curricular_matrix_version_homologations_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "curricular_matrix_version_homologations"
            referencedColumns: ["id"]
          },
        ]
      }
      curricular_matrix_versions: {
        Row: {
          change_kind: string
          change_reason: string | null
          created_at: string
          id: string
          matrix_id: string
          official_name: string
          originating_act_ref: string | null
          recorded_by: string
          recorded_by_person_id: string | null
          recorded_via_engagement_id: string
          supersedes_id: string | null
          valid_from: string
          valid_until: string | null
          version: number
        }
        Insert: {
          change_kind: string
          change_reason?: string | null
          created_at?: string
          id?: string
          matrix_id: string
          official_name: string
          originating_act_ref?: string | null
          recorded_by: string
          recorded_by_person_id?: string | null
          recorded_via_engagement_id: string
          supersedes_id?: string | null
          valid_from: string
          valid_until?: string | null
          version: number
        }
        Update: {
          change_kind?: string
          change_reason?: string | null
          created_at?: string
          id?: string
          matrix_id?: string
          official_name?: string
          originating_act_ref?: string | null
          recorded_by?: string
          recorded_by_person_id?: string | null
          recorded_via_engagement_id?: string
          supersedes_id?: string | null
          valid_from?: string
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "curricular_matrix_versions_matrix_id_fkey"
            columns: ["matrix_id"]
            isOneToOne: false
            referencedRelation: "institutional_curricular_matrices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curricular_matrix_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "curricular_matrix_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      curricular_position_matrix_correspondence_homologations: {
        Row: {
          correspondence_version_id: string
          created_at: string
          decision: string
          effective_from: string
          exercised_capability_id: string
          homologation_act_ref: string | null
          id: string
          reason: string | null
          recorded_by: string
          recorded_by_person_id: string | null
          recorded_via_engagement_id: string
          sequence: number
          supersedes_id: string | null
        }
        Insert: {
          correspondence_version_id: string
          created_at?: string
          decision: string
          effective_from: string
          exercised_capability_id: string
          homologation_act_ref?: string | null
          id?: string
          reason?: string | null
          recorded_by: string
          recorded_by_person_id?: string | null
          recorded_via_engagement_id: string
          sequence: number
          supersedes_id?: string | null
        }
        Update: {
          correspondence_version_id?: string
          created_at?: string
          decision?: string
          effective_from?: string
          exercised_capability_id?: string
          homologation_act_ref?: string | null
          id?: string
          reason?: string | null
          recorded_by?: string
          recorded_by_person_id?: string | null
          recorded_via_engagement_id?: string
          sequence?: number
          supersedes_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "curricular_position_matrix_corr_correspondence_version_id_fkey1"
            columns: ["correspondence_version_id"]
            isOneToOne: false
            referencedRelation: "curricular_position_matrix_correspondence_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curricular_position_matrix_correspondence_ho_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "curricular_position_matrix_correspondence_homologations"
            referencedColumns: ["id"]
          },
        ]
      }
      curricular_position_matrix_correspondence_keys: {
        Row: {
          correspondence_version_id: string
          scheme_id: string
          value_id: string
          value_version: number
        }
        Insert: {
          correspondence_version_id: string
          scheme_id: string
          value_id: string
          value_version: number
        }
        Update: {
          correspondence_version_id?: string
          scheme_id?: string
          value_id?: string
          value_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "curricular_position_matrix_corre_correspondence_version_id_fkey"
            columns: ["correspondence_version_id"]
            isOneToOne: false
            referencedRelation: "curricular_position_matrix_correspondence_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      curricular_position_matrix_correspondence_versions: {
        Row: {
          change_kind: string
          change_reason: string | null
          correspondence_id: string
          created_at: string
          id: string
          originating_act_ref: string | null
          recorded_by: string
          recorded_by_person_id: string | null
          recorded_via_engagement_id: string
          supersedes_id: string | null
          target_column_key: string
          target_matrix_id: string
          valid_from: string
          valid_until: string | null
          version: number
        }
        Insert: {
          change_kind: string
          change_reason?: string | null
          correspondence_id: string
          created_at?: string
          id?: string
          originating_act_ref?: string | null
          recorded_by: string
          recorded_by_person_id?: string | null
          recorded_via_engagement_id: string
          supersedes_id?: string | null
          target_column_key: string
          target_matrix_id: string
          valid_from: string
          valid_until?: string | null
          version: number
        }
        Update: {
          change_kind?: string
          change_reason?: string | null
          correspondence_id?: string
          created_at?: string
          id?: string
          originating_act_ref?: string | null
          recorded_by?: string
          recorded_by_person_id?: string | null
          recorded_via_engagement_id?: string
          supersedes_id?: string | null
          target_column_key?: string
          target_matrix_id?: string
          valid_from?: string
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "curricular_position_matrix_correspondenc_correspondence_id_fkey"
            columns: ["correspondence_id"]
            isOneToOne: false
            referencedRelation: "curricular_position_matrix_correspondences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curricular_position_matrix_correspondence_target_matrix_id_fkey"
            columns: ["target_matrix_id"]
            isOneToOne: false
            referencedRelation: "institutional_curricular_matrices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curricular_position_matrix_correspondence_ve_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "curricular_position_matrix_correspondence_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      curricular_position_matrix_correspondences: {
        Row: {
          created_at: string
          id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          id: string
          profile_id: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "curricular_position_matrix_correspondences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "curricular_correspondence_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      curricular_reference_editions: {
        Row: {
          authority: string
          edition_label: string
          id: string
          item_count: number
          published_on: string | null
          recorded_at: string
          recorded_by: string
          recorded_engagement: string
          source_id: string
          source_label: string
          source_ref: string | null
          source_sha256: string
          supersedes_id: string | null
          valid_from: string | null
        }
        Insert: {
          authority: string
          edition_label: string
          id?: string
          item_count: number
          published_on?: string | null
          recorded_at?: string
          recorded_by: string
          recorded_engagement: string
          source_id: string
          source_label: string
          source_ref?: string | null
          source_sha256: string
          supersedes_id?: string | null
          valid_from?: string | null
        }
        Update: {
          authority?: string
          edition_label?: string
          id?: string
          item_count?: number
          published_on?: string | null
          recorded_at?: string
          recorded_by?: string
          recorded_engagement?: string
          source_id?: string
          source_label?: string
          source_ref?: string | null
          source_sha256?: string
          supersedes_id?: string | null
          valid_from?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "curricular_reference_editions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "curricular_reference_editions"
            referencedColumns: ["id"]
          },
        ]
      }
      curricular_reference_item_bindings: {
        Row: {
          item_id: string
          scheme_id: string
          value_id: string
        }
        Insert: {
          item_id: string
          scheme_id: string
          value_id: string
        }
        Update: {
          item_id?: string
          scheme_id?: string
          value_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "curricular_reference_item_bindings_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "curricular_reference_items"
            referencedColumns: ["id"]
          },
        ]
      }
      curricular_reference_items: {
        Row: {
          code: string
          edition_id: string
          id: string
          item_kind: string
          official_text: string
          parent_code: string | null
          source_labels: Json
          source_locator: string | null
        }
        Insert: {
          code: string
          edition_id: string
          id?: string
          item_kind: string
          official_text: string
          parent_code?: string | null
          source_labels?: Json
          source_locator?: string | null
        }
        Update: {
          code?: string
          edition_id?: string
          id?: string
          item_kind?: string
          official_text?: string
          parent_code?: string | null
          source_labels?: Json
          source_locator?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "curricular_reference_items_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "curricular_reference_editions"
            referencedColumns: ["id"]
          },
        ]
      }
      curricular_reference_relations: {
        Row: {
          confidence: string
          from_item_id: string
          id: string
          nature: string
          provenance: string
          reason: string | null
          recorded_at: string
          recorded_by: string
          recorded_engagement: string
          revokes_id: string | null
          to_item_id: string
        }
        Insert: {
          confidence: string
          from_item_id: string
          id?: string
          nature: string
          provenance: string
          reason?: string | null
          recorded_at?: string
          recorded_by: string
          recorded_engagement: string
          revokes_id?: string | null
          to_item_id: string
        }
        Update: {
          confidence?: string
          from_item_id?: string
          id?: string
          nature?: string
          provenance?: string
          reason?: string | null
          recorded_at?: string
          recorded_by?: string
          recorded_engagement?: string
          revokes_id?: string | null
          to_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "curricular_reference_relations_from_item_id_fkey"
            columns: ["from_item_id"]
            isOneToOne: false
            referencedRelation: "curricular_reference_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curricular_reference_relations_revokes_id_fkey"
            columns: ["revokes_id"]
            isOneToOne: false
            referencedRelation: "curricular_reference_relations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curricular_reference_relations_to_item_id_fkey"
            columns: ["to_item_id"]
            isOneToOne: false
            referencedRelation: "curricular_reference_items"
            referencedColumns: ["id"]
          },
        ]
      }
      curricular_reference_simplifications: {
        Row: {
          id: string
          item_id: string
          reason: string | null
          recorded_at: string
          recorded_by: string
          recorded_engagement: string
          simplified_text: string
          supersedes_id: string | null
          version_no: number
        }
        Insert: {
          id?: string
          item_id: string
          reason?: string | null
          recorded_at?: string
          recorded_by: string
          recorded_engagement: string
          simplified_text: string
          supersedes_id?: string | null
          version_no: number
        }
        Update: {
          id?: string
          item_id?: string
          reason?: string | null
          recorded_at?: string
          recorded_by?: string
          recorded_engagement?: string
          simplified_text?: string
          supersedes_id?: string | null
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "curricular_reference_simplifications_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "curricular_reference_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curricular_reference_simplifications_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "curricular_reference_simplifications"
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
      cycle_closing_policies: {
        Row: {
          closing_capabilities: string[]
          created_at: string
          definition: Json
          homologated_at: string | null
          homologation_act_ref: string | null
          id: string
          rectification_capabilities: string[]
          reopening_capabilities: string[]
          status: string
          version: number
        }
        Insert: {
          closing_capabilities?: string[]
          created_at?: string
          definition: Json
          homologated_at?: string | null
          homologation_act_ref?: string | null
          id: string
          rectification_capabilities?: string[]
          reopening_capabilities?: string[]
          status?: string
          version: number
        }
        Update: {
          closing_capabilities?: string[]
          created_at?: string
          definition?: Json
          homologated_at?: string | null
          homologation_act_ref?: string | null
          id?: string
          rectification_capabilities?: string[]
          reopening_capabilities?: string[]
          status?: string
          version?: number
        }
        Relationships: []
      }
      cycle_closing_versions: {
        Row: {
          author_person_id: string
          author_user_id: string
          authorizing_engagement_id: string
          capability_policy_id: string
          capability_policy_version: number
          class_id: string
          cycle_id: string
          declared_at: string
          id: string
          justification: string | null
          operation: string
          plan_id: string
          policy_id: string
          policy_version: number
          preceding_closing_id: string | null
          scope_key: string
          snapshot: Json
          source_refs: Json
          version_number: number
        }
        Insert: {
          author_person_id: string
          author_user_id: string
          authorizing_engagement_id: string
          capability_policy_id: string
          capability_policy_version: number
          class_id: string
          cycle_id: string
          declared_at?: string
          id?: string
          justification?: string | null
          operation: string
          plan_id: string
          policy_id: string
          policy_version: number
          preceding_closing_id?: string | null
          scope_key: string
          snapshot: Json
          source_refs: Json
          version_number: number
        }
        Update: {
          author_person_id?: string
          author_user_id?: string
          authorizing_engagement_id?: string
          capability_policy_id?: string
          capability_policy_version?: number
          class_id?: string
          cycle_id?: string
          declared_at?: string
          id?: string
          justification?: string | null
          operation?: string
          plan_id?: string
          policy_id?: string
          policy_version?: number
          preceding_closing_id?: string | null
          scope_key?: string
          snapshot?: Json
          source_refs?: Json
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "cycle_closing_versions_author_person_id_fkey"
            columns: ["author_person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_closing_versions_authorizing_engagement_id_fkey"
            columns: ["authorizing_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_closing_versions_capability_policy_id_fkey"
            columns: ["capability_policy_id"]
            isOneToOne: false
            referencedRelation: "capability_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_closing_versions_policy_id_policy_version_fkey"
            columns: ["policy_id", "policy_version"]
            isOneToOne: false
            referencedRelation: "cycle_closing_policies"
            referencedColumns: ["id", "version"]
          },
          {
            foreignKeyName: "cycle_closing_versions_preceding_closing_id_fkey"
            columns: ["preceding_closing_id"]
            isOneToOne: true
            referencedRelation: "cycle_closing_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      cycle_enrollment_ending_versions: {
        Row: {
          annulled: boolean
          bond_status_value_id: string | null
          bond_status_version: number | null
          correction_reason: string | null
          created_at: string
          ended_on: string | null
          enrollment_logical_id: string
          id: string
          originating_act_ref: string | null
          reason_text: string | null
          recorded_by: string
          school_id: string
          supersedes_id: string | null
          version: number
        }
        Insert: {
          annulled?: boolean
          bond_status_value_id?: string | null
          bond_status_version?: number | null
          correction_reason?: string | null
          created_at?: string
          ended_on?: string | null
          enrollment_logical_id: string
          id?: string
          originating_act_ref?: string | null
          reason_text?: string | null
          recorded_by: string
          school_id: string
          supersedes_id?: string | null
          version: number
        }
        Update: {
          annulled?: boolean
          bond_status_value_id?: string | null
          bond_status_version?: number | null
          correction_reason?: string | null
          created_at?: string
          ended_on?: string | null
          enrollment_logical_id?: string
          id?: string
          originating_act_ref?: string | null
          reason_text?: string | null
          recorded_by?: string
          school_id?: string
          supersedes_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cycle_enrollment_ending_versions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_enrollment_ending_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "cycle_enrollment_ending_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      cycle_participations: {
        Row: {
          annulled: boolean
          change_reason: string | null
          created_at: string
          enrollment_logical_id: string
          id: string
          logical_id: string
          nature_scheme_id: string
          nature_value_id: string
          nature_version: number
          originating_act_ref: string | null
          recorded_by: string
          school_id: string
          student_id: string
          supersedes_id: string | null
          valid_from: string
          valid_until: string | null
          version: number
        }
        Insert: {
          annulled?: boolean
          change_reason?: string | null
          created_at?: string
          enrollment_logical_id: string
          id?: string
          logical_id: string
          nature_scheme_id?: string
          nature_value_id: string
          nature_version: number
          originating_act_ref?: string | null
          recorded_by: string
          school_id: string
          student_id: string
          supersedes_id?: string | null
          valid_from: string
          valid_until?: string | null
          version: number
        }
        Update: {
          annulled?: boolean
          change_reason?: string | null
          created_at?: string
          enrollment_logical_id?: string
          id?: string
          logical_id?: string
          nature_scheme_id?: string
          nature_value_id?: string
          nature_version?: number
          originating_act_ref?: string | null
          recorded_by?: string
          school_id?: string
          student_id?: string
          supersedes_id?: string | null
          valid_from?: string
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cycle_participations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_participations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "institutional_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_participations_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "cycle_participations"
            referencedColumns: ["id"]
          },
        ]
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
      diary_correction_policies: {
        Row: {
          admissible_changes: string[] | null
          applies_when_official_closing: string
          created_at: string
          definition: Json
          family_id: string
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
          admissible_changes?: string[] | null
          applies_when_official_closing: string
          created_at?: string
          definition?: Json
          family_id: string
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
          admissible_changes?: string[] | null
          applies_when_official_closing?: string
          created_at?: string
          definition?: Json
          family_id?: string
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
            foreignKeyName: "diary_correction_policies_supersedes_version_id_fkey"
            columns: ["supersedes_version_id"]
            isOneToOne: false
            referencedRelation: "diary_correction_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_endings: {
        Row: {
          act_ref: string
          created_at: string
          ended_on: string
          engagement_id: string
          recorded_by: string
        }
        Insert: {
          act_ref: string
          created_at?: string
          ended_on: string
          engagement_id: string
          recorded_by: string
        }
        Update: {
          act_ref?: string
          created_at?: string
          ended_on?: string
          engagement_id?: string
          recorded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_endings_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: true
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batch_events: {
        Row: {
          actor: string
          actor_engagement: string
          batch_id: string
          canonical_ref: string | null
          detail: string | null
          id: string
          kind: string
          recorded_at: string
          row_id: string | null
        }
        Insert: {
          actor: string
          actor_engagement: string
          batch_id: string
          canonical_ref?: string | null
          detail?: string | null
          id?: string
          kind: string
          recorded_at?: string
          row_id?: string | null
        }
        Update: {
          actor?: string
          actor_engagement?: string
          batch_id?: string
          canonical_ref?: string | null
          detail?: string | null
          id?: string
          kind?: string
          recorded_at?: string
          row_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_batch_events_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_batch_events_row_id_fkey"
            columns: ["row_id"]
            isOneToOne: false
            referencedRelation: "import_batch_rows"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batch_rows: {
        Row: {
          batch_id: string
          id: string
          identity_key: string | null
          line_ref: string
          normalized: Json | null
          outcome: string
          raw: Json
          reasons: string[]
        }
        Insert: {
          batch_id: string
          id?: string
          identity_key?: string | null
          line_ref: string
          normalized?: Json | null
          outcome: string
          raw: Json
          reasons?: string[]
        }
        Update: {
          batch_id?: string
          id?: string
          identity_key?: string | null
          line_ref?: string
          normalized?: Json | null
          outcome?: string
          raw?: Json
          reasons?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "import_batch_rows_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          adapter_id: string
          adapter_version: number
          id: string
          operator: string
          operator_engagement: string
          operator_person: string | null
          received_at: string
          reprocesses_id: string | null
          row_count: number
          source_name: string
          source_ref: string | null
          source_sha256: string
          staged_sha256: string
        }
        Insert: {
          adapter_id: string
          adapter_version: number
          id?: string
          operator: string
          operator_engagement: string
          operator_person?: string | null
          received_at?: string
          reprocesses_id?: string | null
          row_count: number
          source_name: string
          source_ref?: string | null
          source_sha256: string
          staged_sha256: string
        }
        Update: {
          adapter_id?: string
          adapter_version?: number
          id?: string
          operator?: string
          operator_engagement?: string
          operator_person?: string | null
          received_at?: string
          reprocesses_id?: string | null
          row_count?: number
          source_name?: string
          source_ref?: string | null
          source_sha256?: string
          staged_sha256?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_reprocesses_id_fkey"
            columns: ["reprocesses_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      infant_experience_versions: {
        Row: {
          author_person_id: string
          author_user_id: string
          authorizing_engagement_id: string
          capability_policy_id: string
          capability_policy_version: number
          class_id: string
          component_id: string
          experience_date: string
          id: string
          lesson_logical_id: string
          logical_experience_id: string
          objective_ids: string[]
          plan_id: string
          record: Json
          rectification: Json | null
          registered_at: string
          student_ids: string[]
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
          component_id: string
          experience_date: string
          id?: string
          lesson_logical_id: string
          logical_experience_id: string
          objective_ids: string[]
          plan_id: string
          record: Json
          rectification?: Json | null
          registered_at?: string
          student_ids: string[]
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
          component_id?: string
          experience_date?: string
          id?: string
          lesson_logical_id?: string
          logical_experience_id?: string
          objective_ids?: string[]
          plan_id?: string
          record?: Json
          rectification?: Json | null
          registered_at?: string
          student_ids?: string[]
          supersedes_version_id?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "infant_experience_versions_author_person_id_fkey"
            columns: ["author_person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "infant_experience_versions_authorizing_engagement_id_fkey"
            columns: ["authorizing_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "infant_experience_versions_capability_policy_id_fkey"
            columns: ["capability_policy_id"]
            isOneToOne: false
            referencedRelation: "capability_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "infant_experience_versions_supersedes_version_id_fkey"
            columns: ["supersedes_version_id"]
            isOneToOne: true
            referencedRelation: "infant_experience_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      institutional_academic_period_versions: {
        Row: {
          change_reason: string | null
          created_at: string
          ends_on: string
          id: string
          is_active: boolean
          official_name: string
          originating_act_ref: string
          period_id: string
          recorded_by: string
          recorded_by_person_id: string
          recorded_via_engagement_id: string
          starts_on: string
          supersedes_id: string | null
          valid_from: string
          version: number
        }
        Insert: {
          change_reason?: string | null
          created_at?: string
          ends_on: string
          id?: string
          is_active: boolean
          official_name: string
          originating_act_ref: string
          period_id: string
          recorded_by: string
          recorded_by_person_id: string
          recorded_via_engagement_id: string
          starts_on: string
          supersedes_id?: string | null
          valid_from: string
          version: number
        }
        Update: {
          change_reason?: string | null
          created_at?: string
          ends_on?: string
          id?: string
          is_active?: boolean
          official_name?: string
          originating_act_ref?: string
          period_id?: string
          recorded_by?: string
          recorded_by_person_id?: string
          recorded_via_engagement_id?: string
          starts_on?: string
          supersedes_id?: string | null
          valid_from?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "institutional_academic_period_v_recorded_via_engagement_id_fkey"
            columns: ["recorded_via_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_academic_period_versio_recorded_by_person_id_fkey"
            columns: ["recorded_by_person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_academic_period_versions_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "institutional_academic_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_academic_period_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "institutional_academic_period_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      institutional_academic_periods: {
        Row: {
          academic_year_id: string
          created_at: string
          ends_on: string
          id: string
          label: string
          period_organization_id: string
          starts_on: string
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          ends_on: string
          id: string
          label: string
          period_organization_id: string
          starts_on: string
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          ends_on?: string
          id?: string
          label?: string
          period_organization_id?: string
          starts_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "institutional_period_organization_year_fk"
            columns: ["period_organization_id", "academic_year_id"]
            isOneToOne: false
            referencedRelation: "institutional_period_organizations"
            referencedColumns: ["id", "academic_year_id"]
          },
        ]
      }
      institutional_academic_year_versions: {
        Row: {
          academic_year_id: string
          change_reason: string | null
          created_at: string
          ends_on: string
          id: string
          is_active: boolean
          official_name: string
          originating_act_ref: string
          recorded_by: string
          recorded_by_person_id: string
          recorded_via_engagement_id: string
          starts_on: string
          supersedes_id: string | null
          valid_from: string
          version: number
        }
        Insert: {
          academic_year_id: string
          change_reason?: string | null
          created_at?: string
          ends_on: string
          id?: string
          is_active: boolean
          official_name: string
          originating_act_ref: string
          recorded_by: string
          recorded_by_person_id: string
          recorded_via_engagement_id: string
          starts_on: string
          supersedes_id?: string | null
          valid_from: string
          version: number
        }
        Update: {
          academic_year_id?: string
          change_reason?: string | null
          created_at?: string
          ends_on?: string
          id?: string
          is_active?: boolean
          official_name?: string
          originating_act_ref?: string
          recorded_by?: string
          recorded_by_person_id?: string
          recorded_via_engagement_id?: string
          starts_on?: string
          supersedes_id?: string | null
          valid_from?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "institutional_academic_year_ver_recorded_via_engagement_id_fkey"
            columns: ["recorded_via_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_academic_year_versions_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "institutional_academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_academic_year_versions_recorded_by_person_id_fkey"
            columns: ["recorded_by_person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_academic_year_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "institutional_academic_year_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      institutional_academic_years: {
        Row: {
          created_at: string
          id: string
        }
        Insert: {
          created_at?: string
          id: string
        }
        Update: {
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      institutional_actor_nature_origins: {
        Row: {
          actor_nature: string
          origin: string
          person_id: string
          recorded_at: string
          recorded_by: string
        }
        Insert: {
          actor_nature: string
          origin: string
          person_id: string
          recorded_at?: string
          recorded_by: string
        }
        Update: {
          actor_nature?: string
          origin?: string
          person_id?: string
          recorded_at?: string
          recorded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "institutional_actor_nature_origins_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
        ]
      }
      institutional_calendars: {
        Row: {
          created_at: string
          id: string
        }
        Insert: {
          created_at?: string
          id: string
        }
        Update: {
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      institutional_class_period_organization_versions: {
        Row: {
          authorizing_policy_id: string
          change_reason: string | null
          class_id: string
          created_at: string
          id: string
          organization_id: string
          originating_act_ref: string
          recorded_by: string
          recorded_by_person_id: string
          recorded_via_engagement_id: string
          segment_id: string
          supersedes_id: string | null
          valid_from: string
          valid_until: string | null
          version: number
        }
        Insert: {
          authorizing_policy_id: string
          change_reason?: string | null
          class_id: string
          created_at?: string
          id?: string
          organization_id: string
          originating_act_ref: string
          recorded_by: string
          recorded_by_person_id: string
          recorded_via_engagement_id: string
          segment_id: string
          supersedes_id?: string | null
          valid_from: string
          valid_until?: string | null
          version: number
        }
        Update: {
          authorizing_policy_id?: string
          change_reason?: string | null
          class_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          originating_act_ref?: string
          recorded_by?: string
          recorded_by_person_id?: string
          recorded_via_engagement_id?: string
          segment_id?: string
          supersedes_id?: string | null
          valid_from?: string
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_period_link_segment_parent_fk"
            columns: ["supersedes_id", "class_id", "segment_id"]
            isOneToOne: false
            referencedRelation: "institutional_class_period_organization_versions"
            referencedColumns: ["id", "class_id", "segment_id"]
          },
          {
            foreignKeyName: "institutional_class_period_orga_recorded_via_engagement_id_fkey"
            columns: ["recorded_via_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_class_period_organizat_authorizing_policy_id_fkey"
            columns: ["authorizing_policy_id"]
            isOneToOne: false
            referencedRelation: "capability_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_class_period_organizat_recorded_by_person_id_fkey"
            columns: ["recorded_by_person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_class_period_organization_ve_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "institutional_period_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_class_period_organization_vers_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "institutional_class_period_organization_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_class_period_organization_versions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "institutional_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      institutional_class_record_versions: {
        Row: {
          administrative_status: string
          authorizing_policy_id: string
          change_reason: string | null
          class_id: string
          code: string | null
          created_at: string
          id: string
          name: string
          originating_act_ref: string
          recorded_by: string
          recorded_by_person_id: string
          recorded_via_engagement_id: string
          segment_id: string
          supersedes_id: string | null
          valid_from: string
          valid_until: string | null
          version: number
        }
        Insert: {
          administrative_status: string
          authorizing_policy_id: string
          change_reason?: string | null
          class_id: string
          code?: string | null
          created_at?: string
          id?: string
          name: string
          originating_act_ref: string
          recorded_by: string
          recorded_by_person_id: string
          recorded_via_engagement_id: string
          segment_id: string
          supersedes_id?: string | null
          valid_from: string
          valid_until?: string | null
          version: number
        }
        Update: {
          administrative_status?: string
          authorizing_policy_id?: string
          change_reason?: string | null
          class_id?: string
          code?: string | null
          created_at?: string
          id?: string
          name?: string
          originating_act_ref?: string
          recorded_by?: string
          recorded_by_person_id?: string
          recorded_via_engagement_id?: string
          segment_id?: string
          supersedes_id?: string | null
          valid_from?: string
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "institutional_class_record_ve_supersedes_id_class_id_segme_fkey"
            columns: ["supersedes_id", "class_id", "segment_id"]
            isOneToOne: false
            referencedRelation: "institutional_class_record_versions"
            referencedColumns: ["id", "class_id", "segment_id"]
          },
          {
            foreignKeyName: "institutional_class_record_vers_recorded_via_engagement_id_fkey"
            columns: ["recorded_via_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_class_record_versions_authorizing_policy_id_fkey"
            columns: ["authorizing_policy_id"]
            isOneToOne: false
            referencedRelation: "capability_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_class_record_versions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "institutional_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_class_record_versions_recorded_by_person_id_fkey"
            columns: ["recorded_by_person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
        ]
      }
      institutional_class_schedule_slots: {
        Row: {
          class_id: string
          component_id: string | null
          created_at: string
          ends_at: string
          engagement_id: string | null
          id: string
          originating_act_ref: string | null
          starts_at: string
          valid_from: string
          valid_until: string | null
          weekday: number
        }
        Insert: {
          class_id: string
          component_id?: string | null
          created_at?: string
          ends_at: string
          engagement_id?: string | null
          id?: string
          originating_act_ref?: string | null
          starts_at: string
          valid_from: string
          valid_until?: string | null
          weekday: number
        }
        Update: {
          class_id?: string
          component_id?: string | null
          created_at?: string
          ends_at?: string
          engagement_id?: string | null
          id?: string
          originating_act_ref?: string | null
          starts_at?: string
          valid_from?: string
          valid_until?: string | null
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "institutional_class_schedule_slots_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "institutional_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_class_schedule_slots_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "institutional_curricular_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_class_schedule_slots_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      institutional_classes: {
        Row: {
          academic_year_id: string
          academic_year_label: string
          code: string | null
          created_at: string
          curriculum_age_group_ids: string[]
          id: string
          name: string
          offer_id: string | null
          originating_act_ref: string | null
          school_id: string
          school_label_snapshot: string
          stage_id: string | null
          stage_label_snapshot: string | null
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          academic_year_id: string
          academic_year_label: string
          code?: string | null
          created_at?: string
          curriculum_age_group_ids?: string[]
          id: string
          name: string
          offer_id?: string | null
          originating_act_ref?: string | null
          school_id: string
          school_label_snapshot: string
          stage_id?: string | null
          stage_label_snapshot?: string | null
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          academic_year_id?: string
          academic_year_label?: string
          code?: string | null
          created_at?: string
          curriculum_age_group_ids?: string[]
          id?: string
          name?: string
          offer_id?: string | null
          originating_act_ref?: string | null
          school_id?: string
          school_label_snapshot?: string
          stage_id?: string | null
          stage_label_snapshot?: string | null
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "institutional_classes_academic_year_fk"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "institutional_academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_classes_school_fk"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
        ]
      }
      institutional_curricular_components: {
        Row: {
          created_at: string
          id: string
          label: string
        }
        Insert: {
          created_at?: string
          id: string
          label: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
        }
        Relationships: []
      }
      institutional_curricular_matrices: {
        Row: {
          created_at: string
          id: string
        }
        Insert: {
          created_at?: string
          id: string
        }
        Update: {
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      institutional_engagement_scope_classes: {
        Row: {
          class_id: string
          created_at: string
          engagement_id: string
          originating_act_ref: string | null
        }
        Insert: {
          class_id: string
          created_at?: string
          engagement_id: string
          originating_act_ref?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string
          engagement_id?: string
          originating_act_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "institutional_engagement_scope_classes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "institutional_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_engagement_scope_classes_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
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
          scope_level: string | null
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
          scope_level?: string | null
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
          scope_level?: string | null
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
          {
            foreignKeyName: "institutional_engagements_school_fk"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
        ]
      }
      institutional_period_organization_versions: {
        Row: {
          change_reason: string | null
          created_at: string
          id: string
          is_active: boolean
          official_name: string
          organization_id: string
          originating_act_ref: string
          recorded_by: string
          recorded_by_person_id: string
          recorded_via_engagement_id: string
          supersedes_id: string | null
          valid_from: string
          version: number
        }
        Insert: {
          change_reason?: string | null
          created_at?: string
          id?: string
          is_active: boolean
          official_name: string
          organization_id: string
          originating_act_ref: string
          recorded_by: string
          recorded_by_person_id: string
          recorded_via_engagement_id: string
          supersedes_id?: string | null
          valid_from: string
          version: number
        }
        Update: {
          change_reason?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          official_name?: string
          organization_id?: string
          originating_act_ref?: string
          recorded_by?: string
          recorded_by_person_id?: string
          recorded_via_engagement_id?: string
          supersedes_id?: string | null
          valid_from?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "institutional_period_organizati_recorded_via_engagement_id_fkey"
            columns: ["recorded_via_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_period_organization_ve_recorded_by_person_id_fkey"
            columns: ["recorded_by_person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_period_organization_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "institutional_period_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_period_organization_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "institutional_period_organization_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      institutional_period_organizations: {
        Row: {
          academic_year_id: string
          created_at: string
          id: string
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          id: string
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "institutional_period_organizations_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "institutional_academic_years"
            referencedColumns: ["id"]
          },
        ]
      }
      institutional_persons: {
        Row: {
          actor_nature: string
          created_at: string
          display_name: string
          id: string
          institutional_identifier: string | null
        }
        Insert: {
          actor_nature?: string
          created_at?: string
          display_name: string
          id?: string
          institutional_identifier?: string | null
        }
        Update: {
          actor_nature?: string
          created_at?: string
          display_name?: string
          id?: string
          institutional_identifier?: string | null
        }
        Relationships: []
      }
      institutional_school_identifiers: {
        Row: {
          author_user_id: string | null
          created_at: string
          id: string
          identifier_kind: string
          originating_act_ref: string | null
          school_id: string
          value: string
        }
        Insert: {
          author_user_id?: string | null
          created_at?: string
          id?: string
          identifier_kind: string
          originating_act_ref?: string | null
          school_id: string
          value: string
        }
        Update: {
          author_user_id?: string | null
          created_at?: string
          id?: string
          identifier_kind?: string
          originating_act_ref?: string | null
          school_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "institutional_school_identifiers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
        ]
      }
      institutional_school_links: {
        Row: {
          author_person_id: string | null
          author_user_id: string | null
          authorizing_engagement_id: string | null
          capability_policy_id: string | null
          capability_policy_version: number | null
          correction_reason: string | null
          id: string
          link_kind_id: string
          link_kind_version: number
          linked_school_id: string
          logical_link_id: string
          originating_act_ref: string
          principal_school_id: string
          recorded_at: string
          supersedes_id: string | null
          valid_from: string
          valid_until: string | null
          version: number
        }
        Insert: {
          author_person_id?: string | null
          author_user_id?: string | null
          authorizing_engagement_id?: string | null
          capability_policy_id?: string | null
          capability_policy_version?: number | null
          correction_reason?: string | null
          id?: string
          link_kind_id: string
          link_kind_version: number
          linked_school_id: string
          logical_link_id?: string
          originating_act_ref: string
          principal_school_id: string
          recorded_at?: string
          supersedes_id?: string | null
          valid_from: string
          valid_until?: string | null
          version?: number
        }
        Update: {
          author_person_id?: string | null
          author_user_id?: string | null
          authorizing_engagement_id?: string | null
          capability_policy_id?: string | null
          capability_policy_version?: number | null
          correction_reason?: string | null
          id?: string
          link_kind_id?: string
          link_kind_version?: number
          linked_school_id?: string
          logical_link_id?: string
          originating_act_ref?: string
          principal_school_id?: string
          recorded_at?: string
          supersedes_id?: string | null
          valid_from?: string
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "institutional_school_links_author_person_id_fkey"
            columns: ["author_person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_school_links_authorizing_engagement_id_fkey"
            columns: ["authorizing_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_school_links_capability_policy_id_fkey"
            columns: ["capability_policy_id"]
            isOneToOne: false
            referencedRelation: "capability_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_school_links_linked_school_id_fkey"
            columns: ["linked_school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_school_links_principal_school_id_fkey"
            columns: ["principal_school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_school_links_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "institutional_school_links"
            referencedColumns: ["id"]
          },
        ]
      }
      institutional_school_record_versions: {
        Row: {
          active: boolean
          address: string | null
          author_person_id: string | null
          author_user_id: string | null
          authorizing_engagement_id: string | null
          capability_policy_id: string | null
          capability_policy_version: number | null
          classroom_count: number | null
          district: string | null
          hard_access: boolean | null
          id: string
          institutional_email: string | null
          justification: string | null
          location_kind: string | null
          official_name: string
          originating_act_ref: string | null
          own_building: boolean | null
          phone: string | null
          registered_at: string
          school_id: string
          supersedes_version_id: string | null
          valid_from: string
          version_number: number
        }
        Insert: {
          active: boolean
          address?: string | null
          author_person_id?: string | null
          author_user_id?: string | null
          authorizing_engagement_id?: string | null
          capability_policy_id?: string | null
          capability_policy_version?: number | null
          classroom_count?: number | null
          district?: string | null
          hard_access?: boolean | null
          id?: string
          institutional_email?: string | null
          justification?: string | null
          location_kind?: string | null
          official_name: string
          originating_act_ref?: string | null
          own_building?: boolean | null
          phone?: string | null
          registered_at?: string
          school_id: string
          supersedes_version_id?: string | null
          valid_from: string
          version_number: number
        }
        Update: {
          active?: boolean
          address?: string | null
          author_person_id?: string | null
          author_user_id?: string | null
          authorizing_engagement_id?: string | null
          capability_policy_id?: string | null
          capability_policy_version?: number | null
          classroom_count?: number | null
          district?: string | null
          hard_access?: boolean | null
          id?: string
          institutional_email?: string | null
          justification?: string | null
          location_kind?: string | null
          official_name?: string
          originating_act_ref?: string | null
          own_building?: boolean | null
          phone?: string | null
          registered_at?: string
          school_id?: string
          supersedes_version_id?: string | null
          valid_from?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "institutional_school_record_vers_authorizing_engagement_id_fkey"
            columns: ["authorizing_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_school_record_versions_author_person_id_fkey"
            columns: ["author_person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_school_record_versions_capability_policy_id_fkey"
            columns: ["capability_policy_id"]
            isOneToOne: false
            referencedRelation: "capability_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_school_record_versions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_school_record_versions_supersedes_version_id_fkey"
            columns: ["supersedes_version_id"]
            isOneToOne: false
            referencedRelation: "institutional_school_record_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      institutional_schools: {
        Row: {
          author_user_id: string | null
          created_at: string
          id: string
          originating_act_ref: string | null
        }
        Insert: {
          author_user_id?: string | null
          created_at?: string
          id: string
          originating_act_ref?: string | null
        }
        Update: {
          author_user_id?: string | null
          created_at?: string
          id?: string
          originating_act_ref?: string | null
        }
        Relationships: []
      }
      institutional_students: {
        Row: {
          created_at: string
          display_name: string
          id: string
          institutional_identifier: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
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
      institutional_visit_records: {
        Row: {
          additional_identification: Json
          annulled: boolean
          author_person_id: string | null
          author_user_id: string | null
          authorizing_engagement_id: string | null
          capability_policy_id: string | null
          capability_policy_version: number | null
          correction_reason: string | null
          declared_identification: string
          id: string
          logical_id: string
          origin_organization: string | null
          originating_act_ref: string | null
          recorded_at: string
          school_id: string
          supersedes_id: string | null
          version: number
          visited_on: string
          visitor_kind_id: string
          visitor_kind_version: number
        }
        Insert: {
          additional_identification?: Json
          annulled?: boolean
          author_person_id?: string | null
          author_user_id?: string | null
          authorizing_engagement_id?: string | null
          capability_policy_id?: string | null
          capability_policy_version?: number | null
          correction_reason?: string | null
          declared_identification: string
          id?: string
          logical_id: string
          origin_organization?: string | null
          originating_act_ref?: string | null
          recorded_at?: string
          school_id: string
          supersedes_id?: string | null
          version: number
          visited_on: string
          visitor_kind_id: string
          visitor_kind_version: number
        }
        Update: {
          additional_identification?: Json
          annulled?: boolean
          author_person_id?: string | null
          author_user_id?: string | null
          authorizing_engagement_id?: string | null
          capability_policy_id?: string | null
          capability_policy_version?: number | null
          correction_reason?: string | null
          declared_identification?: string
          id?: string
          logical_id?: string
          origin_organization?: string | null
          originating_act_ref?: string | null
          recorded_at?: string
          school_id?: string
          supersedes_id?: string | null
          version?: number
          visited_on?: string
          visitor_kind_id?: string
          visitor_kind_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "institutional_visit_records_author_person_id_fkey"
            columns: ["author_person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_visit_records_authorizing_engagement_id_fkey"
            columns: ["authorizing_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_visit_records_capability_policy_id_fkey"
            columns: ["capability_policy_id"]
            isOneToOne: false
            referencedRelation: "capability_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_visit_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_visit_records_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "institutional_visit_records"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_record_versions: {
        Row: {
          assignment_id: string
          author_person_id: string
          author_user_id: string
          authorizing_engagement_id: string
          capability_policy_id: string
          capability_policy_version: number
          class_id: string
          component_id: string
          concluded_at: string
          consulted_closing_id: string | null
          facts: Json
          id: string
          lesson_date: string
          logical_record_id: string
          plan_id: string
          rectification: Json | null
          supersedes_version_id: string | null
          version_number: number
        }
        Insert: {
          assignment_id: string
          author_person_id: string
          author_user_id: string
          authorizing_engagement_id: string
          capability_policy_id: string
          capability_policy_version: number
          class_id: string
          component_id: string
          concluded_at?: string
          consulted_closing_id?: string | null
          facts: Json
          id?: string
          lesson_date: string
          logical_record_id: string
          plan_id: string
          rectification?: Json | null
          supersedes_version_id?: string | null
          version_number: number
        }
        Update: {
          assignment_id?: string
          author_person_id?: string
          author_user_id?: string
          authorizing_engagement_id?: string
          capability_policy_id?: string
          capability_policy_version?: number
          class_id?: string
          component_id?: string
          concluded_at?: string
          consulted_closing_id?: string | null
          facts?: Json
          id?: string
          lesson_date?: string
          logical_record_id?: string
          plan_id?: string
          rectification?: Json | null
          supersedes_version_id?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "lesson_record_versions_author_person_id_fkey"
            columns: ["author_person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_record_versions_authorizing_engagement_id_fkey"
            columns: ["authorizing_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_record_versions_capability_policy_id_fkey"
            columns: ["capability_policy_id"]
            isOneToOne: false
            referencedRelation: "capability_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_record_versions_supersedes_version_id_fkey"
            columns: ["supersedes_version_id"]
            isOneToOne: true
            referencedRelation: "lesson_record_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      map_competence_rules: {
        Row: {
          created_at: string
          definition: Json
          homologation_act_ref: string | null
          id: string
          status: string
          valid_from: string
          valid_until: string | null
          version: number
        }
        Insert: {
          created_at?: string
          definition: Json
          homologation_act_ref?: string | null
          id: string
          status: string
          valid_from: string
          valid_until?: string | null
          version: number
        }
        Update: {
          created_at?: string
          definition?: Json
          homologation_act_ref?: string | null
          id?: string
          status?: string
          valid_from?: string
          valid_until?: string | null
          version?: number
        }
        Relationships: []
      }
      movement_type_definitions: {
        Row: {
          created_at: string
          homologation_act_ref: string | null
          id: string
          label: string
          status: string
          valid_from: string | null
          version: number
        }
        Insert: {
          created_at?: string
          homologation_act_ref?: string | null
          id: string
          label: string
          status: string
          valid_from?: string | null
          version: number
        }
        Update: {
          created_at?: string
          homologation_act_ref?: string | null
          id?: string
          label?: string
          status?: string
          valid_from?: string | null
          version?: number
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
      professional_functional_events: {
        Row: {
          author_person_id: string | null
          author_user_id: string | null
          authorizing_engagement_id: string | null
          capability_policy_id: string | null
          capability_policy_version: number | null
          correction_reason: string | null
          event_kind_id: string
          event_kind_version: number
          functional_link_logical_id: string
          id: string
          logical_id: string
          occurred_on: string | null
          originating_act_ref: string | null
          posting_logical_id: string | null
          recorded_at: string
          school_id: string
          supersedes_id: string | null
          version: number
        }
        Insert: {
          author_person_id?: string | null
          author_user_id?: string | null
          authorizing_engagement_id?: string | null
          capability_policy_id?: string | null
          capability_policy_version?: number | null
          correction_reason?: string | null
          event_kind_id: string
          event_kind_version: number
          functional_link_logical_id: string
          id?: string
          logical_id: string
          occurred_on?: string | null
          originating_act_ref?: string | null
          posting_logical_id?: string | null
          recorded_at?: string
          school_id: string
          supersedes_id?: string | null
          version: number
        }
        Update: {
          author_person_id?: string | null
          author_user_id?: string | null
          authorizing_engagement_id?: string | null
          capability_policy_id?: string | null
          capability_policy_version?: number | null
          correction_reason?: string | null
          event_kind_id?: string
          event_kind_version?: number
          functional_link_logical_id?: string
          id?: string
          logical_id?: string
          occurred_on?: string | null
          originating_act_ref?: string | null
          posting_logical_id?: string | null
          recorded_at?: string
          school_id?: string
          supersedes_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "professional_functional_events_author_person_id_fkey"
            columns: ["author_person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_functional_events_authorizing_engagement_id_fkey"
            columns: ["authorizing_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_functional_events_capability_policy_id_fkey"
            columns: ["capability_policy_id"]
            isOneToOne: false
            referencedRelation: "capability_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_functional_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_functional_events_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "professional_functional_events"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_functional_links: {
        Row: {
          author_person_id: string | null
          author_user_id: string | null
          authorizing_engagement_id: string | null
          capability_policy_id: string | null
          capability_policy_version: number | null
          correction_reason: string | null
          functional_registration: string | null
          id: string
          link_nature_id: string
          link_nature_version: number
          logical_id: string
          originating_act_ref: string | null
          person_id: string
          position_id: string | null
          position_version: number | null
          recorded_at: string
          supersedes_id: string | null
          valid_from: string | null
          valid_until: string | null
          version: number
        }
        Insert: {
          author_person_id?: string | null
          author_user_id?: string | null
          authorizing_engagement_id?: string | null
          capability_policy_id?: string | null
          capability_policy_version?: number | null
          correction_reason?: string | null
          functional_registration?: string | null
          id?: string
          link_nature_id: string
          link_nature_version: number
          logical_id: string
          originating_act_ref?: string | null
          person_id: string
          position_id?: string | null
          position_version?: number | null
          recorded_at?: string
          supersedes_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
          version: number
        }
        Update: {
          author_person_id?: string | null
          author_user_id?: string | null
          authorizing_engagement_id?: string | null
          capability_policy_id?: string | null
          capability_policy_version?: number | null
          correction_reason?: string | null
          functional_registration?: string | null
          id?: string
          link_nature_id?: string
          link_nature_version?: number
          logical_id?: string
          originating_act_ref?: string | null
          person_id?: string
          position_id?: string | null
          position_version?: number | null
          recorded_at?: string
          supersedes_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "professional_functional_links_author_person_id_fkey"
            columns: ["author_person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_functional_links_authorizing_engagement_id_fkey"
            columns: ["authorizing_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_functional_links_capability_policy_id_fkey"
            columns: ["capability_policy_id"]
            isOneToOne: false
            referencedRelation: "capability_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_functional_links_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_functional_links_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "professional_functional_links"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_postings: {
        Row: {
          author_person_id: string | null
          author_user_id: string | null
          authorizing_engagement_id: string | null
          capability_policy_id: string | null
          capability_policy_version: number | null
          correction_reason: string | null
          function_id: string | null
          function_version: number | null
          functional_link_logical_id: string
          functional_status_id: string | null
          functional_status_version: number | null
          id: string
          logical_id: string
          originating_act_ref: string | null
          recorded_at: string
          school_id: string
          supersedes_id: string | null
          valid_from: string | null
          valid_until: string | null
          version: number
        }
        Insert: {
          author_person_id?: string | null
          author_user_id?: string | null
          authorizing_engagement_id?: string | null
          capability_policy_id?: string | null
          capability_policy_version?: number | null
          correction_reason?: string | null
          function_id?: string | null
          function_version?: number | null
          functional_link_logical_id: string
          functional_status_id?: string | null
          functional_status_version?: number | null
          id?: string
          logical_id: string
          originating_act_ref?: string | null
          recorded_at?: string
          school_id: string
          supersedes_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
          version: number
        }
        Update: {
          author_person_id?: string | null
          author_user_id?: string | null
          authorizing_engagement_id?: string | null
          capability_policy_id?: string | null
          capability_policy_version?: number | null
          correction_reason?: string | null
          function_id?: string | null
          function_version?: number | null
          functional_link_logical_id?: string
          functional_status_id?: string | null
          functional_status_version?: number | null
          id?: string
          logical_id?: string
          originating_act_ref?: string | null
          recorded_at?: string
          school_id?: string
          supersedes_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "professional_postings_author_person_id_fkey"
            columns: ["author_person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_postings_authorizing_engagement_id_fkey"
            columns: ["authorizing_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_postings_capability_policy_id_fkey"
            columns: ["capability_policy_id"]
            isOneToOne: false
            referencedRelation: "capability_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_postings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_postings_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "professional_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      school_document_emission_events: {
        Row: {
          emission_id: string
          event_kind: string
          id: string
          reason: string
          recorded_at: string
          recorded_by: string
          recorded_by_engagement: string
          replacement_emission_id: string | null
        }
        Insert: {
          emission_id: string
          event_kind: string
          id?: string
          reason: string
          recorded_at?: string
          recorded_by: string
          recorded_by_engagement: string
          replacement_emission_id?: string | null
        }
        Update: {
          emission_id?: string
          event_kind?: string
          id?: string
          reason?: string
          recorded_at?: string
          recorded_by?: string
          recorded_by_engagement?: string
          replacement_emission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_document_emission_events_emission_id_fkey"
            columns: ["emission_id"]
            isOneToOne: true
            referencedRelation: "school_document_emissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_document_emission_events_replacement_emission_id_fkey"
            columns: ["replacement_emission_id"]
            isOneToOne: false
            referencedRelation: "school_document_emissions"
            referencedColumns: ["id"]
          },
        ]
      }
      school_document_emissions: {
        Row: {
          context: Json
          document_kind: string
          emission_kind: string
          emission_number: string | null
          emitted_at: string
          emitted_by: string
          emitted_by_engagement: string
          emitted_by_person: string | null
          id: string
          public_payload: Json
          reproduces_id: string | null
          retifies_id: string | null
          school_id: string
          snapshot: Json
          snapshot_sha256: string
          student_id: string
          template_version_id: string
          verification_code: string
        }
        Insert: {
          context?: Json
          document_kind: string
          emission_kind: string
          emission_number?: string | null
          emitted_at?: string
          emitted_by: string
          emitted_by_engagement: string
          emitted_by_person?: string | null
          id?: string
          public_payload?: Json
          reproduces_id?: string | null
          retifies_id?: string | null
          school_id: string
          snapshot: Json
          snapshot_sha256: string
          student_id: string
          template_version_id: string
          verification_code: string
        }
        Update: {
          context?: Json
          document_kind?: string
          emission_kind?: string
          emission_number?: string | null
          emitted_at?: string
          emitted_by?: string
          emitted_by_engagement?: string
          emitted_by_person?: string | null
          id?: string
          public_payload?: Json
          reproduces_id?: string | null
          retifies_id?: string | null
          school_id?: string
          snapshot?: Json
          snapshot_sha256?: string
          student_id?: string
          template_version_id?: string
          verification_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_document_emissions_reproduces_id_fkey"
            columns: ["reproduces_id"]
            isOneToOne: false
            referencedRelation: "school_document_emissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_document_emissions_retifies_id_fkey"
            columns: ["retifies_id"]
            isOneToOne: false
            referencedRelation: "school_document_emissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_document_emissions_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "school_document_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      school_document_template_versions: {
        Row: {
          blocks: Json
          change_reason: string | null
          id: string
          identity: Json
          numbering: Json | null
          public_fields: string[]
          recorded_at: string
          recorded_by: string
          recorded_by_engagement: string
          source_ref: string | null
          supersedes_id: string | null
          template_id: string
          title: string
          version_no: number
        }
        Insert: {
          blocks: Json
          change_reason?: string | null
          id?: string
          identity?: Json
          numbering?: Json | null
          public_fields?: string[]
          recorded_at?: string
          recorded_by: string
          recorded_by_engagement: string
          source_ref?: string | null
          supersedes_id?: string | null
          template_id: string
          title: string
          version_no: number
        }
        Update: {
          blocks?: Json
          change_reason?: string | null
          id?: string
          identity?: Json
          numbering?: Json | null
          public_fields?: string[]
          recorded_at?: string
          recorded_by?: string
          recorded_by_engagement?: string
          source_ref?: string | null
          supersedes_id?: string | null
          template_id?: string
          title?: string
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "school_document_template_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "school_document_template_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_document_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "school_document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      school_document_templates: {
        Row: {
          created_at: string
          created_by: string
          document_kind: string
          id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          document_kind: string
          id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          document_kind?: string
          id?: string
        }
        Relationships: []
      }
      school_enrollment_endings: {
        Row: {
          bond_status_id: string
          created_at: string
          ended_on: string
          enrollment_id: string
          originating_act_ref: string | null
          reason_text: string | null
          recorded_by: string | null
        }
        Insert: {
          bond_status_id: string
          created_at?: string
          ended_on: string
          enrollment_id: string
          originating_act_ref?: string | null
          reason_text?: string | null
          recorded_by?: string | null
        }
        Update: {
          bond_status_id?: string
          created_at?: string
          ended_on?: string
          enrollment_id?: string
          originating_act_ref?: string | null
          reason_text?: string | null
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_enrollment_endings_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: true
            referencedRelation: "school_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      school_enrollments: {
        Row: {
          academic_year_id: string | null
          correction_reason: string | null
          created_at: string
          cycle_id: string | null
          educational_offer_scheme_id: string | null
          educational_offer_value_id: string | null
          educational_offer_value_version: number | null
          id: string
          institutional_number: string | null
          logical_id: string | null
          opened_on: string | null
          originating_act_ref: string | null
          recorded_by: string | null
          school_id: string
          student_id: string
          supersedes_id: string | null
        }
        Insert: {
          academic_year_id?: string | null
          correction_reason?: string | null
          created_at?: string
          cycle_id?: string | null
          educational_offer_scheme_id?: string | null
          educational_offer_value_id?: string | null
          educational_offer_value_version?: number | null
          id: string
          institutional_number?: string | null
          logical_id?: string | null
          opened_on?: string | null
          originating_act_ref?: string | null
          recorded_by?: string | null
          school_id: string
          student_id: string
          supersedes_id?: string | null
        }
        Update: {
          academic_year_id?: string | null
          correction_reason?: string | null
          created_at?: string
          cycle_id?: string | null
          educational_offer_scheme_id?: string | null
          educational_offer_value_id?: string | null
          educational_offer_value_version?: number | null
          id?: string
          institutional_number?: string | null
          logical_id?: string | null
          opened_on?: string | null
          originating_act_ref?: string | null
          recorded_by?: string | null
          school_id?: string
          student_id?: string
          supersedes_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_enrollments_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "institutional_academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_enrollments_school_fk"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "institutional_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_enrollments_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "school_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      sigem_activator_account_origins: {
        Row: {
          designation_version: number
          login: string
          recorded_at: string
          requested_by_user_id: string
          user_id: string
        }
        Insert: {
          designation_version: number
          login: string
          recorded_at?: string
          requested_by_user_id: string
          user_id: string
        }
        Update: {
          designation_version?: number
          login?: string
          recorded_at?: string
          requested_by_user_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sigem_activator_account_origins_designation_version_fkey"
            columns: ["designation_version"]
            isOneToOne: false
            referencedRelation: "sigem_installer_designation_versions"
            referencedColumns: ["version"]
          },
        ]
      }
      sigem_installation_acts: {
        Row: {
          act_ref: string | null
          engagement_id: string
          executor_user_id: string
          id: string
          installed_at: string
          person_id: string
          policy_fingerprint: string | null
          policy_id: string
          provenance: string
          singleton: boolean
        }
        Insert: {
          act_ref?: string | null
          engagement_id: string
          executor_user_id: string
          id?: string
          installed_at?: string
          person_id: string
          policy_fingerprint?: string | null
          policy_id: string
          provenance?: string
          singleton?: boolean
        }
        Update: {
          act_ref?: string | null
          engagement_id?: string
          executor_user_id?: string
          id?: string
          installed_at?: string
          person_id?: string
          policy_fingerprint?: string | null
          policy_id?: string
          provenance?: string
          singleton?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "sigem_installation_acts_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sigem_installation_acts_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sigem_installation_acts_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "capability_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      sigem_installation_state: {
        Row: {
          changed_at: string
          singleton: boolean
          state: string
        }
        Insert: {
          changed_at?: string
          singleton?: boolean
          state?: string
        }
        Update: {
          changed_at?: string
          singleton?: boolean
          state?: string
        }
        Relationships: []
      }
      sigem_installer_designation: {
        Row: {
          created_at: string
          designation_act_ref: string
          installer_email: string
          singleton: boolean
        }
        Insert: {
          created_at?: string
          designation_act_ref: string
          installer_email: string
          singleton?: boolean
        }
        Update: {
          created_at?: string
          designation_act_ref?: string
          installer_email?: string
          singleton?: boolean
        }
        Relationships: []
      }
      sigem_installer_designation_origins: {
        Row: {
          decision_source: string
          id: string
          outcome: string
          recorded_at: string
          requested_email: string
        }
        Insert: {
          decision_source: string
          id?: string
          outcome: string
          recorded_at?: string
          requested_email: string
        }
        Update: {
          decision_source?: string
          id?: string
          outcome?: string
          recorded_at?: string
          requested_email?: string
        }
        Relationships: []
      }
      sigem_installer_designation_versions: {
        Row: {
          basis: string
          basis_note: string
          designation_act_ref: string | null
          installer_email: string
          recorded_at: string
          supersedes_version: number | null
          version: number
        }
        Insert: {
          basis: string
          basis_note: string
          designation_act_ref?: string | null
          installer_email: string
          recorded_at?: string
          supersedes_version?: number | null
          version: number
        }
        Update: {
          basis?: string
          basis_note?: string
          designation_act_ref?: string | null
          installer_email?: string
          recorded_at?: string
          supersedes_version?: number | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "sigem_installer_designation_versions_supersedes_version_fkey"
            columns: ["supersedes_version"]
            isOneToOne: false
            referencedRelation: "sigem_installer_designation_versions"
            referencedColumns: ["version"]
          },
        ]
      }
      statistical_map_events: {
        Row: {
          fingerprint: string | null
          id: string
          kind: string
          map_id: string
          payload: Json
          person_id: string | null
          recorded_at: string
          recorded_by: string
        }
        Insert: {
          fingerprint?: string | null
          id?: string
          kind: string
          map_id: string
          payload?: Json
          person_id?: string | null
          recorded_at?: string
          recorded_by: string
        }
        Update: {
          fingerprint?: string | null
          id?: string
          kind?: string
          map_id?: string
          payload?: Json
          person_id?: string | null
          recorded_at?: string
          recorded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "statistical_map_events_map_id_fkey"
            columns: ["map_id"]
            isOneToOne: false
            referencedRelation: "statistical_maps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statistical_map_events_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
        ]
      }
      statistical_map_versions: {
        Row: {
          capability_policy_id: string | null
          capability_policy_version: number | null
          conference_event_id: string
          correction_event_id: string | null
          correction_reason: string | null
          engagement_id: string | null
          fingerprint: string
          id: string
          map_id: string
          person_id: string | null
          recorded_at: string
          recorded_by: string
          rule_id: string
          rule_version: number
          snapshot: Json
          snapshot_date: string
          supersedes_id: string | null
          version: number
        }
        Insert: {
          capability_policy_id?: string | null
          capability_policy_version?: number | null
          conference_event_id: string
          correction_event_id?: string | null
          correction_reason?: string | null
          engagement_id?: string | null
          fingerprint: string
          id?: string
          map_id: string
          person_id?: string | null
          recorded_at?: string
          recorded_by: string
          rule_id: string
          rule_version: number
          snapshot: Json
          snapshot_date: string
          supersedes_id?: string | null
          version: number
        }
        Update: {
          capability_policy_id?: string | null
          capability_policy_version?: number | null
          conference_event_id?: string
          correction_event_id?: string | null
          correction_reason?: string | null
          engagement_id?: string | null
          fingerprint?: string
          id?: string
          map_id?: string
          person_id?: string | null
          recorded_at?: string
          recorded_by?: string
          rule_id?: string
          rule_version?: number
          snapshot?: Json
          snapshot_date?: string
          supersedes_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "statistical_map_versions_capability_policy_id_fkey"
            columns: ["capability_policy_id"]
            isOneToOne: false
            referencedRelation: "capability_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statistical_map_versions_conference_event_id_fkey"
            columns: ["conference_event_id"]
            isOneToOne: false
            referencedRelation: "statistical_map_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statistical_map_versions_correction_event_id_fkey"
            columns: ["correction_event_id"]
            isOneToOne: true
            referencedRelation: "statistical_map_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statistical_map_versions_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statistical_map_versions_map_id_fkey"
            columns: ["map_id"]
            isOneToOne: false
            referencedRelation: "statistical_maps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statistical_map_versions_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statistical_map_versions_rule_id_rule_version_fkey"
            columns: ["rule_id", "rule_version"]
            isOneToOne: false
            referencedRelation: "map_competence_rules"
            referencedColumns: ["id", "version"]
          },
          {
            foreignKeyName: "statistical_map_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "statistical_map_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      statistical_maps: {
        Row: {
          competence_month: number
          competence_year: number
          id: string
          opened_at: string
          opened_by: string
          opened_person_id: string | null
          rule_id: string | null
          rule_version: number | null
          school_id: string
        }
        Insert: {
          competence_month: number
          competence_year: number
          id?: string
          opened_at?: string
          opened_by: string
          opened_person_id?: string | null
          rule_id?: string | null
          rule_version?: number | null
          school_id: string
        }
        Update: {
          competence_month?: number
          competence_year?: number
          id?: string
          opened_at?: string
          opened_by?: string
          opened_person_id?: string | null
          rule_id?: string | null
          rule_version?: number | null
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "statistical_maps_opened_person_id_fkey"
            columns: ["opened_person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statistical_maps_rule_id_rule_version_fkey"
            columns: ["rule_id", "rule_version"]
            isOneToOne: false
            referencedRelation: "map_competence_rules"
            referencedColumns: ["id", "version"]
          },
          {
            foreignKeyName: "statistical_maps_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
        ]
      }
      student_attendance_occurrences: {
        Row: {
          annulled: boolean
          author_person_id: string | null
          author_user_id: string
          authorizing_engagement_id: string
          capability_policy_id: string
          capability_policy_version: number
          class_id: string
          created_at: string
          document_ref: string | null
          from_date: string
          id: string
          justification: string | null
          logical_id: string
          note: string | null
          occurrence_type_id: string
          occurrence_type_version: number
          plan_id: string
          student_id: string
          supersedes_id: string | null
          until_date: string
          version: number
        }
        Insert: {
          annulled?: boolean
          author_person_id?: string | null
          author_user_id: string
          authorizing_engagement_id: string
          capability_policy_id: string
          capability_policy_version: number
          class_id: string
          created_at?: string
          document_ref?: string | null
          from_date: string
          id?: string
          justification?: string | null
          logical_id: string
          note?: string | null
          occurrence_type_id: string
          occurrence_type_version: number
          plan_id: string
          student_id: string
          supersedes_id?: string | null
          until_date: string
          version: number
        }
        Update: {
          annulled?: boolean
          author_person_id?: string | null
          author_user_id?: string
          authorizing_engagement_id?: string
          capability_policy_id?: string
          capability_policy_version?: number
          class_id?: string
          created_at?: string
          document_ref?: string | null
          from_date?: string
          id?: string
          justification?: string | null
          logical_id?: string
          note?: string | null
          occurrence_type_id?: string
          occurrence_type_version?: number
          plan_id?: string
          student_id?: string
          supersedes_id?: string | null
          until_date?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_attendance_occurrence_occurrence_type_id_occurrenc_fkey"
            columns: ["occurrence_type_id", "occurrence_type_version"]
            isOneToOne: false
            referencedRelation: "attendance_occurrence_types"
            referencedColumns: ["id", "version"]
          },
          {
            foreignKeyName: "student_attendance_occurrences_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "student_attendance_occurrences"
            referencedColumns: ["id"]
          },
        ]
      }
      student_identity_versions: {
        Row: {
          birth_date: string | null
          civil_name: string | null
          correction_reason: string | null
          created_at: string
          id: string
          originating_act_ref: string | null
          recorded_by: string
          recorded_by_person_id: string | null
          recorded_via_engagement_id: string | null
          sex_scheme_id: string
          sex_value_id: string | null
          sex_value_version: number | null
          social_name: string | null
          student_id: string
          supersedes_id: string | null
          version: number
        }
        Insert: {
          birth_date?: string | null
          civil_name?: string | null
          correction_reason?: string | null
          created_at?: string
          id?: string
          originating_act_ref?: string | null
          recorded_by: string
          recorded_by_person_id?: string | null
          recorded_via_engagement_id?: string | null
          sex_scheme_id?: string
          sex_value_id?: string | null
          sex_value_version?: number | null
          social_name?: string | null
          student_id: string
          supersedes_id?: string | null
          version: number
        }
        Update: {
          birth_date?: string | null
          civil_name?: string | null
          correction_reason?: string | null
          created_at?: string
          id?: string
          originating_act_ref?: string | null
          recorded_by?: string
          recorded_by_person_id?: string | null
          recorded_via_engagement_id?: string | null
          sex_scheme_id?: string
          sex_value_id?: string | null
          sex_value_version?: number | null
          social_name?: string | null
          student_id?: string
          supersedes_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_identity_versions_sex_scheme_id_sex_value_id_sex_v_fkey"
            columns: ["sex_scheme_id", "sex_value_id", "sex_value_version"]
            isOneToOne: false
            referencedRelation: "attribute_value_definitions"
            referencedColumns: ["scheme_id", "value_id", "version"]
          },
          {
            foreignKeyName: "student_identity_versions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "institutional_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_identity_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "student_identity_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      student_movement_events: {
        Row: {
          correction_reason: string | null
          created_at: string
          destination: Json | null
          effective_on: string | null
          enrollment_id: string | null
          id: string
          logical_id: string
          movement_type_id: string
          movement_type_version: number
          origin: Json | null
          originating_act_ref: string | null
          reason_code: string | null
          reason_text: string | null
          recorded_by: string
          school_scope_ids: string[]
          student_id: string
          supersedes_id: string | null
          version: number
        }
        Insert: {
          correction_reason?: string | null
          created_at?: string
          destination?: Json | null
          effective_on?: string | null
          enrollment_id?: string | null
          id?: string
          logical_id: string
          movement_type_id: string
          movement_type_version: number
          origin?: Json | null
          originating_act_ref?: string | null
          reason_code?: string | null
          reason_text?: string | null
          recorded_by: string
          school_scope_ids: string[]
          student_id: string
          supersedes_id?: string | null
          version: number
        }
        Update: {
          correction_reason?: string | null
          created_at?: string
          destination?: Json | null
          effective_on?: string | null
          enrollment_id?: string | null
          id?: string
          logical_id?: string
          movement_type_id?: string
          movement_type_version?: number
          origin?: Json | null
          originating_act_ref?: string | null
          reason_code?: string | null
          reason_text?: string | null
          recorded_by?: string
          school_scope_ids?: string[]
          student_id?: string
          supersedes_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_movement_events_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "school_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_movement_events_movement_type_id_movement_type_ver_fkey"
            columns: ["movement_type_id", "movement_type_version"]
            isOneToOne: false
            referencedRelation: "movement_type_definitions"
            referencedColumns: ["id", "version"]
          },
          {
            foreignKeyName: "student_movement_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "institutional_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_movement_events_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "student_movement_events"
            referencedColumns: ["id"]
          },
        ]
      }
      student_official_identifiers: {
        Row: {
          created_at: string
          id: string
          identifier_kind_id: string
          identifier_kind_version: number
          originating_act_ref: string | null
          recorded_by: string
          recorded_by_person_id: string | null
          recorded_via_engagement_id: string | null
          student_id: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          identifier_kind_id: string
          identifier_kind_version: number
          originating_act_ref?: string | null
          recorded_by: string
          recorded_by_person_id?: string | null
          recorded_via_engagement_id?: string | null
          student_id: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          identifier_kind_id?: string
          identifier_kind_version?: number
          originating_act_ref?: string | null
          recorded_by?: string
          recorded_by_person_id?: string | null
          recorded_via_engagement_id?: string | null
          student_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_official_identifiers_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "institutional_students"
            referencedColumns: ["id"]
          },
        ]
      }
      teaching_assignment_versions: {
        Row: {
          assignment_id: string
          change_kind: string
          change_reason: string | null
          created_at: string
          engagement_id: string
          id: string
          item_key: string
          matrix_id: string
          matrix_version_id: string
          recorded_by: string
          recorded_by_person_id: string | null
          recorded_via_engagement_id: string
          role_scheme_id: string | null
          role_value_id: string | null
          role_value_version: number | null
          source_ref: string | null
          supersedes_id: string | null
          valid_from: string
          valid_until: string | null
          version: number
        }
        Insert: {
          assignment_id: string
          change_kind: string
          change_reason?: string | null
          created_at?: string
          engagement_id: string
          id?: string
          item_key: string
          matrix_id: string
          matrix_version_id: string
          recorded_by: string
          recorded_by_person_id?: string | null
          recorded_via_engagement_id: string
          role_scheme_id?: string | null
          role_value_id?: string | null
          role_value_version?: number | null
          source_ref?: string | null
          supersedes_id?: string | null
          valid_from: string
          valid_until?: string | null
          version: number
        }
        Update: {
          assignment_id?: string
          change_kind?: string
          change_reason?: string | null
          created_at?: string
          engagement_id?: string
          id?: string
          item_key?: string
          matrix_id?: string
          matrix_version_id?: string
          recorded_by?: string
          recorded_by_person_id?: string | null
          recorded_via_engagement_id?: string
          role_scheme_id?: string | null
          role_value_id?: string | null
          role_value_version?: number | null
          source_ref?: string | null
          supersedes_id?: string | null
          valid_from?: string
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "teaching_assignment_versions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "teaching_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_assignment_versions_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_assignment_versions_matrix_version_id_fkey"
            columns: ["matrix_version_id"]
            isOneToOne: false
            referencedRelation: "curricular_matrix_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_assignment_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "teaching_assignment_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      teaching_assignments: {
        Row: {
          class_id: string
          created_at: string
          id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teaching_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "institutional_classes"
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
      act_as_verified_user: { Args: { _actor: string }; Returns: undefined }
      activate_sigem_reviewed: {
        Args: {
          _confirm_all_rules_reviewed: boolean
          _expected_fingerprint: string
          _policy_id: string
        }
        Returns: string
      }
      allocation_curricular_positions_at: {
        Args: {
          _class: string
          _known_at?: string
          _school: string
          _valid_on: string
        }
        Returns: {
          allocation_id: string
          allocation_logical_id: string
          axes: Json
          change_reason: string
          class_id: string
          originating_act_ref: string
          position_logical_id: string
          position_version: number
          position_version_id: string
          recorded_at: string
          school_id: string
          student_id: string
          valid_from: string
          valid_until: string
        }[]
      }
      am_designated_installer: { Args: never; Returns: boolean }
      applicable_diary_policy: {
        Args: { _closing_present: boolean; _family: string }
        Returns: {
          admissible_changes: string[] | null
          applies_when_official_closing: string
          created_at: string
          definition: Json
          family_id: string
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
        }[]
        SetofOptions: {
          from: "*"
          to: "diary_correction_policies"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      applicable_map_rule: {
        Args: { _on: string }
        Returns: {
          id: string
          version: number
        }[]
      }
      apply_assessment_instrument: {
        Args: { _expected_last_event_id: string; _instrument: string }
        Returns: string
      }
      assessment_value_problem: { Args: { _v: Json }; Returns: string }
      attendance_closing_covering: {
        Args: { _class: string; _lesson_logical: string }
        Returns: string
      }
      attribute_value_homologated: {
        Args: { _on: string; _scheme: string; _value: string; _version: number }
        Returns: boolean
      }
      authorize_account_action: {
        Args: { _actor: string; _user: string }
        Returns: undefined
      }
      b2_4_authorizing_engagement: { Args: never; Returns: string }
      b3_allocation_ended_on: { Args: { _logical: string }; Returns: string }
      b3_enrollment_ending_head: {
        Args: { _logical: string }
        Returns: {
          annulled: boolean
          bond_status_value_id: string | null
          bond_status_version: number | null
          correction_reason: string | null
          created_at: string
          ended_on: string | null
          enrollment_logical_id: string
          id: string
          originating_act_ref: string | null
          reason_text: string | null
          recorded_by: string
          school_id: string
          supersedes_id: string | null
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "cycle_enrollment_ending_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      b3_enrollment_head: {
        Args: { _logical: string }
        Returns: {
          academic_year_id: string | null
          correction_reason: string | null
          created_at: string
          cycle_id: string | null
          educational_offer_scheme_id: string | null
          educational_offer_value_id: string | null
          educational_offer_value_version: number | null
          id: string
          institutional_number: string | null
          logical_id: string | null
          opened_on: string | null
          originating_act_ref: string | null
          recorded_by: string | null
          school_id: string
          student_id: string
          supersedes_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "school_enrollments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      b3_participation_head: {
        Args: { _logical: string }
        Returns: {
          annulled: boolean
          change_reason: string | null
          created_at: string
          enrollment_logical_id: string
          id: string
          logical_id: string
          nature_scheme_id: string
          nature_value_id: string
          nature_version: number
          originating_act_ref: string | null
          recorded_by: string
          school_id: string
          student_id: string
          supersedes_id: string | null
          valid_from: string
          valid_until: string | null
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "cycle_participations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      b33_value_homologated_throughout: {
        Args: {
          _from: string
          _scheme: string
          _until: string
          _value: string
          _version: number
        }
        Returns: boolean
      }
      b4_class_time_capabilities: { Args: never; Returns: string[] }
      b4_class_time_grant: {
        Args: { _capability: string; _school: string }
        Returns: string
      }
      b41_component_active_throughout: {
        Args: { _component: string; _from: string; _until: string }
        Returns: boolean
      }
      b41_raise: { Args: { _code: string }; Returns: boolean }
      b41_school_active_throughout: {
        Args: { _from: string; _school: string; _until: string }
        Returns: boolean
      }
      b41_segment_points: {
        Args: { _from: string; _points: string[]; _until: string }
        Returns: {
          at_date: string
        }[]
      }
      b41_year_active_throughout: {
        Args: { _from: string; _until: string; _year: string }
        Returns: boolean
      }
      calendar_allocation_state_at: {
        Args: {
          _allocation: string
          _known_at: string
          _on: string
          _school: string
          _year: string
        }
        Returns: string
      }
      calendar_applicability_candidates: {
        Args: {
          _allocation: string
          _axis: Json
          _known_at: string
          _on: string
          _position: string
          _school: string
        }
        Returns: {
          calendar_id: string
          resolution: string
          scope_key: string
          version_id: string
        }[]
      }
      calendar_applicability_condition_issue: {
        Args: {
          _c: Database["public"]["Tables"]["calendar_version_applicability_conditions"]["Row"]
          _from: string
          _until: string
          _year: string
        }
        Returns: string
      }
      calendar_applicability_options_at: {
        Args: { _version_id: string }
        Returns: Json
      }
      calendar_at: {
        Args: { _calendar_id: string; _known_at: string; _on: string }
        Returns: {
          known_at: string
          result_kind: string
          valid_on: string
        }[]
      }
      calendar_composed_day_private: {
        Args: { _allocation: string; _known_at: string; _on: string }
        Returns: Json
      }
      calendar_composed_days_at: {
        Args: {
          _allocation: string
          _from: string
          _known_at: string
          _to: string
        }
        Returns: Json
      }
      calendar_composition_evidence_at: {
        Args: { _allocation: string; _known_at: string; _on: string }
        Returns: Json
      }
      calendar_composition_norm_at: {
        Args: { _known_at: string; _on: string }
        Returns: Json
      }
      calendar_composition_norm_configuration_issue: {
        Args: { _known_at: string; _version: string }
        Returns: string
      }
      calendar_composition_norm_homologation_state_at: {
        Args: { _known_at: string; _on: string; _version: string }
        Returns: string
      }
      calendar_composition_norm_state_at: {
        Args: { _known_at: string; _on: string }
        Returns: {
          detail: string
          norm_id: string
          state: string
          version_id: string
        }[]
      }
      calendar_composition_norm_versions_at: {
        Args: { _known_at: string; _on: string }
        Returns: {
          norm_id: string
          version: number
          version_id: string
        }[]
      }
      calendar_condition_state_at: {
        Args: {
          _c: Database["public"]["Tables"]["calendar_version_applicability_conditions"]["Row"]
          _known_at: string
          _on: string
          _school: string
          _scope_allocation: string
          _year: string
        }
        Returns: string
      }
      calendar_council_agenda_at: {
        Args: {
          _allocation: string
          _from: string
          _known_at: string
          _to: string
        }
        Returns: Json
      }
      calendar_council_configuration_at: {
        Args: { _known_at: string; _on: string; _version_id: string }
        Returns: Json
      }
      calendar_day_at: {
        Args: { _calendar_id: string; _date: string; _known_at: string }
        Returns: {
          known_at: string
          result_kind: string
          valid_on: string
        }[]
      }
      calendar_day_declarations: {
        Args: { _calendar_id: string; _date: string; _known_at: string }
        Returns: {
          day_state: string
          day_type_id: string
          day_type_label: string
          day_type_version: number
          day_type_version_id: string
          declaration_id: string
          declaration_kind: string
          ends_on: string
          event_label: string
          homologation_state: string
          reference_issue: string
          school_day_effect: boolean
          starts_on: string
          version_id: string
        }[]
      }
      calendar_day_types_at: { Args: { _known_at: string }; Returns: Json }
      calendar_days_at: {
        Args: {
          _calendar_id: string
          _from: string
          _known_at: string
          _to: string
        }
        Returns: Json
      }
      calendar_designated_capabilities: {
        Args: { _on?: string }
        Returns: {
          capability_id: string
          engagement_id: string
        }[]
      }
      calendar_effective_version: {
        Args: { _calendar_id: string; _known_at: string; _on: string }
        Returns: string
      }
      calendar_has_network_capability: {
        Args: { _cap: string }
        Returns: boolean
      }
      calendar_list_at: { Args: { _known_at: string }; Returns: Json }
      calendar_network_grant: { Args: { _cap: string }; Returns: string }
      calendar_network_sources_at: {
        Args: { _known_at: string }
        Returns: Json
      }
      calendar_pending_context_visible: {
        Args: { _version_id: string }
        Returns: boolean
      }
      calendar_presentation_at: {
        Args: { _known_at: string; _on: string; _version_id: string }
        Returns: Json
      }
      calendar_snapshot_issue: {
        Args: { _from: string; _known_at: string; _to: string }
        Returns: string
      }
      calendar_version_homologated_known: {
        Args: { _known_at: string; _version_id: string }
        Returns: boolean
      }
      calendar_version_homologation_state: {
        Args: { _known_at: string; _on: string; _version_id: string }
        Returns: string
      }
      calendar_version_reference_issue: {
        Args: { _known_at: string; _version_id: string }
        Returns: string
      }
      calendar_window_year_issue: {
        Args: { _from: string; _until: string; _year: string }
        Returns: string
      }
      calendar_year_state_at: {
        Args: { _known_at: string; _on: string; _year: string }
        Returns: string
      }
      can_read_attendance_closing: {
        Args: { _class: string; _period: string }
        Returns: boolean
      }
      can_read_class_roster: { Args: { _class: string }; Returns: boolean }
      can_read_closing: {
        Args: { _class: string; _period: string }
        Returns: boolean
      }
      can_read_collegial: { Args: { _class: string }; Returns: boolean }
      can_read_institutional_class: {
        Args: { _class: string; _school: string }
        Returns: boolean
      }
      cancel_school_document_emission: {
        Args: { _emission_id: string; _reason: string }
        Returns: Json
      }
      canonical_reference_state: { Args: { _id: string }; Returns: string }
      capability_grant: {
        Args: {
          _capability: string
          _class: string
          _component?: string
          _period?: string
        }
        Returns: {
          engagement_id: string
          policy_id: string
          policy_version: number
        }[]
      }
      capability_policy_homologation_issues: {
        Args: { _policy: string; _valid_from: string }
        Returns: string
      }
      class_allocations_at: {
        Args: {
          _class: string
          _known_at?: string
          _school: string
          _valid_on?: string
        }
        Returns: {
          class_id: string
          class_label_snapshot: string
          created_at: string
          ended_on: string
          ending_reason: string
          ending_version_id: string
          enrollment_id: string
          id: string
          logical_id: string
          originating_act_ref: string
          participation_logical_id: string
          school_id: string
          student_id: string
          valid_from: string
        }[]
      }
      class_at: {
        Args: { _class_id: string; _known_at?: string; _valid_on: string }
        Returns: {
          administrative_status: string
          authorizing_policy_id: string
          change_reason: string | null
          class_id: string
          code: string | null
          created_at: string
          id: string
          name: string
          originating_act_ref: string
          recorded_by: string
          recorded_by_person_id: string
          recorded_via_engagement_id: string
          segment_id: string
          supersedes_id: string | null
          valid_from: string
          valid_until: string | null
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "institutional_class_record_versions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      class_capacity_at: {
        Args: { _class: string; _known_at?: string; _valid_on: string }
        Returns: {
          annulled: boolean
          basis_text: string | null
          change_reason: string | null
          class_id: string
          created_at: string
          id: string
          logical_id: string
          originating_act_ref: string | null
          recorded_by: string
          reference_limit: number | null
          school_id: string
          supersedes_id: string | null
          valid_from: string
          valid_until: string | null
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "class_capacity_records"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      class_curricular_matrices_at: {
        Args: {
          _class_id: string
          _known_at: string
          _on: string
          _school: string
        }
        Returns: {
          allocation_count: number
          association_homologation_id: string
          association_id: string
          association_version_id: string
          class_id: string
          column_keys: string[]
          context_state: string
          correspondence_ids: string[]
          gate_effect: string
          known_at: string
          matrix_homologation_id: string
          matrix_id: string
          matrix_version_id: string
          resolved_allocations: number
          result_kind: string
          state: string
          total_allocations: number
          valid_on: string
        }[]
      }
      class_curricular_resolution_context_at: {
        Args: { _class_id: string; _known_at: string; _on: string }
        Returns: {
          class_id: string
          conflicting_association_id: string
          context_state: string
          gate_effect: string
          nature_scheme_id: string
          nature_value_id: string
          nature_value_version: number
          offering_version_id: string
          position_key_schemes: string[]
          profile_homologation_id: string
          profile_id: string
          profile_version_id: string
        }[]
      }
      class_fact_context: {
        Args: { _class_id: string; _from: string; _until: string }
        Returns: undefined
      }
      class_journey_at: {
        Args: { _class_id: string; _known_at: string; _on: string }
        Returns: {
          change_kind: string
          change_reason: string
          class_id: string
          day_first_start: string
          day_last_end: string
          day_minutes: number
          effective_until: string
          ends_at: string
          journey_id: string
          known_at: string
          originating_act_ref: string
          recorded_at: string
          result_kind: string
          starts_at: string
          valid_from: string
          valid_on: string
          version: number
          version_id: string
          week_minutes: number
          weekday: number
        }[]
      }
      class_journey_effective_versions: {
        Args: { _jid: string; _known_at: string; _on: string }
        Returns: {
          act: string
          change_kind: string
          created: string
          eu: string
          id: string
          reason: string
          valid_from: string
          version: number
        }[]
      }
      class_occupancy_at: {
        Args: { _class: string; _known_at?: string; _valid_on: string }
        Returns: number
      }
      class_offering_at: {
        Args: { _class_id: string; _known_at?: string; _valid_on: string }
        Returns: {
          correction_reason: string
          created_at: string
          logical_id: string
          offering_version_id: string
          originating_act_ref: string
          scheme_id: string
          valid_from: string
          valid_until: string
          value_id: string
          value_label: string
          value_version: number
          version: number
        }[]
      }
      class_period_link_boundary: {
        Args: { _new_org: string; _old_org: string; _on: string }
        Returns: undefined
      }
      class_period_link_context: {
        Args: {
          _class_id: string
          _from: string
          _organization_id: string
          _until: string
        }
        Returns: undefined
      }
      class_period_organization_at: {
        Args: { _class_id: string; _known_at?: string; _valid_on: string }
        Returns: {
          authorizing_policy_id: string
          change_reason: string | null
          class_id: string
          created_at: string
          id: string
          organization_id: string
          originating_act_ref: string
          recorded_by: string
          recorded_by_person_id: string
          recorded_via_engagement_id: string
          segment_id: string
          supersedes_id: string | null
          valid_from: string
          valid_until: string | null
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "institutional_class_period_organization_versions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      class_record_context: {
        Args: {
          _academic_year_id: string
          _school_id: string
          _valid_from: string
          _valid_until: string
        }
        Returns: {
          school_name: string
          year_name: string
        }[]
      }
      class_registry_school_grant: {
        Args: { _capability: string; _school: string }
        Returns: {
          engagement_id: string
          policy_id: string
          policy_version: number
        }[]
      }
      class_schedule_at: {
        Args: { _class_id: string; _known_at: string; _on: string }
        Returns: {
          block_id: string
          block_issues: string[]
          block_key: string
          block_minutes: number
          block_state: string
          change_kind: string
          change_reason: string
          class_id: string
          component_id: string
          component_name: string
          component_version: number
          coverage_matrix_ids: string[]
          coverage_state: string
          day_minutes: number
          effective_until: string
          ends_at: string
          engagement_ids: string[]
          known_at: string
          nature_label: string
          nature_scheme_id: string
          nature_value_id: string
          nature_value_version: number
          originating_act_ref: string
          overlapping_block_keys: string[]
          recorded_at: string
          result_kind: string
          schedule_id: string
          schedule_state: string
          starts_at: string
          valid_from: string
          valid_on: string
          version: number
          version_id: string
          week_minutes: number
          weekday: number
        }[]
      }
      class_schedule_effective_versions: {
        Args: { _known_at: string; _on: string; _sid: string }
        Returns: {
          act: string
          change_kind: string
          created: string
          eu: string
          id: string
          reason: string
          valid_from: string
          version: number
        }[]
      }
      class_schedule_engagement_valid: {
        Args: {
          _class: string
          _component: string
          _engagement: string
          _known_at: string
          _on: string
        }
        Returns: boolean
      }
      class_shift_at: {
        Args: { _class_id: string; _known_at?: string; _valid_on: string }
        Returns: {
          correction_reason: string
          created_at: string
          logical_id: string
          originating_act_ref: string
          shift_version_id: string
          valid_from: string
          valid_until: string
          value_id: string
          value_label: string
          value_version: number
          version: number
        }[]
      }
      class_specific_curricular_matrix_at: {
        Args: { _class_id: string; _known_at: string; _on: string }
        Returns: {
          association_homologation_id: string
          association_id: string
          association_version_id: string
          class_id: string
          column_key: string
          context_state: string
          gate_effect: string
          matrix_homologation_id: string
          matrix_id: string
          matrix_version_id: string
          nature_scheme_id: string
          nature_value_id: string
          nature_value_version: number
          offering_version_id: string
          profile_homologation_id: string
          profile_id: string
          profile_version_id: string
          resolution_state: string
        }[]
      }
      class_specific_matrix_associations_at: {
        Args: { _known_at: string; _on: string }
        Returns: {
          association_id: string
          change_kind: string
          class_id: string
          created_at: string
          effective_until: string
          homologation_act_ref: string
          homologation_id: string
          homologation_state: string
          specific_act_ref: string
          target_column_key: string
          target_matrix_id: string
          valid_from: string
          version: number
          version_id: string
        }[]
      }
      close_collegial_minute: {
        Args: {
          _document: Json
          _expected_last_event_id: string
          _expected_minute_id: string
          _plan_id: string
          _session_id: string
        }
        Returns: string
      }
      collegial_conduct_authority: {
        Args: { _body: string; _class: string; _version: number }
        Returns: {
          engagement_id: string
          policy_id: string
          policy_version: number
        }[]
      }
      constitute_cycle_enrollment: {
        Args: {
          _academic_year: string
          _act_ref: string
          _correction_reason: string
          _id: string
          _institutional_number: string
          _offer_value?: string
          _opened_on: string
          _school: string
          _student: string
          _supersedes: string
        }
        Returns: string
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
      curricular_components_at: {
        Args: { _on: string }
        Returns: {
          component_id: string
          is_active: boolean
          official_name: string
          short_name: string
          valid_from: string
          version: number
        }[]
      }
      curricular_correspondence_profiles_at: {
        Args: { _known_at: string; _on: string }
        Returns: {
          applicability_rule: Json
          change_kind: string
          created_at: string
          effective_until: string
          homologation_act_ref: string
          homologation_id: string
          homologation_state: string
          nature_gates: Json
          nature_scheme_id: string
          originating_act_ref: string
          position_key_schemes: string[]
          profile_id: string
          valid_from: string
          version: number
          version_id: string
        }[]
      }
      curricular_matrices_at: {
        Args: { _known_at: string; _on: string }
        Returns: {
          change_kind: string
          created_at: string
          effective_until: string
          matrix_id: string
          official_name: string
          originating_act_ref: string
          valid_from: string
          valid_until: string
          version: number
          version_id: string
        }[]
      }
      curricular_matrix_applicability_at: {
        Args: { _known_at: string; _matrix: string; _on: string }
        Returns: {
          academic_year_id: string
          dimension: string
          scheme_id: string
          school_id: string
          value_id: string
          value_version: number
          version_id: string
        }[]
      }
      curricular_matrix_homologation_history: {
        Args: { _known_at: string; _version_id: string }
        Returns: {
          decision: string
          effective_from: string
          exercised_capability_id: string
          homologation_act_ref: string
          homologation_id: string
          reason: string
          recorded_at: string
          recorded_via_engagement_id: string
          sequence: number
          supersedes_id: string
        }[]
      }
      curricular_matrix_homologation_state_at: {
        Args: { _known_at: string; _on: string }
        Returns: {
          effective_from: string
          exercised_capability_id: string
          homologation_act_ref: string
          homologation_id: string
          homologation_sequence: number
          homologation_state: string
          matrix_id: string
          official_name: string
          recorded_at: string
          version: number
          version_id: string
        }[]
      }
      curricular_matrix_items_at: {
        Args: { _known_at: string; _matrix: string; _on: string }
        Returns: {
          component_id: string
          component_label_snapshot: string
          element_scheme_id: string
          element_value_id: string
          element_value_version: number
          item_key: string
          position: number
          quantity: number
          unit_scheme_id: string
          unit_value_id: string
          unit_value_version: number
          version_id: string
        }[]
      }
      curricular_matrix_layout_at: {
        Args: { _known_at: string; _matrix: string; _on: string }
        Returns: Json
      }
      curricular_position_matrix_correspondences_at: {
        Args: { _known_at: string; _on: string }
        Returns: {
          change_kind: string
          correspondence_id: string
          created_at: string
          effective_until: string
          homologation_act_ref: string
          homologation_id: string
          homologation_state: string
          originating_act_ref: string
          position_key: Json
          profile_id: string
          target_column_key: string
          target_matrix_id: string
          valid_from: string
          version: number
          version_id: string
        }[]
      }
      cycle_enrollments_at: {
        Args: { _known_at?: string; _school: string; _valid_on?: string }
        Returns: {
          academic_year_id: string
          bond_status_value_id: string
          bond_status_version: number
          created_at: string
          ended_on: string
          ending_reason: string
          ending_version_id: string
          id: string
          institutional_number: string
          logical_id: string
          opened_on: string
          originating_act_ref: string
          school_id: string
          student_id: string
        }[]
      }
      cycle_participations_at: {
        Args: { _known_at?: string; _school: string; _valid_on?: string }
        Returns: {
          annulled: boolean
          change_reason: string | null
          created_at: string
          enrollment_logical_id: string
          id: string
          logical_id: string
          nature_scheme_id: string
          nature_value_id: string
          nature_version: number
          originating_act_ref: string | null
          recorded_by: string
          school_id: string
          student_id: string
          supersedes_id: string | null
          valid_from: string
          valid_until: string | null
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "cycle_participations"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      declare_cycle_participation: {
        Args: {
          _act_ref: string
          _annul?: boolean
          _base_version_id: string
          _change_reason: string
          _enrollment_logical: string
          _logical: string
          _nature_value: string
          _nature_version: number
          _valid_from: string
          _valid_until: string
        }
        Returns: string
      }
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
      effective_scope_capabilities: {
        Args: { _on?: string }
        Returns: {
          capability_id: string
          engagement_id: string
          policy_id: string
          policy_version: number
          school_id: string
          scope_level: string
        }[]
      }
      emit_school_document: {
        Args: {
          _context: Json
          _reproduces_id: string
          _retification_reason: string
          _retifies_id: string
          _school_id: string
          _snapshot: Json
          _student_id: string
          _template_version_id: string
        }
        Returns: Json
      }
      end_engagement: {
        Args: { _act_ref: string; _ended_on: string; _engagement: string }
        Returns: undefined
      }
      functional_grant: {
        Args: { _school: string }
        Returns: Record<string, unknown>
      }
      general_admin_session: {
        Args: never
        Returns: {
          capability_count: number
          engagement_id: string
          position_label: string
        }[]
      }
      has_capability: {
        Args: { _capability: string; _class: string; _period?: string }
        Returns: boolean
      }
      has_network_capability: {
        Args: { _capability: string }
        Returns: boolean
      }
      has_school_capability: {
        Args: { _capability: string; _school: string }
        Returns: boolean
      }
      homologate_calendar_composition_norm: {
        Args: {
          _act_ref: string
          _decision: string
          _effective_from: string
          _expected_last_homologation_id: string
          _reason: string
          _version_id: string
        }
        Returns: Json
      }
      homologate_calendar_version: {
        Args: {
          _act_ref: string
          _calendar_version_id: string
          _decision: string
          _effective_from: string
          _expected_last_homologation_id: string
          _reason: string
        }
        Returns: Json
      }
      homologate_capability_policy: {
        Args: { _act_ref: string; _policy: string; _valid_from: string }
        Returns: undefined
      }
      homologate_class_specific_matrix_association_version: {
        Args: {
          _act_ref: string
          _decision: string
          _effective_from: string
          _expected_head_id: string
          _reason: string
          _version_id: string
        }
        Returns: Json
      }
      homologate_correspondence_profile_version: {
        Args: {
          _act_ref: string
          _decision: string
          _effective_from: string
          _expected_head_id: string
          _reason: string
          _version_id: string
        }
        Returns: Json
      }
      homologate_curricular_matrix_version: {
        Args: {
          _act_ref: string
          _decision: string
          _effective_from: string
          _expected_head_id: string
          _reason: string
          _version_id: string
        }
        Returns: Json
      }
      homologate_network_calendar: {
        Args: {
          _act_ref: string
          _expected_last_homologation_id: string
          _reason: string
          _version_id: string
        }
        Returns: Json
      }
      homologate_position_matrix_correspondence_version: {
        Args: {
          _act_ref: string
          _decision: string
          _effective_from: string
          _expected_head_id: string
          _reason: string
          _version_id: string
        }
        Returns: Json
      }
      homologated_attribute_values: {
        Args: { _on: string; _scheme: string }
        Returns: {
          homologation_act_ref: string
          label: string
          scheme_id: string
          valid_from: string
          value_id: string
          version: number
        }[]
      }
      homologated_correspondence_profile_at: {
        Args: { _known_at: string; _on: string }
        Returns: {
          applicability_rule: Json
          homologation_id: string
          nature_gates: Json
          nature_scheme_id: string
          position_key_schemes: string[]
          profile_id: string
          version: number
          version_id: string
        }[]
      }
      import_batch_detail: { Args: { _batch_id: string }; Returns: Json }
      import_batches_list: {
        Args: never
        Returns: {
          adapter_id: string
          adapter_version: number
          id: string
          operator_person: string
          received_at: string
          reprocesses_id: string
          row_count: number
          source_name: string
          source_ref: string
          source_sha256: string
          staged_sha256: string
        }[]
      }
      import_grant: { Args: never; Returns: string }
      install_sigem: {
        Args: {
          _act_ref: string
          _engagement_kind_id: string
          _person_identifier: string
          _person_name: string
          _policy_id: string
          _position_label: string
        }
        Returns: string
      }
      install_sigem_reviewed:
        | {
            Args: {
              _act_ref: string
              _actor_nature: string
              _confirm_all_rules_reviewed: boolean
              _engagement_kind_id: string
              _expected_fingerprint: string
              _person_identifier: string
              _person_name: string
              _policy_id: string
              _position_label: string
            }
            Returns: string
          }
        | {
            Args: {
              _act_ref: string
              _confirm_all_rules_reviewed: boolean
              _engagement_kind_id: string
              _expected_fingerprint: string
              _person_identifier: string
              _person_name: string
              _policy_id: string
              _position_label: string
            }
            Returns: string
          }
        | {
            Args: {
              _act_ref: string
              _confirm_all_rules_reviewed: boolean
              _engagement_kind_id: string
              _person_identifier: string
              _person_name: string
              _policy_id: string
              _position_label: string
              _reviewed_rule_count: number
            }
            Returns: string
          }
      installation_review: { Args: never; Returns: Json }
      link_institutional_account: {
        Args: { _actor: string; _login: string; _person: string; _user: string }
        Returns: undefined
      }
      locate_student_for_enrollment: {
        Args: { _kind: string; _value: string }
        Returns: {
          display_name: string
          student_id: string
        }[]
      }
      movement_types_at: {
        Args: { _known_at?: string; _on: string }
        Returns: {
          created_at: string
          homologation_act_ref: string
          id: string
          label: string
          valid_from: string
          version: number
        }[]
      }
      my_teaching_assignments_at: {
        Args: { _known_at: string; _on: string }
        Returns: {
          assignment_id: string
          class_id: string
          component_id: string
          component_label_snapshot: string
          effective_from: string
          effective_until: string
          element_value_id: string
          engagement_id: string
          item_key: string
          matrix_id: string
          role_value_id: string
          version_id: string
        }[]
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
      officialize_statistical_map: {
        Args: {
          _actor: string
          _base_version: string
          _conference: string
          _fingerprint: string
          _map: string
          _snapshot: Json
          _snapshot_date: string
        }
        Returns: string
      }
      open_map_correction_id: { Args: { _map: string }; Returns: string }
      open_statistical_map: {
        Args: { _month: number; _school: string; _year: number }
        Returns: string
      }
      open_statistical_map_correction: {
        Args: {
          _actor: string
          _base_version: string
          _map: string
          _reason: string
        }
        Returns: string
      }
      password_change_required: { Args: never; Returns: boolean }
      person_schedule_at: {
        Args: { _known_at: string; _on: string; _person_id: string }
        Returns: {
          block_id: string
          block_key: string
          block_minutes: number
          block_state: string
          class_id: string
          component_id: string
          component_name: string
          conflict_count: number
          ends_at: string
          known_at: string
          nature_label: string
          operational: boolean
          operational_block_count: number
          other_block_id: string
          other_class_id: string
          overlap_ends_at: string
          overlap_starts_at: string
          own_engagement_ids: string[]
          result_kind: string
          schedule_id: string
          school_id: string
          source_issue: string
          source_state: string
          starts_at: string
          unavailable_block_count: number
          valid_on: string
          version: number
          version_id: string
          week_minutes: number
          weekday: number
        }[]
      }
      person_schedule_class_source: {
        Args: { _class_id: string; _known_at: string; _on: string }
        Returns: {
          block_id: string
          block_key: string
          block_minutes: number
          block_state: string
          class_id: string
          component_id: string
          component_name: string
          ends_at: string
          engagement_ids: string[]
          issue: string
          nature_label: string
          result_kind: string
          schedule_id: string
          schedule_state: string
          starts_at: string
          version: number
          version_id: string
          weekday: number
        }[]
      }
      r5_capabilities: { Args: never; Returns: string[] }
      r5_network_grant: { Args: { _capability: string }; Returns: string }
      r5_record_homologation: {
        Args: {
          _act_ref: string
          _decision: string
          _effective_from: string
          _expected_head: string
          _kind: string
          _reason: string
          _target: string
        }
        Returns: Json
      }
      r5_version_step: {
        Args: {
          _base: string
          _change_kind: string
          _owner: string
          _owner_col: string
          _p: string
          _reason: string
          _valid_from: string
          _valid_until: string
          _versions: string
        }
        Returns: {
          next_version: number
          supersedes: string
        }[]
      }
      record_allocation_curricular_position: {
        Args: {
          _act_ref: string
          _allocation_logical: string
          _annul?: boolean
          _axes: Json
          _base_version_id: string
          _position_logical: string
          _reason: string
          _valid_from: string
          _valid_until: string
        }
        Returns: string
      }
      record_attendance_closing_act: {
        Args: {
          _action: string
          _class: string
          _detail: string
          _expected_attendance_version_ids: string[]
          _expected_closing_id: string
          _expected_last_event_id: string
          _justification: string
          _period: string
          _plan_id: string
          _record: Json
          _scope: Json
          _scope_key: string
        }
        Returns: string
      }
      record_attendance_occurrence: {
        Args: {
          _annul: boolean
          _class: string
          _document_ref: string
          _expected_version_id: string
          _from: string
          _justification: string
          _note: string
          _plan_id: string
          _student: string
          _type_id: string
          _type_version: number
          _until: string
        }
        Returns: string
      }
      record_attendance_version: {
        Args: {
          _base_version_id: string
          _justification: string
          _lesson_logical: string
          _marks: Json
          _plan_id: string
        }
        Returns: string
      }
      record_attribute_value_version: {
        Args: {
          _act_ref: string
          _base_version: number
          _label: string
          _reason: string
          _scheme: string
          _status: string
          _valid_from: string
          _value: string
        }
        Returns: number
      }
      record_calendar_composition_norm_version: {
        Args: {
          _act_ref: string
          _base_version_id: string
          _change_kind: string
          _dimension_rules: Json
          _effect_bindings: Json
          _multiplicity: string
          _norm_id: string
          _reason: string
          _valid_from: string
          _valid_until: string
        }
        Returns: Json
      }
      record_calendar_council_configuration: {
        Args: { _act_ref: string; _roles: Json; _version_id: string }
        Returns: Json
      }
      record_calendar_day_type_version: {
        Args: {
          _act_ref: string
          _base_version_id: string
          _change_kind: string
          _day_type: string
          _label: string
          _reason: string
          _school_day_effect: boolean
        }
        Returns: Json
      }
      record_calendar_presentation_snapshot: {
        Args: {
          _declared_note: string
          _presentation: Json
          _source_digest: string
          _source_entry_id: string
          _source_key: string
          _source_kind: string
          _source_raw: Json
          _version_id: string
        }
        Returns: Json
      }
      record_calendar_version: {
        Args: {
          _academic_year_id: string
          _act_ref: string
          _base_version_id: string
          _calendar: string
          _change_kind: string
          _days: Json
          _events: Json
          _period_organization_id: string
          _periods: Json
          _ranges: Json
          _reason: string
          _valid_from: string
          _valid_until: string
        }
        Returns: Json
      }
      record_calendar_version_with_applicability: {
        Args: {
          _academic_year_id: string
          _act_ref: string
          _applicability: Json
          _base_version_id: string
          _calendar: string
          _change_kind: string
          _days: Json
          _events: Json
          _period_organization_id: string
          _periods: Json
          _ranges: Json
          _reason: string
          _valid_from: string
          _valid_until: string
        }
        Returns: Json
      }
      record_calendar_version_with_windowed_applicability: {
        Args: {
          _academic_year_id: string
          _act_ref: string
          _applicability: Json
          _base_version_id: string
          _calendar: string
          _change_kind: string
          _days: Json
          _events: Json
          _period_organization_id: string
          _periods: Json
          _ranges: Json
          _reason: string
          _valid_from: string
          _valid_until: string
        }
        Returns: Json
      }
      record_class_allocation:
        | {
            Args: {
              _act_ref: string
              _class: string
              _correction_reason: string
              _id: string
              _participation_logical: string
              _supersedes: string
              _valid_from: string
            }
            Returns: string
          }
        | {
            Args: {
              _act_ref: string
              _class: string
              _correction_reason: string
              _ended_on: string
              _ending_reason: string
              _id: string
              _participation_logical: string
              _supersedes: string
              _valid_from: string
            }
            Returns: string
          }
      record_class_allocation_ending: {
        Args: {
          _act_ref: string
          _allocation_logical: string
          _annul?: boolean
          _base_version_id: string
          _correction_reason: string
          _ended_on: string
          _reason: string
        }
        Returns: string
      }
      record_class_capacity: {
        Args: {
          _act_ref: string
          _annul?: boolean
          _base_version_id: string
          _basis: string
          _change_reason: string
          _class: string
          _logical: string
          _reference_limit: number
          _valid_from: string
          _valid_until: string
        }
        Returns: string
      }
      record_class_episode_ending: {
        Args: {
          _act_ref: string
          _ended_on: string
          _episode: string
          _reason: string
        }
        Returns: string
      }
      record_class_journey_version: {
        Args: {
          _change_kind: string
          _class_id: string
          _expected_head_id: string
          _intervals: Json
          _reason: string
          _source_ref: string
          _valid_from: string
          _valid_until: string
        }
        Returns: Json
      }
      record_class_offering_version: {
        Args: {
          _act_ref: string
          _axes: Json
          _base_version_id: string
          _class: string
          _correction_reason: string
          _logical: string
          _valid_from: string
          _valid_until: string
        }
        Returns: string
      }
      record_class_period_organization_version: {
        Args: {
          _act_ref: string
          _base_version_id: string
          _class_id: string
          _operation: string
          _organization_id: string
          _reason: string
          _valid_from: string
          _valid_until: string
        }
        Returns: string
      }
      record_class_schedule_version: {
        Args: {
          _blocks: Json
          _change_kind: string
          _class_id: string
          _expected_head_id: string
          _reason: string
          _source_ref: string
          _valid_from: string
          _valid_until: string
        }
        Returns: Json
      }
      record_class_shift_version: {
        Args: {
          _act_ref: string
          _base_version_id: string
          _class: string
          _correction_reason: string
          _logical: string
          _shift_value: string
          _shift_version: number
          _valid_from: string
          _valid_until: string
        }
        Returns: string
      }
      record_class_specific_matrix_association_version: {
        Args: {
          _association: string
          _base_version_id: string
          _change_kind: string
          _class_id: string
          _reason: string
          _specific_act_ref: string
          _target_column_key: string
          _target_matrix_id: string
          _valid_from: string
          _valid_until: string
        }
        Returns: Json
      }
      record_collegial_deliberation: {
        Args: {
          _document: Json
          _expected_last_event_id: string
          _plan_id: string
          _session_id: string
        }
        Returns: string
      }
      record_collegial_session_event: {
        Args: {
          _document: Json
          _expected_last_event_id: string
          _kind: string
          _plan_id: string
          _session_id: string
        }
        Returns: string
      }
      record_correspondence_profile_version: {
        Args: {
          _act_ref: string
          _applicability_rule: Json
          _base_version_id: string
          _change_kind: string
          _nature_gates: Json
          _nature_scheme_id: string
          _position_key_schemes: string[]
          _profile: string
          _reason: string
          _valid_from: string
          _valid_until: string
        }
        Returns: Json
      }
      record_credential_reset: {
        Args: { _act_ref: string; _actor: string; _user: string }
        Returns: undefined
      }
      record_curricular_matrix_version:
        | {
            Args: {
              _act_ref: string
              _applicability: Json
              _base_version_id: string
              _change_kind: string
              _items: Json
              _matrix: string
              _official_name: string
              _reason: string
              _valid_from: string
              _valid_until: string
            }
            Returns: Json
          }
        | {
            Args: {
              _act_ref: string
              _applicability: Json
              _base_version_id: string
              _change_kind: string
              _items: Json
              _layout: Json
              _matrix: string
              _official_name: string
              _reason: string
              _valid_from: string
              _valid_until: string
            }
            Returns: Json
          }
      record_curricular_reference_edition: {
        Args: {
          _authority: string
          _edition_label: string
          _expected_head: string
          _items: Json
          _published_on: string
          _source_id: string
          _source_label: string
          _source_ref: string
          _source_sha256: string
          _valid_from: string
        }
        Returns: Json
      }
      record_curricular_reference_relation: {
        Args: {
          _confidence: string
          _from: string
          _nature: string
          _provenance: string
          _reason: string
          _revokes: string
          _to: string
        }
        Returns: string
      }
      record_curricular_reference_simplification: {
        Args: {
          _expected_head: string
          _item: string
          _reason: string
          _text: string
        }
        Returns: string
      }
      record_cycle_closing: {
        Args: {
          _class: string
          _cycle: string
          _expected_closing_id: string
          _justification: string
          _operation: string
          _plan_id: string
          _policy_id: string
          _policy_version: number
          _snapshot: Json
        }
        Returns: string
      }
      record_cycle_enrollment_ending: {
        Args: {
          _act_ref: string
          _annul?: boolean
          _base_version_id: string
          _bond_status_value: string
          _bond_status_version: number
          _correction_reason: string
          _ended_on: string
          _enrollment_logical: string
          _reason: string
        }
        Returns: string
      }
      record_engagement: {
        Args: {
          _act_ref: string
          _class_ids: string[]
          _component: string
          _kind: string
          _period: string
          _person: string
          _position_label: string
          _school: string
          _scope_level: string
          _valid_from: string
          _valid_until: string
        }
        Returns: string
      }
      record_functional_event: {
        Args: {
          _act_ref: string
          _base: string
          _correction_reason: string
          _kind: string
          _kind_version: number
          _link_logical: string
          _logical: string
          _occurred_on: string
          _posting_logical: string
          _school: string
        }
        Returns: string
      }
      record_functional_link_version: {
        Args: {
          _act_ref: string
          _authorizing_school: string
          _base: string
          _correction_reason: string
          _logical: string
          _nature: string
          _nature_version: number
          _person: string
          _position: string
          _position_version: number
          _registration: string
          _valid_from: string
          _valid_until: string
        }
        Returns: string
      }
      record_import_event: {
        Args: {
          _batch_id: string
          _canonical_ref: string
          _detail: string
          _kind: string
          _row_id: string
        }
        Returns: Json
      }
      record_institutional_class_version: {
        Args: {
          _act_ref: string
          _administrative_status: string
          _base_version_id: string
          _class_id: string
          _code: string
          _name: string
          _operation: string
          _reason: string
          _valid_from: string
          _valid_until: string
        }
        Returns: string
      }
      record_lesson_version: {
        Args: {
          _assignment: string
          _base_version_id: string
          _changed_aspects: string[]
          _class: string
          _component: string
          _date: string
          _facts: Json
          _justification: string
          _logical: string
          _plan_id: string
        }
        Returns: string
      }
      record_map_conference: {
        Args: { _actor: string; _fingerprint: string; _map: string }
        Returns: string
      }
      record_map_observations: {
        Args: { _map: string; _text: string }
        Returns: string
      }
      record_movement_type_definition: {
        Args: {
          _act_ref: string
          _base_version: number
          _id: string
          _label: string
          _status: string
          _valid_from: string
        }
        Returns: number
      }
      record_own_password_change: { Args: never; Returns: undefined }
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
      record_position_matrix_correspondence_version: {
        Args: {
          _act_ref: string
          _base_version_id: string
          _change_kind: string
          _correspondence: string
          _keys: Json
          _profile_id: string
          _reason: string
          _target_column_key: string
          _target_matrix_id: string
          _valid_from: string
          _valid_until: string
        }
        Returns: Json
      }
      record_posting_version: {
        Args: {
          _act_ref: string
          _base: string
          _correction_reason: string
          _function: string
          _function_version: number
          _link_logical: string
          _logical: string
          _school: string
          _status: string
          _status_version: number
          _valid_from: string
          _valid_until: string
        }
        Returns: string
      }
      record_school_document_template_version: {
        Args: {
          _blocks: Json
          _document_kind: string
          _expected_head_id: string
          _identity: Json
          _numbering: Json
          _public_fields: string[]
          _reason: string
          _source_ref: string
          _template_id: string
          _title: string
        }
        Returns: Json
      }
      record_school_enrollment_ending: {
        Args: {
          _act_ref: string
          _bond_status: string
          _ended_on: string
          _enrollment: string
          _reason: string
        }
        Returns: string
      }
      record_school_link: {
        Args: {
          _act_ref: string
          _base: string
          _correction_reason: string
          _kind: string
          _kind_version: number
          _linked: string
          _logical: string
          _principal: string
          _valid_from: string
          _valid_until: string
        }
        Returns: string
      }
      record_student_identity_version: {
        Args: {
          _act_ref: string
          _base_version_id: string
          _birth_date: string
          _civil_name: string
          _correction_reason: string
          _sex_value: string
          _sex_version: number
          _social_name: string
          _student: string
        }
        Returns: string
      }
      record_student_movement: {
        Args: {
          _act_ref: string
          _base_version_id: string
          _correction_reason: string
          _destination: Json
          _effective_on: string
          _enrollment: string
          _logical: string
          _origin: Json
          _reason_code: string
          _reason_text: string
          _student: string
          _type: string
          _type_version: number
        }
        Returns: string
      }
      record_teaching_assignment_version: {
        Args: {
          _assignment_id: string
          _change_kind: string
          _class_id: string
          _engagement_id: string
          _expected_head_id: string
          _item_key: string
          _matrix_version_id: string
          _reason: string
          _role_scheme_id: string
          _role_value_id: string
          _role_value_version: number
          _source_ref: string
          _valid_from: string
          _valid_until: string
        }
        Returns: Json
      }
      record_visit_version: {
        Args: {
          _act_ref: string
          _additional: Json
          _annul: boolean
          _base: string
          _correction_reason: string
          _identification: string
          _kind: string
          _kind_version: number
          _logical: string
          _origin: string
          _school: string
          _visited_on: string
        }
        Returns: string
      }
      reference_grant: { Args: never; Returns: string }
      register_academic_period_version: {
        Args: {
          _act_ref: string
          _base_version_id: string
          _ends_on: string
          _is_active: boolean
          _official_name: string
          _organization: string
          _period: string
          _reason: string
          _starts_on: string
          _valid_from: string
        }
        Returns: string
      }
      register_academic_standings: {
        Args: {
          _class: string
          _cycle: string
          _operations: Json
          _plan_id: string
        }
        Returns: string
      }
      register_academic_year_version: {
        Args: {
          _act_ref: string
          _base_version_id: string
          _ends_on: string
          _is_active: boolean
          _official_name: string
          _reason: string
          _starts_on: string
          _valid_from: string
          _year: string
        }
        Returns: string
      }
      register_assessment_norm_version: {
        Args: {
          _academic_year_id: string
          _class_ids: string[]
          _definition: Json
          _expected_supersedes_id: string
          _homologation_act_ref: string
          _logical_id: string
          _norm_kind: string
          _stage_ids: string[]
          _valid_from: string
          _valid_until: string
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
      register_capability_policy_draft: {
        Args: { _logical: string; _rules: Json; _supersedes: string }
        Returns: string
      }
      register_class_enrollment_episode: {
        Args: {
          _act_ref: string
          _class: string
          _correction_reason: string
          _enrollment: string
          _id: string
          _supersedes: string
          _valid_from: string
        }
        Returns: string
      }
      register_curricular_component_version: {
        Args: {
          _act_ref: string
          _base_version_id: string
          _component: string
          _is_active: boolean
          _official_name: string
          _reason: string
          _short_name: string
          _valid_from: string
        }
        Returns: string
      }
      register_infant_experience: {
        Args: {
          _assignment: string
          _base_version_id: string
          _class: string
          _component: string
          _date: string
          _justification: string
          _lesson_facts: Json
          _lesson_logical: string
          _logical: string
          _plan_id: string
          _record: Json
        }
        Returns: string
      }
      register_institutional_class: {
        Args: {
          _academic_year_id: string
          _act_ref: string
          _administrative_status: string
          _code: string
          _name: string
          _school_id: string
          _valid_from: string
          _valid_until: string
        }
        Returns: string
      }
      register_period_organization_version: {
        Args: {
          _act_ref: string
          _base_version_id: string
          _is_active: boolean
          _official_name: string
          _organization: string
          _reason: string
          _valid_from: string
          _year: string
        }
        Returns: string
      }
      register_person: {
        Args: { _display_name: string; _identifier: string }
        Returns: string
      }
      register_school_enrollment: {
        Args: {
          _act_ref: string
          _correction_reason: string
          _cycle: string
          _id: string
          _institutional_number: string
          _opened_on: string
          _school: string
          _student: string
          _supersedes: string
        }
        Returns: string
      }
      register_school_record_version: {
        Args: {
          _act_ref: string
          _active: boolean
          _address: string
          _base_version_id: string
          _classroom_count?: number
          _district: string
          _email?: string
          _hard_access?: boolean
          _inep: string
          _justification: string
          _location_kind: string
          _network_code: string
          _official_name: string
          _own_building?: boolean
          _phone?: string
          _school: string
          _valid_from: string
        }
        Returns: string
      }
      register_student: {
        Args: {
          _act_ref: string
          _birth_date: string
          _civil_name: string
          _identifiers: Json
          _sex_value: string
          _sex_version: number
          _social_name: string
        }
        Returns: string
      }
      require_catalog: {
        Args: { _on: string; _scheme: string; _value: string; _version: number }
        Returns: undefined
      }
      resolve_class_specific_matrix_association_at: {
        Args: { _class_id: string; _known_at: string; _on: string }
        Returns: {
          association_id: string
          association_state: string
          homologation_id: string
          matrix_homologation_id: string
          matrix_version_id: string
          target_column_key: string
          target_matrix_id: string
          version_id: string
        }[]
      }
      resolve_position_matrix_correspondence_at: {
        Args: {
          _known_at: string
          _on: string
          _position_key: Json
          _profile_id: string
        }
        Returns: {
          column_state: string
          correspondence_id: string
          homologation_id: string
          matrix_version_id: string
          target_column_key: string
          target_matrix_id: string
          version_id: string
        }[]
      }
      save_network_calendar: {
        Args: {
          _expected_base_version_id: string
          _payload: Json
          _source_key: string
        }
        Returns: Json
      }
      school_capability_grant: {
        Args: { _capability: string; _school: string }
        Returns: {
          engagement_id: string
          policy_id: string
          policy_version: number
        }[]
      }
      school_document_capabilities: { Args: never; Returns: string[] }
      school_document_grant: {
        Args: { _capability: string; _school: string }
        Returns: string
      }
      school_document_public_field_forbidden: {
        Args: { _key: string }
        Returns: boolean
      }
      school_document_templates_list: {
        Args: never
        Returns: {
          blocks: Json
          change_reason: string
          document_kind: string
          identity: Json
          numbering: Json
          public_fields: string[]
          recorded_at: string
          source_ref: string
          supersedes_id: string
          template_id: string
          title: string
          version_id: string
          version_no: number
        }[]
      }
      school_engagements_of_kinds: {
        Args: { _kinds: string[]; _on: string; _school: string }
        Returns: {
          engagement_id: string
          engagement_kind_id: string
          originating_act_ref: string
          person_id: string
          person_name: string
          valid_from: string
          valid_until: string
        }[]
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
      sigem_administrative_capabilities: { Args: never; Returns: string[] }
      sigem_designated_installer_email: { Args: never; Returns: string }
      sigem_general_admin_coverage_issues: {
        Args: { _policy: string }
        Returns: {
          capability_id: string
          issue: string
        }[]
      }
      sigem_general_admin_kind: { Args: never; Returns: string }
      sigem_policy_fingerprint: {
        Args: { _policy_id: string }
        Returns: string
      }
      stage_import_batch: {
        Args: {
          _adapter_id: string
          _adapter_version: number
          _reprocesses_id: string
          _rows: Json
          _source_name: string
          _source_ref: string
          _source_sha256: string
        }
        Returns: Json
      }
      student_curricular_matrix_at: {
        Args: {
          _class_id: string
          _known_at: string
          _on: string
          _school: string
        }
        Returns: {
          allocation_id: string
          allocation_logical_id: string
          association_id: string
          association_state: string
          association_version_id: string
          class_id: string
          column_key: string
          context_state: string
          correspondence_homologation_id: string
          correspondence_id: string
          correspondence_version_id: string
          gate_effect: string
          matrix_homologation_id: string
          matrix_id: string
          matrix_version_id: string
          nature_scheme_id: string
          nature_value_id: string
          nature_value_version: number
          offering_version_id: string
          position_version_id: string
          profile_homologation_id: string
          profile_id: string
          profile_version_id: string
          resolution_state: string
          student_id: string
        }[]
      }
      student_document_emissions: {
        Args: { _school_id: string; _student_id: string }
        Returns: {
          context: Json
          document_kind: string
          emission_kind: string
          emission_number: string
          emitted_at: string
          emitted_by_person: string
          event_kind: string
          event_reason: string
          event_recorded_at: string
          id: string
          replacement_emission_id: string
          reproduces_id: string
          retifies_id: string
          snapshot: Json
          snapshot_sha256: string
          template_version_id: string
          verification_code: string
        }[]
      }
      student_identity_authority: {
        Args: { _cap: string; _student: string }
        Returns: string
      }
      student_movements_known: {
        Args: { _known_at?: string; _school: string }
        Returns: {
          correction_reason: string | null
          created_at: string
          destination: Json | null
          effective_on: string | null
          enrollment_id: string | null
          id: string
          logical_id: string
          movement_type_id: string
          movement_type_version: number
          origin: Json | null
          originating_act_ref: string | null
          reason_code: string | null
          reason_text: string | null
          recorded_by: string
          school_scope_ids: string[]
          student_id: string
          supersedes_id: string | null
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "student_movement_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      teaching_assignment_effective_versions: {
        Args: { _known_at: string }
        Returns: {
          assignment_id: string
          effective_from: string
          effective_until: string
          version_id: string
        }[]
      }
      teaching_assignment_grant: { Args: { _school: string }; Returns: string }
      teaching_assignments_at: {
        Args: { _class_id: string; _known_at: string; _on: string }
        Returns: {
          assignment_id: string
          assignment_state: string
          change_kind: string
          change_reason: string
          co_assigned_engagement_ids: string[]
          component_id: string
          component_label_snapshot: string
          effective_from: string
          effective_until: string
          element_scheme_id: string
          element_value_id: string
          element_value_version: number
          engagement_id: string
          item_key: string
          matrix_id: string
          matrix_version_id: string
          person_id: string
          recorded_at: string
          role_scheme_id: string
          role_value_id: string
          role_value_version: number
          source_ref: string
          version: number
          version_id: string
        }[]
      }
      verify_school_document: { Args: { _code: string }; Returns: Json }
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
