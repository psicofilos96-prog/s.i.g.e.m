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
      attendance_calculation_policies: {
        Row: {
          created_at: string
          definition: Json
          homologated_at: string | null
          homologation_act_ref: string | null
          id: string
          status: string
          version: number
        }
        Insert: {
          created_at?: string
          definition: Json
          homologated_at?: string | null
          homologation_act_ref?: string | null
          id: string
          status?: string
          version: number
        }
        Update: {
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
      apply_assessment_instrument: {
        Args: { _expected_last_event_id: string; _instrument: string }
        Returns: string
      }
      assessment_value_problem: { Args: { _v: Json }; Returns: string }
      attendance_closing_covering: {
        Args: { _class: string; _lesson_logical: string }
        Returns: string
      }
      can_read_attendance_closing: {
        Args: { _class: string; _period: string }
        Returns: boolean
      }
      can_read_closing: {
        Args: { _class: string; _period: string }
        Returns: boolean
      }
      can_read_collegial: { Args: { _class: string }; Returns: boolean }
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
      register_academic_standings: {
        Args: {
          _class: string
          _cycle: string
          _operations: Json
          _plan_id: string
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
