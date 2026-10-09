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
      academic_year_operational_states: {
        Row: {
          academic_year_id: string
          created_at: string
          id: string
          reason: string
          recorded_by: string | null
          recorded_by_person_id: string | null
          recorded_via_engagement_id: string | null
          sequence: number
          state: string
          supersedes_id: string | null
          technical_provenance: string | null
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          id?: string
          reason: string
          recorded_by?: string | null
          recorded_by_person_id?: string | null
          recorded_via_engagement_id?: string | null
          sequence: number
          state: string
          supersedes_id?: string | null
          technical_provenance?: string | null
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          id?: string
          reason?: string
          recorded_by?: string | null
          recorded_by_person_id?: string | null
          recorded_via_engagement_id?: string | null
          sequence?: number
          state?: string
          supersedes_id?: string | null
          technical_provenance?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academic_year_operational_states_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "institutional_academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_year_operational_states_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "academic_year_operational_states"
            referencedColumns: ["id"]
          },
        ]
      }
      access_credential_reset_batches: {
        Row: {
          actor_user_id: string
          id: string
          mode: string
          recorded_at: string
          requested_count: number
          succeeded_count: number
        }
        Insert: {
          actor_user_id: string
          id?: string
          mode: string
          recorded_at?: string
          requested_count: number
          succeeded_count: number
        }
        Update: {
          actor_user_id?: string
          id?: string
          mode?: string
          recorded_at?: string
          requested_count?: number
          succeeded_count?: number
        }
        Relationships: []
      }
      access_credential_reset_targets: {
        Row: {
          batch_id: string
          user_id: string
        }
        Insert: {
          batch_id: string
          user_id: string
        }
        Update: {
          batch_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_credential_reset_targets_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "access_credential_reset_batches"
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
      aee_service_slots: {
        Row: {
          ends_at: string
          service_version_id: string
          starts_at: string
          weekday: number
        }
        Insert: {
          ends_at: string
          service_version_id: string
          starts_at: string
          weekday: number
        }
        Update: {
          ends_at?: string
          service_version_id?: string
          starts_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "aee_service_slots_service_version_id_fkey"
            columns: ["service_version_id"]
            isOneToOne: false
            referencedRelation: "aee_services"
            referencedColumns: ["id"]
          },
        ]
      }
      aee_services: {
        Row: {
          author_engagement: string
          author_person_id: string
          author_user_id: string
          event_kind: string
          id: string
          logical_id: string
          origin_kind: string
          reason: string | null
          recorded_at: string
          responsible_engagement_id: string
          school_id: string
          student_id: string
          supersedes_id: string | null
          valid_from: string
          valid_to: string | null
          version: number
        }
        Insert: {
          author_engagement: string
          author_person_id: string
          author_user_id: string
          event_kind: string
          id?: string
          logical_id: string
          origin_kind: string
          reason?: string | null
          recorded_at?: string
          responsible_engagement_id: string
          school_id: string
          student_id: string
          supersedes_id?: string | null
          valid_from: string
          valid_to?: string | null
          version: number
        }
        Update: {
          author_engagement?: string
          author_person_id?: string
          author_user_id?: string
          event_kind?: string
          id?: string
          logical_id?: string
          origin_kind?: string
          reason?: string | null
          recorded_at?: string
          responsible_engagement_id?: string
          school_id?: string
          student_id?: string
          supersedes_id?: string | null
          valid_from?: string
          valid_to?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "aee_services_responsible_engagement_id_fkey"
            columns: ["responsible_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aee_services_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "aee_services"
            referencedColumns: ["id"]
          },
        ]
      }
      aee_sessions: {
        Row: {
          author_engagement: string
          author_person_id: string
          author_user_id: string
          event_kind: string
          id: string
          logical_id: string
          pedagogical_note: string | null
          presence_scheme_id: string
          presence_value_id: string
          presence_value_version: number
          reason: string | null
          recorded_at: string
          school_id: string
          service_logical_id: string
          session_date: string
          student_id: string
          supersedes_id: string | null
          version: number
        }
        Insert: {
          author_engagement: string
          author_person_id: string
          author_user_id: string
          event_kind: string
          id?: string
          logical_id: string
          pedagogical_note?: string | null
          presence_scheme_id: string
          presence_value_id: string
          presence_value_version: number
          reason?: string | null
          recorded_at?: string
          school_id: string
          service_logical_id: string
          session_date: string
          student_id: string
          supersedes_id?: string | null
          version: number
        }
        Update: {
          author_engagement?: string
          author_person_id?: string
          author_user_id?: string
          event_kind?: string
          id?: string
          logical_id?: string
          pedagogical_note?: string | null
          presence_scheme_id?: string
          presence_value_id?: string
          presence_value_version?: number
          reason?: string | null
          recorded_at?: string
          school_id?: string
          service_logical_id?: string
          session_date?: string
          student_id?: string
          supersedes_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "aee_sessions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "aee_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_assisted_actions: {
        Row: {
          confirmed_by: string
          id: string
          outcome: string
          proposal_kind: string
          proposal_sha256: string
          recorded_at: string
          result_ref: string | null
          school_id: string | null
          writer: string | null
        }
        Insert: {
          confirmed_by: string
          id?: string
          outcome: string
          proposal_kind: string
          proposal_sha256: string
          recorded_at?: string
          result_ref?: string | null
          school_id?: string | null
          writer?: string | null
        }
        Update: {
          confirmed_by?: string
          id?: string
          outcome?: string
          proposal_kind?: string
          proposal_sha256?: string
          recorded_at?: string
          result_ref?: string | null
          school_id?: string | null
          writer?: string | null
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
      assessment_analysis_definitions: {
        Row: {
          algorithm: string
          algorithm_version: string
          author_engagement: string | null
          author_person_id: string | null
          author_principal_id: string | null
          author_user_id: string
          id: string
          input_refs: Json
          kind: string
          logical_id: string
          parameters: Json
          reason: string | null
          recorded_at: string
          supersedes_id: string | null
          version: number
        }
        Insert: {
          algorithm: string
          algorithm_version: string
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id: string
          id?: string
          input_refs: Json
          kind: string
          logical_id: string
          parameters: Json
          reason?: string | null
          recorded_at?: string
          supersedes_id?: string | null
          version: number
        }
        Update: {
          algorithm?: string
          algorithm_version?: string
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id?: string
          id?: string
          input_refs?: Json
          kind?: string
          logical_id?: string
          parameters?: Json
          reason?: string | null
          recorded_at?: string
          supersedes_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "assessment_analysis_definitions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "assessment_analysis_definitions"
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
      assessment_edition_cycle_events: {
        Row: {
          actor_engagement: string | null
          actor_person_id: string | null
          actor_user_id: string
          author_principal_id: string | null
          edition_logical_id: string
          from_state: string | null
          id: string
          note: string | null
          recorded_at: string
          seq: number
          to_state: string
        }
        Insert: {
          actor_engagement?: string | null
          actor_person_id?: string | null
          actor_user_id: string
          author_principal_id?: string | null
          edition_logical_id: string
          from_state?: string | null
          id?: string
          note?: string | null
          recorded_at?: string
          seq: number
          to_state: string
        }
        Update: {
          actor_engagement?: string | null
          actor_person_id?: string | null
          actor_user_id?: string
          author_principal_id?: string | null
          edition_logical_id?: string
          from_state?: string | null
          id?: string
          note?: string | null
          recorded_at?: string
          seq?: number
          to_state?: string
        }
        Relationships: []
      }
      assessment_edition_versions: {
        Row: {
          author_engagement: string | null
          author_person_id: string | null
          author_principal_id: string | null
          author_user_id: string
          cycle_label: string | null
          event_kind: string
          id: string
          instrument_logical_ids: string[]
          label: string
          logical_id: string
          program_logical_id: string
          reason: string | null
          recorded_at: string
          reference_date: string
          reference_edition_id: string | null
          source_note: string | null
          supersedes_id: string | null
          version: number
        }
        Insert: {
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id: string
          cycle_label?: string | null
          event_kind: string
          id?: string
          instrument_logical_ids?: string[]
          label: string
          logical_id: string
          program_logical_id: string
          reason?: string | null
          recorded_at?: string
          reference_date: string
          reference_edition_id?: string | null
          source_note?: string | null
          supersedes_id?: string | null
          version: number
        }
        Update: {
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id?: string
          cycle_label?: string | null
          event_kind?: string
          id?: string
          instrument_logical_ids?: string[]
          label?: string
          logical_id?: string
          program_logical_id?: string
          reason?: string | null
          recorded_at?: string
          reference_date?: string
          reference_edition_id?: string | null
          source_note?: string | null
          supersedes_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "assessment_edition_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "assessment_edition_versions"
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
      assessment_instrument_conferences: {
        Row: {
          author_person_id: string
          author_user_id: string
          authorizing_engagement_id: string | null
          fingerprint: string
          id: string
          instrument_id: string
          preceding_id: string | null
          recorded_at: string
          sequence: number
          snapshot: Json
        }
        Insert: {
          author_person_id: string
          author_user_id: string
          authorizing_engagement_id?: string | null
          fingerprint: string
          id?: string
          instrument_id: string
          preceding_id?: string | null
          recorded_at?: string
          sequence: number
          snapshot: Json
        }
        Update: {
          author_person_id?: string
          author_user_id?: string
          authorizing_engagement_id?: string | null
          fingerprint?: string
          id?: string
          instrument_id?: string
          preceding_id?: string | null
          recorded_at?: string
          sequence?: number
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "assessment_instrument_conferences_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "assessment_instruments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_instrument_conferences_preceding_id_fkey"
            columns: ["preceding_id"]
            isOneToOne: true
            referencedRelation: "assessment_instrument_conferences"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_instrument_status_events: {
        Row: {
          acted_at: string
          applied_on: string | null
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
          applied_on?: string | null
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
          applied_on?: string | null
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
          assignment_id: string | null
          author_person_id: string
          author_user_id: string
          authorizing_engagement_id: string
          capability_policy_id: string
          capability_policy_version: number
          class_id: string
          contract: string | null
          created_at: string
          definition: Json
          id: string
          instrument_type_id: string
          period_id: string
          planned_on: string | null
          reference_item_ids: string[]
        }
        Insert: {
          assignment_id?: string | null
          author_person_id: string
          author_user_id: string
          authorizing_engagement_id: string
          capability_policy_id: string
          capability_policy_version: number
          class_id: string
          contract?: string | null
          created_at?: string
          definition: Json
          id: string
          instrument_type_id: string
          period_id: string
          planned_on?: string | null
          reference_item_ids?: string[]
        }
        Update: {
          assignment_id?: string | null
          author_person_id?: string
          author_user_id?: string
          authorizing_engagement_id?: string
          capability_policy_id?: string
          capability_policy_version?: number
          class_id?: string
          contract?: string | null
          created_at?: string
          definition?: Json
          id?: string
          instrument_type_id?: string
          period_id?: string
          planned_on?: string | null
          reference_item_ids?: string[]
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
      assessment_item_keys: {
        Row: {
          answer: Json
          criteria: string | null
          item_version_id: string
          recorded_at: string
        }
        Insert: {
          answer: Json
          criteria?: string | null
          item_version_id: string
          recorded_at?: string
        }
        Update: {
          answer?: Json
          criteria?: string | null
          item_version_id?: string
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_item_keys_item_version_id_fkey"
            columns: ["item_version_id"]
            isOneToOne: true
            referencedRelation: "assessment_item_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_item_media: {
        Row: {
          author_user_id: string
          content_sha256: string
          id: string
          item_id: string
          label: string
          mime: string
          object_path: string
          recorded_at: string
        }
        Insert: {
          author_user_id: string
          content_sha256: string
          id?: string
          item_id: string
          label: string
          mime: string
          object_path: string
          recorded_at?: string
        }
        Update: {
          author_user_id?: string
          content_sha256?: string
          id?: string
          item_id?: string
          label?: string
          mime?: string
          object_path?: string
          recorded_at?: string
        }
        Relationships: []
      }
      assessment_item_versions: {
        Row: {
          author_user_id: string
          copied_from_version_id: string | null
          curricular_refs: Json
          id: string
          item_id: string
          item_type_id: string
          key_shared: boolean
          options: Json
          recorded_at: string
          school_id: string
          status: string
          stem: string
          supersedes_id: string | null
          version: number
          visibility: string
        }
        Insert: {
          author_user_id: string
          copied_from_version_id?: string | null
          curricular_refs?: Json
          id?: string
          item_id: string
          item_type_id: string
          key_shared?: boolean
          options?: Json
          recorded_at?: string
          school_id: string
          status: string
          stem: string
          supersedes_id?: string | null
          version: number
          visibility: string
        }
        Update: {
          author_user_id?: string
          copied_from_version_id?: string | null
          curricular_refs?: Json
          id?: string
          item_id?: string
          item_type_id?: string
          key_shared?: boolean
          options?: Json
          recorded_at?: string
          school_id?: string
          status?: string
          stem?: string
          supersedes_id?: string | null
          version?: number
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_item_versions_copied_from_version_id_fkey"
            columns: ["copied_from_version_id"]
            isOneToOne: false
            referencedRelation: "assessment_item_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_item_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "assessment_item_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_metric_comparability: {
        Row: {
          author_engagement: string | null
          author_person_id: string | null
          author_principal_id: string | null
          author_user_id: string
          id: string
          logical_id: string
          metric_a: string
          metric_b: string
          reason: string | null
          recorded_at: string
          source_note: string
          status: string
          supersedes_id: string | null
          version: number
        }
        Insert: {
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id: string
          id?: string
          logical_id: string
          metric_a: string
          metric_b: string
          reason?: string | null
          recorded_at?: string
          source_note: string
          status: string
          supersedes_id?: string | null
          version: number
        }
        Update: {
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id?: string
          id?: string
          logical_id?: string
          metric_a?: string
          metric_b?: string
          reason?: string | null
          recorded_at?: string
          source_note?: string
          status?: string
          supersedes_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "assessment_metric_comparability_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "assessment_metric_comparability"
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
      assessment_program_versions: {
        Row: {
          application_responsibility: string
          author_engagement: string | null
          author_person_id: string | null
          author_principal_id: string | null
          author_user_id: string
          correction_responsibility: string
          event_kind: string
          id: string
          logical_id: string
          name: string
          origin_kind: string
          reason: string | null
          recorded_at: string
          result_delivery: string
          source_note: string | null
          supersedes_id: string | null
          version: number
        }
        Insert: {
          application_responsibility: string
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id: string
          correction_responsibility: string
          event_kind: string
          id?: string
          logical_id: string
          name: string
          origin_kind: string
          reason?: string | null
          recorded_at?: string
          result_delivery: string
          source_note?: string | null
          supersedes_id?: string | null
          version: number
        }
        Update: {
          application_responsibility?: string
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id?: string
          correction_responsibility?: string
          event_kind?: string
          id?: string
          logical_id?: string
          name?: string
          origin_kind?: string
          reason?: string | null
          recorded_at?: string
          result_delivery?: string
          source_note?: string | null
          supersedes_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "assessment_program_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "assessment_program_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_result_officializations: {
        Row: {
          author_person_id: string
          author_user_id: string
          authorizing_engagement_id: string
          capability_policy_id: string
          capability_policy_version: number
          conference_id: string
          fingerprint: string
          id: string
          instrument_id: string
          preceding_id: string | null
          recorded_at: string
          sequence: number
        }
        Insert: {
          author_person_id: string
          author_user_id: string
          authorizing_engagement_id: string
          capability_policy_id: string
          capability_policy_version: number
          conference_id: string
          fingerprint: string
          id?: string
          instrument_id: string
          preceding_id?: string | null
          recorded_at?: string
          sequence: number
        }
        Update: {
          author_person_id?: string
          author_user_id?: string
          authorizing_engagement_id?: string
          capability_policy_id?: string
          capability_policy_version?: number
          conference_id?: string
          fingerprint?: string
          id?: string
          instrument_id?: string
          preceding_id?: string | null
          recorded_at?: string
          sequence?: number
        }
        Relationships: [
          {
            foreignKeyName: "assessment_result_officializations_conference_id_fkey"
            columns: ["conference_id"]
            isOneToOne: false
            referencedRelation: "assessment_instrument_conferences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_result_officializations_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "assessment_instruments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_result_officializations_preceding_id_fkey"
            columns: ["preceding_id"]
            isOneToOne: true
            referencedRelation: "assessment_result_officializations"
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
          attendance_effect: string | null
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
          attendance_effect?: string | null
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
          attendance_effect?: string | null
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
          diary_contract: string | null
          eligible_student_ids: string[] | null
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
          diary_contract?: string | null
          eligible_student_ids?: string[] | null
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
          diary_contract?: string | null
          eligible_student_ids?: string[] | null
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
      bo_fixture_accounts: {
        Row: {
          created_at: string
          engagement_id: string | null
          engagement_kind_id: string | null
          operation_id: string
          person_id: string
          source_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          engagement_id?: string | null
          engagement_kind_id?: string | null
          operation_id: string
          person_id: string
          source_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          engagement_id?: string | null
          engagement_kind_id?: string | null
          operation_id?: string
          person_id?: string
          source_hash?: string
          user_id?: string
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
          homologation_act_ref: string | null
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
          homologation_act_ref?: string | null
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
          homologation_act_ref?: string | null
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
          originating_act_ref: string | null
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
          originating_act_ref?: string | null
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
          originating_act_ref?: string | null
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
          originating_act_ref: string | null
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
          originating_act_ref?: string | null
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
          originating_act_ref?: string | null
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
      calendar_external_presentation_revisions: {
        Row: {
          base_revision_id: string | null
          calendar_id: string
          created_at: string
          id: string
          profile: Json
          profile_digest: string
          reason: string | null
          recorded_by: string
          recorded_via_engagement_id: string
          revision: number
          template_code: string
        }
        Insert: {
          base_revision_id?: string | null
          calendar_id: string
          created_at?: string
          id?: string
          profile: Json
          profile_digest: string
          reason?: string | null
          recorded_by: string
          recorded_via_engagement_id: string
          revision: number
          template_code: string
        }
        Update: {
          base_revision_id?: string | null
          calendar_id?: string
          created_at?: string
          id?: string
          profile?: Json
          profile_digest?: string
          reason?: string | null
          recorded_by?: string
          recorded_via_engagement_id?: string
          revision?: number
          template_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_external_presentation_revisions_base_revision_id_fkey"
            columns: ["base_revision_id"]
            isOneToOne: false
            referencedRelation: "calendar_external_presentation_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_external_preset_versions: {
        Row: {
          archived: boolean
          id: string
          idempotency_key: string
          name: string
          owner_id: string
          preset_key: string
          profile: Json
          recorded_at: string
          template_code: string
          version: number
        }
        Insert: {
          archived?: boolean
          id?: string
          idempotency_key: string
          name: string
          owner_id?: string
          preset_key: string
          profile: Json
          recorded_at?: string
          template_code: string
          version?: number
        }
        Update: {
          archived?: boolean
          id?: string
          idempotency_key?: string
          name?: string
          owner_id?: string
          preset_key?: string
          profile?: Json
          recorded_at?: string
          template_code?: string
          version?: number
        }
        Relationships: []
      }
      calendar_external_profile_revisions: {
        Row: {
          base_revision_id: string | null
          calendar_id: string
          created_at: string
          id: string
          profile: Json
          profile_digest: string
          reason: string | null
          recorded_by: string
          recorded_via_engagement_id: string
          revision: number
          template_code: string
        }
        Insert: {
          base_revision_id?: string | null
          calendar_id: string
          created_at?: string
          id?: string
          profile: Json
          profile_digest: string
          reason?: string | null
          recorded_by: string
          recorded_via_engagement_id: string
          revision: number
          template_code: string
        }
        Update: {
          base_revision_id?: string | null
          calendar_id?: string
          created_at?: string
          id?: string
          profile?: Json
          profile_digest?: string
          reason?: string | null
          recorded_by?: string
          recorded_via_engagement_id?: string
          revision?: number
          template_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_external_profile_revisions_base_revision_id_fkey"
            columns: ["base_revision_id"]
            isOneToOne: false
            referencedRelation: "calendar_external_profile_revisions"
            referencedColumns: ["id"]
          },
        ]
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
          act_ref: string | null
          created_at: string
          declares_none: boolean
          recorded_by: string
          recorded_by_person_id: string
          recorded_via_engagement_id: string
          version_id: string
        }
        Insert: {
          act_ref?: string | null
          created_at?: string
          declares_none: boolean
          recorded_by: string
          recorded_by_person_id: string
          recorded_via_engagement_id: string
          version_id: string
        }
        Update: {
          act_ref?: string | null
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
          calendar_version_id: string
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
          calendar_version_id?: string
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
          originating_act_ref: string | null
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
          originating_act_ref?: string | null
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
          originating_act_ref?: string | null
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
          created_by: string | null
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
          created_by?: string | null
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
          created_by?: string | null
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
      census_cycle_events: {
        Row: {
          created_at: string
          cycle_id: string
          fingerprint: string | null
          person: string
          reason: string
          seq: number
          snapshot_id: string | null
          stage: string
          user_id: string
        }
        Insert: {
          created_at?: string
          cycle_id: string
          fingerprint?: string | null
          person: string
          reason: string
          seq: number
          snapshot_id?: string | null
          stage: string
          user_id: string
        }
        Update: {
          created_at?: string
          cycle_id?: string
          fingerprint?: string | null
          person?: string
          reason?: string
          seq?: number
          snapshot_id?: string | null
          stage?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "census_cycle_events_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "census_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "census_cycle_events_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "census_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      census_cycles: {
        Row: {
          academic_year_id: string
          created_at: string
          id: string
          nature: string
          opened_by_person: string
          opened_by_user: string
          reason: string
          reference_date: string
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          id: string
          nature: string
          opened_by_person: string
          opened_by_user: string
          reason: string
          reference_date: string
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          id?: string
          nature?: string
          opened_by_person?: string
          opened_by_user?: string
          reason?: string
          reference_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "census_cycles_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: true
            referencedRelation: "institutional_academic_years"
            referencedColumns: ["id"]
          },
        ]
      }
      census_official_panel_snapshots: {
        Row: {
          census_year: string
          content_sha256: string
          id: string
          measures: Json
          panel_updated_at: string
          recorded_at: string
          scope_kind: string
          scope_ref: string
          source_ref: string
          source_sha256: string
          technical_operation_id: string
        }
        Insert: {
          census_year: string
          content_sha256: string
          id?: string
          measures: Json
          panel_updated_at: string
          recorded_at?: string
          scope_kind: string
          scope_ref: string
          source_ref: string
          source_sha256: string
          technical_operation_id: string
        }
        Update: {
          census_year?: string
          content_sha256?: string
          id?: string
          measures?: Json
          panel_updated_at?: string
          recorded_at?: string
          scope_kind?: string
          scope_ref?: string
          source_ref?: string
          source_sha256?: string
          technical_operation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "census_official_panel_snapshots_technical_operation_id_fkey"
            columns: ["technical_operation_id"]
            isOneToOne: false
            referencedRelation: "technical_execution_operations"
            referencedColumns: ["id"]
          },
        ]
      }
      census_official_receipt_snapshots: {
        Row: {
          census_year: string
          closed_at: string | null
          content_sha256: string
          id: string
          inep: string
          issued_at: string
          measures: Json
          receipt_code_sha256: string | null
          recorded_at: string
          school_declared: Json
          school_id: string
          source_locator: string
          source_ref: string
          source_sha256: string
          supersedes_id: string | null
          technical_operation_id: string
          version: number
        }
        Insert: {
          census_year: string
          closed_at?: string | null
          content_sha256: string
          id?: string
          inep: string
          issued_at: string
          measures: Json
          receipt_code_sha256?: string | null
          recorded_at?: string
          school_declared: Json
          school_id: string
          source_locator: string
          source_ref: string
          source_sha256: string
          supersedes_id?: string | null
          technical_operation_id: string
          version: number
        }
        Update: {
          census_year?: string
          closed_at?: string | null
          content_sha256?: string
          id?: string
          inep?: string
          issued_at?: string
          measures?: Json
          receipt_code_sha256?: string | null
          recorded_at?: string
          school_declared?: Json
          school_id?: string
          source_locator?: string
          source_ref?: string
          source_sha256?: string
          supersedes_id?: string | null
          technical_operation_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "census_official_receipt_snapshots_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "census_official_receipt_snapshots_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "census_official_receipt_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "census_official_receipt_snapshots_technical_operation_id_fkey"
            columns: ["technical_operation_id"]
            isOneToOne: false
            referencedRelation: "technical_execution_operations"
            referencedColumns: ["id"]
          },
        ]
      }
      census_snapshot_conferences: {
        Row: {
          created_at: string
          fingerprint: string
          id: string
          note: string | null
          person: string
          snapshot_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fingerprint: string
          id?: string
          note?: string | null
          person: string
          snapshot_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          fingerprint?: string
          id?: string
          note?: string | null
          person?: string
          snapshot_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "census_snapshot_conferences_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "census_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      census_snapshots: {
        Row: {
          author_person: string
          author_user: string
          content: Json
          created_at: string
          cycle_id: string
          fingerprint: string
          id: string
          reason: string | null
          reference_date: string
          rule_set: string
          supersedes_id: string | null
          version: number
        }
        Insert: {
          author_person: string
          author_user: string
          content: Json
          created_at?: string
          cycle_id: string
          fingerprint: string
          id?: string
          reason?: string | null
          reference_date: string
          rule_set: string
          supersedes_id?: string | null
          version: number
        }
        Update: {
          author_person?: string
          author_user?: string
          content?: Json
          created_at?: string
          cycle_id?: string
          fingerprint?: string
          id?: string
          reason?: string | null
          reference_date?: string
          rule_set?: string
          supersedes_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "census_snapshots_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "census_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "census_snapshots_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "census_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      census_source_imports: {
        Row: {
          accepted: Json
          created_at: string
          cycle_id: string
          edition_layout: string
          id: string
          operator_person: string
          operator_user: string
          origin: string
          parser_id: string
          parser_version: number
          rejections: Json
          source_sha256: string
          staged_sha256: string
        }
        Insert: {
          accepted: Json
          created_at?: string
          cycle_id: string
          edition_layout: string
          id?: string
          operator_person: string
          operator_user: string
          origin: string
          parser_id: string
          parser_version: number
          rejections: Json
          source_sha256: string
          staged_sha256: string
        }
        Update: {
          accepted?: Json
          created_at?: string
          cycle_id?: string
          edition_layout?: string
          id?: string
          operator_person?: string
          operator_user?: string
          origin?: string
          parser_id?: string
          parser_version?: number
          rejections?: Json
          source_sha256?: string
          staged_sha256?: string
        }
        Relationships: [
          {
            foreignKeyName: "census_source_imports_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "census_cycles"
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
      class_census_declarations: {
        Row: {
          class_id: string
          field: string
          id: string
          known_at: string
          source_hash: string
          source_locator: string | null
          source_ref: string
          technical_operation_id: string | null
          valid_from: string
          value_text: string
        }
        Insert: {
          class_id: string
          field: string
          id?: string
          known_at?: string
          source_hash: string
          source_locator?: string | null
          source_ref: string
          technical_operation_id?: string | null
          valid_from: string
          value_text: string
        }
        Update: {
          class_id?: string
          field?: string
          id?: string
          known_at?: string
          source_hash?: string
          source_locator?: string | null
          source_ref?: string
          technical_operation_id?: string | null
          valid_from?: string
          value_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_census_declarations_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "institutional_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_census_declarations_technical_operation_id_fkey"
            columns: ["technical_operation_id"]
            isOneToOne: false
            referencedRelation: "technical_execution_operations"
            referencedColumns: ["id"]
          },
        ]
      }
      class_composition_positions: {
        Row: {
          composition_version_id: string
          scheme_id: string
          value_id: string
          value_version: number
        }
        Insert: {
          composition_version_id: string
          scheme_id: string
          value_id: string
          value_version: number
        }
        Update: {
          composition_version_id?: string
          scheme_id?: string
          value_id?: string
          value_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_composition_positions_composition_version_id_fkey"
            columns: ["composition_version_id"]
            isOneToOne: false
            referencedRelation: "class_composition_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      class_composition_versions: {
        Row: {
          author_actor_kind: string
          author_person_id: string | null
          author_principal_id: string | null
          change_reason: string | null
          class_id: string
          created_at: string
          id: string
          recorded_by: string
          supersedes_id: string | null
          valid_from: string
          valid_until: string | null
          version: number
        }
        Insert: {
          author_actor_kind: string
          author_person_id?: string | null
          author_principal_id?: string | null
          change_reason?: string | null
          class_id: string
          created_at?: string
          id?: string
          recorded_by: string
          supersedes_id?: string | null
          valid_from: string
          valid_until?: string | null
          version: number
        }
        Update: {
          author_actor_kind?: string
          author_person_id?: string | null
          author_principal_id?: string | null
          change_reason?: string | null
          class_id?: string
          created_at?: string
          id?: string
          recorded_by?: string
          supersedes_id?: string | null
          valid_from?: string
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_composition_versions_author_person_id_fkey"
            columns: ["author_person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_composition_versions_author_principal_id_fkey"
            columns: ["author_principal_id"]
            isOneToOne: false
            referencedRelation: "institutional_sector_principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_composition_versions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "institutional_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_composition_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "class_composition_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      class_designation_category_versions: {
        Row: {
          category_id: string
          class_id: string
          created_at: string
          id: string
          reason: string
          recorded_by: string
          recorded_by_person_id: string
          recorded_via_engagement_id: string
          sequence: number
          supersedes_id: string | null
        }
        Insert: {
          category_id: string
          class_id: string
          created_at?: string
          id?: string
          reason: string
          recorded_by: string
          recorded_by_person_id: string
          recorded_via_engagement_id: string
          sequence: number
          supersedes_id?: string | null
        }
        Update: {
          category_id?: string
          class_id?: string
          created_at?: string
          id?: string
          reason?: string
          recorded_by?: string
          recorded_by_person_id?: string
          recorded_via_engagement_id?: string
          sequence?: number
          supersedes_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_designation_category_versions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "institutional_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_designation_category_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "class_designation_category_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      class_designation_policy_homologations: {
        Row: {
          created_at: string
          homologated_by: string
          homologated_by_person_id: string
          id: string
          policy_version_id: string
          reason: string
        }
        Insert: {
          created_at?: string
          homologated_by: string
          homologated_by_person_id: string
          id?: string
          policy_version_id: string
          reason: string
        }
        Update: {
          created_at?: string
          homologated_by?: string
          homologated_by_person_id?: string
          id?: string
          policy_version_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_designation_policy_homologations_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: true
            referencedRelation: "class_designation_policy_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      class_designation_policy_versions: {
        Row: {
          created_at: string
          criterion_params: Json
          criterion_type: string
          drafted_by: string
          drafted_by_person_id: string
          id: string
          policy_key: string
          provenance_note: string | null
          supersedes_id: string | null
          valid_from: string
          valid_until: string | null
          version: number
        }
        Insert: {
          created_at?: string
          criterion_params: Json
          criterion_type: string
          drafted_by: string
          drafted_by_person_id: string
          id?: string
          policy_key: string
          provenance_note?: string | null
          supersedes_id?: string | null
          valid_from: string
          valid_until?: string | null
          version: number
        }
        Update: {
          created_at?: string
          criterion_params?: Json
          criterion_type?: string
          drafted_by?: string
          drafted_by_person_id?: string
          id?: string
          policy_key?: string
          provenance_note?: string | null
          supersedes_id?: string | null
          valid_from?: string
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_designation_policy_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "class_designation_policy_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      class_designation_reservations: {
        Row: {
          academic_year_id: string
          category_id: string
          class_id: string
          class_sequence: number
          created_at: string
          designation: string
          id: string
          ordinal: number
          policy_version_id: string
          reason: string
          recorded_by: string
          recorded_by_person_id: string
          recorded_via_engagement_id: string
          school_id: string
        }
        Insert: {
          academic_year_id: string
          category_id: string
          class_id: string
          class_sequence: number
          created_at?: string
          designation: string
          id?: string
          ordinal: number
          policy_version_id: string
          reason: string
          recorded_by: string
          recorded_by_person_id: string
          recorded_via_engagement_id: string
          school_id: string
        }
        Update: {
          academic_year_id?: string
          category_id?: string
          class_id?: string
          class_sequence?: number
          created_at?: string
          designation?: string
          id?: string
          ordinal?: number
          policy_version_id?: string
          reason?: string
          recorded_by?: string
          recorded_by_person_id?: string
          recorded_via_engagement_id?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_designation_reservations_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "institutional_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_designation_reservations_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "class_designation_policy_versions"
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
          recorded_by_principal_id: string | null
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
          recorded_by_principal_id?: string | null
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
          recorded_by_principal_id?: string | null
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
            foreignKeyName: "class_journey_versions_recorded_by_principal_id_fkey"
            columns: ["recorded_by_principal_id"]
            isOneToOne: false
            referencedRelation: "institutional_sector_principals"
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
          item_key: string | null
          matrix_version_id: string | null
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
          item_key?: string | null
          matrix_version_id?: string | null
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
          item_key?: string | null
          matrix_version_id?: string | null
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
            foreignKeyName: "class_schedule_blocks_matrix_version_id_fkey"
            columns: ["matrix_version_id"]
            isOneToOne: false
            referencedRelation: "curricular_matrix_versions"
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
      class_source_observations: {
        Row: {
          class_id: string
          id: string
          known_at: string
          recorded_at: string
          source_hash: string
          source_locator: string | null
          source_ref: string
          technical_operation_id: string
        }
        Insert: {
          class_id: string
          id?: string
          known_at: string
          recorded_at?: string
          source_hash: string
          source_locator?: string | null
          source_ref: string
          technical_operation_id: string
        }
        Update: {
          class_id?: string
          id?: string
          known_at?: string
          recorded_at?: string
          source_hash?: string
          source_locator?: string | null
          source_ref?: string
          technical_operation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_source_observations_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "institutional_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_source_observations_technical_operation_id_fkey"
            columns: ["technical_operation_id"]
            isOneToOne: false
            referencedRelation: "technical_execution_operations"
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
          originating_act_ref: string | null
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
          originating_act_ref?: string | null
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
          originating_act_ref?: string | null
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
      curricular_reference_correspondence_assessments: {
        Row: {
          conclusion: string
          criteria: Json
          id: string
          item_id: string
          justification: string
          reason: string | null
          recorded_at: string
          recorded_by: string
          recorded_by_person_id: string
          recorded_engagement: string
          supersedes_id: string | null
          target_source_id: string
          version_no: number
          withdrawn: boolean
        }
        Insert: {
          conclusion: string
          criteria?: Json
          id?: string
          item_id: string
          justification: string
          reason?: string | null
          recorded_at?: string
          recorded_by: string
          recorded_by_person_id: string
          recorded_engagement: string
          supersedes_id?: string | null
          target_source_id: string
          version_no: number
          withdrawn?: boolean
        }
        Update: {
          conclusion?: string
          criteria?: Json
          id?: string
          item_id?: string
          justification?: string
          reason?: string | null
          recorded_at?: string
          recorded_by?: string
          recorded_by_person_id?: string
          recorded_engagement?: string
          supersedes_id?: string | null
          target_source_id?: string
          version_no?: number
          withdrawn?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "curricular_reference_correspondence_assessme_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "curricular_reference_correspondence_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curricular_reference_correspondence_assessments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "curricular_reference_items"
            referencedColumns: ["id"]
          },
        ]
      }
      curricular_reference_editions: {
        Row: {
          authority: string
          contract_schema: string | null
          declared_item_count: number | null
          edition_label: string
          id: string
          item_count: number
          manifest_sha256: string | null
          published_on: string | null
          recorded_at: string
          recorded_by: string
          recorded_by_person_id: string | null
          recorded_engagement: string
          revision_no: number | null
          source_id: string
          source_label: string
          source_ref: string | null
          source_sha256: string
          supersedes_id: string | null
          valid_from: string | null
        }
        Insert: {
          authority: string
          contract_schema?: string | null
          declared_item_count?: number | null
          edition_label: string
          id?: string
          item_count: number
          manifest_sha256?: string | null
          published_on?: string | null
          recorded_at?: string
          recorded_by: string
          recorded_by_person_id?: string | null
          recorded_engagement: string
          revision_no?: number | null
          source_id: string
          source_label: string
          source_ref?: string | null
          source_sha256: string
          supersedes_id?: string | null
          valid_from?: string | null
        }
        Update: {
          authority?: string
          contract_schema?: string | null
          declared_item_count?: number | null
          edition_label?: string
          id?: string
          item_count?: number
          manifest_sha256?: string | null
          published_on?: string | null
          recorded_at?: string
          recorded_by?: string
          recorded_by_person_id?: string | null
          recorded_engagement?: string
          revision_no?: number | null
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
      curricular_reference_glossary_versions: {
        Row: {
          definition: string
          definition_origin: string
          edition_id: string
          id: string
          item_id: string | null
          reason: string | null
          recorded_at: string
          recorded_by: string
          recorded_by_person_id: string
          recorded_engagement: string
          source_locator: string | null
          supersedes_id: string | null
          term: string
          term_key: string
          version_no: number
        }
        Insert: {
          definition: string
          definition_origin: string
          edition_id: string
          id?: string
          item_id?: string | null
          reason?: string | null
          recorded_at?: string
          recorded_by: string
          recorded_by_person_id: string
          recorded_engagement: string
          source_locator?: string | null
          supersedes_id?: string | null
          term: string
          term_key: string
          version_no: number
        }
        Update: {
          definition?: string
          definition_origin?: string
          edition_id?: string
          id?: string
          item_id?: string | null
          reason?: string | null
          recorded_at?: string
          recorded_by?: string
          recorded_by_person_id?: string
          recorded_engagement?: string
          source_locator?: string | null
          supersedes_id?: string | null
          term?: string
          term_key?: string
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "curricular_reference_glossary_versions_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "curricular_reference_editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curricular_reference_glossary_versions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "curricular_reference_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curricular_reference_glossary_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "curricular_reference_glossary_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      curricular_reference_homologations: {
        Row: {
          decision: string
          id: string
          predecessor_id: string | null
          reason: string | null
          recorded_at: string
          recorded_by: string
          recorded_by_person_id: string
          recorded_engagement: string
          sequence: number
          target_id: string
          target_kind: string
        }
        Insert: {
          decision: string
          id?: string
          predecessor_id?: string | null
          reason?: string | null
          recorded_at?: string
          recorded_by: string
          recorded_by_person_id: string
          recorded_engagement: string
          sequence: number
          target_id: string
          target_kind: string
        }
        Update: {
          decision?: string
          id?: string
          predecessor_id?: string | null
          reason?: string | null
          recorded_at?: string
          recorded_by?: string
          recorded_by_person_id?: string
          recorded_engagement?: string
          sequence?: number
          target_id?: string
          target_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "curricular_reference_homologations_predecessor_id_fkey"
            columns: ["predecessor_id"]
            isOneToOne: false
            referencedRelation: "curricular_reference_homologations"
            referencedColumns: ["id"]
          },
        ]
      }
      curricular_reference_item_bindings: {
        Row: {
          item_id: string
          scheme_id: string
          value_id: string
          value_version: number | null
        }
        Insert: {
          item_id: string
          scheme_id: string
          value_id: string
          value_version?: number | null
        }
        Update: {
          item_id?: string
          scheme_id?: string
          value_id?: string
          value_version?: number | null
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
          ordinal: number | null
          parent_code: string | null
          parent_item_id: string | null
          source_labels: Json
          source_locator: string | null
        }
        Insert: {
          code: string
          edition_id: string
          id?: string
          item_kind: string
          official_text: string
          ordinal?: number | null
          parent_code?: string | null
          parent_item_id?: string | null
          source_labels?: Json
          source_locator?: string | null
        }
        Update: {
          code?: string
          edition_id?: string
          id?: string
          item_kind?: string
          official_text?: string
          ordinal?: number | null
          parent_code?: string | null
          parent_item_id?: string | null
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
          {
            foreignKeyName: "curricular_reference_items_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "curricular_reference_items"
            referencedColumns: ["id"]
          },
        ]
      }
      curricular_reference_keyword_versions: {
        Row: {
          id: string
          item_id: string
          reason: string | null
          recorded_at: string
          recorded_by: string
          recorded_by_person_id: string
          recorded_engagement: string
          supersedes_id: string | null
          terms: string[]
          version_no: number
        }
        Insert: {
          id?: string
          item_id: string
          reason?: string | null
          recorded_at?: string
          recorded_by: string
          recorded_by_person_id: string
          recorded_engagement: string
          supersedes_id?: string | null
          terms: string[]
          version_no: number
        }
        Update: {
          id?: string
          item_id?: string
          reason?: string | null
          recorded_at?: string
          recorded_by?: string
          recorded_by_person_id?: string
          recorded_engagement?: string
          supersedes_id?: string | null
          terms?: string[]
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "curricular_reference_keyword_versions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "curricular_reference_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curricular_reference_keyword_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "curricular_reference_keyword_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      curricular_reference_relations: {
        Row: {
          confidence: string
          criteria: Json | null
          direction: string | null
          from_item_id: string
          id: string
          justification: string | null
          nature: string
          official_locator: string | null
          origin: string | null
          provenance: string
          reason: string | null
          recorded_at: string
          recorded_by: string
          recorded_by_person_id: string | null
          recorded_engagement: string
          revokes_id: string | null
          to_item_id: string
        }
        Insert: {
          confidence: string
          criteria?: Json | null
          direction?: string | null
          from_item_id: string
          id?: string
          justification?: string | null
          nature: string
          official_locator?: string | null
          origin?: string | null
          provenance: string
          reason?: string | null
          recorded_at?: string
          recorded_by: string
          recorded_by_person_id?: string | null
          recorded_engagement: string
          revokes_id?: string | null
          to_item_id: string
        }
        Update: {
          confidence?: string
          criteria?: Json | null
          direction?: string | null
          from_item_id?: string
          id?: string
          justification?: string | null
          nature?: string
          official_locator?: string | null
          origin?: string | null
          provenance?: string
          reason?: string | null
          recorded_at?: string
          recorded_by?: string
          recorded_by_person_id?: string | null
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
          recorded_by_person_id: string | null
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
          recorded_by_person_id?: string | null
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
          recorded_by_person_id?: string | null
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
      data_quality_review_events: {
        Row: {
          evidence_sha256: string
          fingerprint: string
          id: string
          reason: string
          recorded_at: string
          recorded_by: string
          recorded_by_person: string | null
          recorded_by_principal: string | null
          rule_id: string
          rule_version: number
          school_id: string | null
          state: string
          supersedes_id: string | null
        }
        Insert: {
          evidence_sha256: string
          fingerprint: string
          id?: string
          reason: string
          recorded_at?: string
          recorded_by: string
          recorded_by_person?: string | null
          recorded_by_principal?: string | null
          rule_id: string
          rule_version: number
          school_id?: string | null
          state: string
          supersedes_id?: string | null
        }
        Update: {
          evidence_sha256?: string
          fingerprint?: string
          id?: string
          reason?: string
          recorded_at?: string
          recorded_by?: string
          recorded_by_person?: string | null
          recorded_by_principal?: string | null
          rule_id?: string
          rule_version?: number
          school_id?: string | null
          state?: string
          supersedes_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_quality_review_events_recorded_by_principal_fkey"
            columns: ["recorded_by_principal"]
            isOneToOne: false
            referencedRelation: "institutional_sector_principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_quality_review_events_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "data_quality_review_events"
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
      dietary_restrictions: {
        Row: {
          author_engagement: string | null
          author_principal_id: string | null
          author_user_id: string
          event_kind: string
          handling_note: string | null
          id: string
          logical_id: string
          reason: string | null
          recorded_at: string
          restriction_value_id: string
          school_id: string
          student_id: string
          supersedes_id: string | null
          valid_from: string
          valid_to: string | null
          version: number
        }
        Insert: {
          author_engagement?: string | null
          author_principal_id?: string | null
          author_user_id: string
          event_kind: string
          handling_note?: string | null
          id?: string
          logical_id: string
          reason?: string | null
          recorded_at?: string
          restriction_value_id: string
          school_id: string
          student_id: string
          supersedes_id?: string | null
          valid_from: string
          valid_to?: string | null
          version: number
        }
        Update: {
          author_engagement?: string | null
          author_principal_id?: string | null
          author_user_id?: string
          event_kind?: string
          handling_note?: string | null
          id?: string
          logical_id?: string
          reason?: string | null
          recorded_at?: string
          restriction_value_id?: string
          school_id?: string
          student_id?: string
          supersedes_id?: string | null
          valid_from?: string
          valid_to?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "dietary_restrictions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "dietary_restrictions"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_endings: {
        Row: {
          act_ref: string | null
          created_at: string
          ended_on: string
          engagement_id: string
          recorded_by: string
        }
        Insert: {
          act_ref?: string | null
          created_at?: string
          ended_on: string
          engagement_id: string
          recorded_by: string
        }
        Update: {
          act_ref?: string | null
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
      enrollment_wizard_draft_events: {
        Row: {
          author_actor_kind: string
          author_person_id: string | null
          author_principal_id: string | null
          author_user_id: string
          cpf_hint: string | null
          cpf_hmac: string | null
          created_at: string
          draft_id: string
          existing_student_id: string | null
          id: string
          inep: string | null
          kind: string
          payload: Json
          reason: string | null
          result: Json | null
          school_id: string
          sequence: number
          step: number
        }
        Insert: {
          author_actor_kind: string
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id: string
          cpf_hint?: string | null
          cpf_hmac?: string | null
          created_at?: string
          draft_id: string
          existing_student_id?: string | null
          id?: string
          inep?: string | null
          kind: string
          payload?: Json
          reason?: string | null
          result?: Json | null
          school_id: string
          sequence: number
          step: number
        }
        Update: {
          author_actor_kind?: string
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id?: string
          cpf_hint?: string | null
          cpf_hmac?: string | null
          created_at?: string
          draft_id?: string
          existing_student_id?: string | null
          id?: string
          inep?: string | null
          kind?: string
          payload?: Json
          reason?: string | null
          result?: Json | null
          school_id?: string
          sequence?: number
          step?: number
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_wizard_draft_events_author_person_id_fkey"
            columns: ["author_person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_wizard_draft_events_author_principal_id_fkey"
            columns: ["author_principal_id"]
            isOneToOne: false
            referencedRelation: "institutional_sector_principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_wizard_draft_events_existing_student_id_fkey"
            columns: ["existing_student_id"]
            isOneToOne: false
            referencedRelation: "institutional_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_wizard_draft_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_wizard_events: {
        Row: {
          author_person_id: string
          author_user_id: string
          cpf_hint: string | null
          cpf_hmac: string | null
          created_at: string
          draft_id: string
          existing_student_id: string | null
          id: string
          inep: string | null
          kind: string
          payload: Json
          reason: string | null
          result: Json | null
          school_id: string
          sequence: number
          step: number
        }
        Insert: {
          author_person_id: string
          author_user_id: string
          cpf_hint?: string | null
          cpf_hmac?: string | null
          created_at?: string
          draft_id: string
          existing_student_id?: string | null
          id?: string
          inep?: string | null
          kind: string
          payload?: Json
          reason?: string | null
          result?: Json | null
          school_id: string
          sequence: number
          step: number
        }
        Update: {
          author_person_id?: string
          author_user_id?: string
          cpf_hint?: string | null
          cpf_hmac?: string | null
          created_at?: string
          draft_id?: string
          existing_student_id?: string | null
          id?: string
          inep?: string | null
          kind?: string
          payload?: Json
          reason?: string | null
          result?: Json | null
          school_id?: string
          sequence?: number
          step?: number
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_wizard_events_existing_student_id_fkey"
            columns: ["existing_student_id"]
            isOneToOne: false
            referencedRelation: "institutional_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_wizard_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
        ]
      }
      exact_lookup_events: {
        Row: {
          created_at: string
          id: string
          identifier_kind: string
          outcome: string
          purpose: string
          school_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          identifier_kind: string
          outcome: string
          purpose: string
          school_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          identifier_kind?: string
          outcome?: string
          purpose?: string
          school_id?: string
          user_id?: string
        }
        Relationships: []
      }
      guardian_authorizations: {
        Row: {
          event_kind: string
          guardian_person_id: string | null
          guardian_user_id: string
          id: string
          logical_id: string
          reason: string | null
          recorded_at: string
          recorded_by: string
          recorded_engagement: string
          relation_scheme_id: string | null
          relation_value_id: string | null
          school_id: string
          sections: string[]
          source_ref: string | null
          student_id: string
          supersedes_id: string | null
          valid_from: string
          valid_until: string | null
          version: number
        }
        Insert: {
          event_kind: string
          guardian_person_id?: string | null
          guardian_user_id: string
          id?: string
          logical_id: string
          reason?: string | null
          recorded_at?: string
          recorded_by: string
          recorded_engagement: string
          relation_scheme_id?: string | null
          relation_value_id?: string | null
          school_id: string
          sections?: string[]
          source_ref?: string | null
          student_id: string
          supersedes_id?: string | null
          valid_from: string
          valid_until?: string | null
          version: number
        }
        Update: {
          event_kind?: string
          guardian_person_id?: string | null
          guardian_user_id?: string
          id?: string
          logical_id?: string
          reason?: string | null
          recorded_at?: string
          recorded_by?: string
          recorded_engagement?: string
          relation_scheme_id?: string | null
          relation_value_id?: string | null
          school_id?: string
          sections?: string[]
          source_ref?: string | null
          student_id?: string
          supersedes_id?: string | null
          valid_from?: string
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "guardian_authorizations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "institutional_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardian_authorizations_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "guardian_authorizations"
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
      inclusion_access_events: {
        Row: {
          at: string
          attachment_id: string
          denial_code: string | null
          engagement_id: string | null
          granted: boolean
          id: string
          purpose: string
          user_id: string
        }
        Insert: {
          at?: string
          attachment_id: string
          denial_code?: string | null
          engagement_id?: string | null
          granted: boolean
          id?: string
          purpose: string
          user_id: string
        }
        Update: {
          at?: string
          attachment_id?: string
          denial_code?: string | null
          engagement_id?: string | null
          granted?: boolean
          id?: string
          purpose?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inclusion_access_events_attachment_id_fkey"
            columns: ["attachment_id"]
            isOneToOne: false
            referencedRelation: "inclusion_attachments"
            referencedColumns: ["id"]
          },
        ]
      }
      inclusion_attachments: {
        Row: {
          author_engagement: string
          author_user_id: string
          classification: string
          id: string
          media_type: string
          purpose: string
          record_logical_id: string
          recorded_at: string
          school_id: string
          sha256: string
          size_bytes: number
          storage_path: string
          student_id: string
          withdrawn_reason: string | null
        }
        Insert: {
          author_engagement: string
          author_user_id: string
          classification: string
          id?: string
          media_type: string
          purpose: string
          record_logical_id: string
          recorded_at?: string
          school_id: string
          sha256: string
          size_bytes: number
          storage_path: string
          student_id: string
          withdrawn_reason?: string | null
        }
        Update: {
          author_engagement?: string
          author_user_id?: string
          classification?: string
          id?: string
          media_type?: string
          purpose?: string
          record_logical_id?: string
          recorded_at?: string
          school_id?: string
          sha256?: string
          size_bytes?: number
          storage_path?: string
          student_id?: string
          withdrawn_reason?: string | null
        }
        Relationships: []
      }
      inclusion_clinical_access_events: {
        Row: {
          at: string
          engagement_id: string | null
          granted: boolean
          id: string
          purpose: string
          school_id: string
          student_id: string
          user_id: string
        }
        Insert: {
          at?: string
          engagement_id?: string | null
          granted: boolean
          id?: string
          purpose: string
          school_id: string
          student_id: string
          user_id: string
        }
        Update: {
          at?: string
          engagement_id?: string | null
          granted?: boolean
          id?: string
          purpose?: string
          school_id?: string
          student_id?: string
          user_id?: string
        }
        Relationships: []
      }
      inclusion_clinical_records: {
        Row: {
          attachment_id: string | null
          author_engagement: string
          author_user_id: string
          cid_as_written: string | null
          dimension_scheme_id: string | null
          dimension_value_id: string | null
          dimension_value_version: number | null
          event_kind: string
          id: string
          logical_id: string
          note: string | null
          reason: string | null
          recorded_at: string
          school_id: string
          source_document: string
          student_id: string
          supersedes_id: string | null
          valid_from: string
          valid_to: string | null
          version: number
        }
        Insert: {
          attachment_id?: string | null
          author_engagement: string
          author_user_id: string
          cid_as_written?: string | null
          dimension_scheme_id?: string | null
          dimension_value_id?: string | null
          dimension_value_version?: number | null
          event_kind: string
          id?: string
          logical_id: string
          note?: string | null
          reason?: string | null
          recorded_at?: string
          school_id: string
          source_document: string
          student_id: string
          supersedes_id?: string | null
          valid_from: string
          valid_to?: string | null
          version: number
        }
        Update: {
          attachment_id?: string | null
          author_engagement?: string
          author_user_id?: string
          cid_as_written?: string | null
          dimension_scheme_id?: string | null
          dimension_value_id?: string | null
          dimension_value_version?: number | null
          event_kind?: string
          id?: string
          logical_id?: string
          note?: string | null
          reason?: string | null
          recorded_at?: string
          school_id?: string
          source_document?: string
          student_id?: string
          supersedes_id?: string | null
          valid_from?: string
          valid_to?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "inclusion_clinical_records_attachment_id_fkey"
            columns: ["attachment_id"]
            isOneToOne: false
            referencedRelation: "inclusion_attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inclusion_clinical_records_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "inclusion_clinical_records"
            referencedColumns: ["id"]
          },
        ]
      }
      inclusion_mediation_assignments: {
        Row: {
          author_engagement: string
          author_user_id: string
          class_id: string | null
          event_kind: string
          id: string
          logical_id: string
          mediator_engagement_id: string
          reason: string | null
          recorded_at: string
          school_id: string
          student_id: string
          supersedes_id: string | null
          valid_from: string
          valid_to: string | null
          version: number
        }
        Insert: {
          author_engagement: string
          author_user_id: string
          class_id?: string | null
          event_kind: string
          id?: string
          logical_id: string
          mediator_engagement_id: string
          reason?: string | null
          recorded_at?: string
          school_id: string
          student_id: string
          supersedes_id?: string | null
          valid_from: string
          valid_to?: string | null
          version: number
        }
        Update: {
          author_engagement?: string
          author_user_id?: string
          class_id?: string | null
          event_kind?: string
          id?: string
          logical_id?: string
          mediator_engagement_id?: string
          reason?: string | null
          recorded_at?: string
          school_id?: string
          student_id?: string
          supersedes_id?: string | null
          valid_from?: string
          valid_to?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "inclusion_mediation_assignments_mediator_engagement_id_fkey"
            columns: ["mediator_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inclusion_mediation_assignments_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "inclusion_mediation_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      inclusion_records: {
        Row: {
          author_engagement: string
          author_person_id: string | null
          author_user_id: string
          body: string
          category_scheme_id: string | null
          category_value_id: string | null
          category_value_version: number | null
          educational_purpose: string
          event_kind: string
          id: string
          logical_id: string
          reason: string | null
          record_type: string
          recorded_at: string
          school_id: string
          share_with_mediation: boolean
          student_id: string
          supersedes_id: string | null
          valid_from: string
          valid_to: string | null
          version: number
        }
        Insert: {
          author_engagement: string
          author_person_id?: string | null
          author_user_id: string
          body: string
          category_scheme_id?: string | null
          category_value_id?: string | null
          category_value_version?: number | null
          educational_purpose: string
          event_kind: string
          id?: string
          logical_id: string
          reason?: string | null
          record_type: string
          recorded_at?: string
          school_id: string
          share_with_mediation?: boolean
          student_id: string
          supersedes_id?: string | null
          valid_from: string
          valid_to?: string | null
          version: number
        }
        Update: {
          author_engagement?: string
          author_person_id?: string | null
          author_user_id?: string
          body?: string
          category_scheme_id?: string | null
          category_value_id?: string | null
          category_value_version?: number | null
          educational_purpose?: string
          event_kind?: string
          id?: string
          logical_id?: string
          reason?: string | null
          record_type?: string
          recorded_at?: string
          school_id?: string
          share_with_mediation?: boolean
          student_id?: string
          supersedes_id?: string | null
          valid_from?: string
          valid_to?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "inclusion_records_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "inclusion_records"
            referencedColumns: ["id"]
          },
        ]
      }
      inclusion_term_review_events: {
        Row: {
          actor_engagement: string
          actor_user_id: string
          alias: string | null
          category_value_id: string | null
          category_version: number | null
          id: string
          note: string | null
          origin: string
          original_term: string
          recorded_at: string
          seq: number
          status: string
          term_logical_id: string
        }
        Insert: {
          actor_engagement: string
          actor_user_id: string
          alias?: string | null
          category_value_id?: string | null
          category_version?: number | null
          id?: string
          note?: string | null
          origin: string
          original_term: string
          recorded_at?: string
          seq: number
          status: string
          term_logical_id: string
        }
        Update: {
          actor_engagement?: string
          actor_user_id?: string
          alias?: string | null
          category_value_id?: string | null
          category_version?: number | null
          id?: string
          note?: string | null
          origin?: string
          original_term?: string
          recorded_at?: string
          seq?: number
          status?: string
          term_logical_id?: string
        }
        Relationships: []
      }
      infant_experience_drafts: {
        Row: {
          author_user_id: string
          discarded: boolean
          draft_key: string
          id: string
          payload: Json
          recorded_at: string
          seq: number
        }
        Insert: {
          author_user_id?: string
          discarded?: boolean
          draft_key: string
          id?: string
          payload: Json
          recorded_at?: string
          seq: number
        }
        Update: {
          author_user_id?: string
          discarded?: boolean
          draft_key?: string
          id?: string
          payload?: Json
          recorded_at?: string
          seq?: number
        }
        Relationships: []
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
      inst_assessment_results: {
        Row: {
          assessment_logical_id: string
          assessment_version_id: string
          author_engagement: string | null
          author_principal_id: string | null
          author_user_id: string
          class_id: string | null
          event_kind: string
          id: string
          item_id: string | null
          logical_id: string
          numeric_value: number | null
          plan_key: string | null
          raw_value: string | null
          reason: string | null
          recorded_at: string
          school_id: string
          source_ref: string | null
          status: string
          student_id: string
          supersedes_id: string | null
          version: number
        }
        Insert: {
          assessment_logical_id: string
          assessment_version_id: string
          author_engagement?: string | null
          author_principal_id?: string | null
          author_user_id: string
          class_id?: string | null
          event_kind: string
          id?: string
          item_id?: string | null
          logical_id: string
          numeric_value?: number | null
          plan_key?: string | null
          raw_value?: string | null
          reason?: string | null
          recorded_at?: string
          school_id: string
          source_ref?: string | null
          status: string
          student_id: string
          supersedes_id?: string | null
          version: number
        }
        Update: {
          assessment_logical_id?: string
          assessment_version_id?: string
          author_engagement?: string | null
          author_principal_id?: string | null
          author_user_id?: string
          class_id?: string | null
          event_kind?: string
          id?: string
          item_id?: string | null
          logical_id?: string
          numeric_value?: number | null
          plan_key?: string | null
          raw_value?: string | null
          reason?: string | null
          recorded_at?: string
          school_id?: string
          source_ref?: string | null
          status?: string
          student_id?: string
          supersedes_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "inst_assessment_results_assessment_version_id_fkey"
            columns: ["assessment_version_id"]
            isOneToOne: false
            referencedRelation: "inst_assessment_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inst_assessment_results_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "inst_assessment_results"
            referencedColumns: ["id"]
          },
        ]
      }
      inst_assessment_versions: {
        Row: {
          applied_from: string
          applied_to: string
          author_engagement: string | null
          author_principal_id: string | null
          author_user_id: string
          event_kind: string
          id: string
          items: Json
          logical_id: string
          origin: string
          reason: string | null
          recorded_at: string
          scale: Json
          source_note: string | null
          supersedes_id: string | null
          target_population: Json
          title: string
          version: number
        }
        Insert: {
          applied_from: string
          applied_to: string
          author_engagement?: string | null
          author_principal_id?: string | null
          author_user_id: string
          event_kind: string
          id?: string
          items: Json
          logical_id: string
          origin: string
          reason?: string | null
          recorded_at?: string
          scale: Json
          source_note?: string | null
          supersedes_id?: string | null
          target_population: Json
          title: string
          version: number
        }
        Update: {
          applied_from?: string
          applied_to?: string
          author_engagement?: string | null
          author_principal_id?: string | null
          author_user_id?: string
          event_kind?: string
          id?: string
          items?: Json
          logical_id?: string
          origin?: string
          reason?: string | null
          recorded_at?: string
          scale?: Json
          source_note?: string | null
          supersedes_id?: string | null
          target_population?: Json
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "inst_assessment_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "inst_assessment_versions"
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
          originating_act_ref: string | null
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
          originating_act_ref?: string | null
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
          originating_act_ref?: string | null
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
          originating_act_ref: string | null
          recorded_by: string | null
          recorded_by_person_id: string | null
          recorded_via_engagement_id: string | null
          starts_on: string
          supersedes_id: string | null
          technical_operation_id: string | null
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
          originating_act_ref?: string | null
          recorded_by?: string | null
          recorded_by_person_id?: string | null
          recorded_via_engagement_id?: string | null
          starts_on: string
          supersedes_id?: string | null
          technical_operation_id?: string | null
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
          originating_act_ref?: string | null
          recorded_by?: string | null
          recorded_by_person_id?: string | null
          recorded_via_engagement_id?: string | null
          starts_on?: string
          supersedes_id?: string | null
          technical_operation_id?: string | null
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
            foreignKeyName: "institutional_academic_year_version_technical_operation_id_fkey"
            columns: ["technical_operation_id"]
            isOneToOne: false
            referencedRelation: "technical_execution_operations"
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
      institutional_class_identifiers: {
        Row: {
          class_id: string
          identifier_kind: string
          recorded_at: string
          technical_operation_id: string | null
          value: string
        }
        Insert: {
          class_id: string
          identifier_kind: string
          recorded_at?: string
          technical_operation_id?: string | null
          value: string
        }
        Update: {
          class_id?: string
          identifier_kind?: string
          recorded_at?: string
          technical_operation_id?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "institutional_class_identifiers_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "institutional_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_class_identifiers_technical_operation_id_fkey"
            columns: ["technical_operation_id"]
            isOneToOne: false
            referencedRelation: "technical_execution_operations"
            referencedColumns: ["id"]
          },
        ]
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
          authorizing_policy_id: string | null
          change_reason: string | null
          class_id: string
          code: string | null
          created_at: string
          id: string
          name: string
          originating_act_ref: string | null
          recorded_by: string | null
          recorded_by_person_id: string | null
          recorded_by_principal_id: string | null
          recorded_via_engagement_id: string | null
          segment_id: string
          supersedes_id: string | null
          technical_operation_id: string | null
          valid_from: string
          valid_until: string | null
          version: number
        }
        Insert: {
          administrative_status: string
          authorizing_policy_id?: string | null
          change_reason?: string | null
          class_id: string
          code?: string | null
          created_at?: string
          id?: string
          name: string
          originating_act_ref?: string | null
          recorded_by?: string | null
          recorded_by_person_id?: string | null
          recorded_by_principal_id?: string | null
          recorded_via_engagement_id?: string | null
          segment_id: string
          supersedes_id?: string | null
          technical_operation_id?: string | null
          valid_from: string
          valid_until?: string | null
          version: number
        }
        Update: {
          administrative_status?: string
          authorizing_policy_id?: string | null
          change_reason?: string | null
          class_id?: string
          code?: string | null
          created_at?: string
          id?: string
          name?: string
          originating_act_ref?: string | null
          recorded_by?: string | null
          recorded_by_person_id?: string | null
          recorded_by_principal_id?: string | null
          recorded_via_engagement_id?: string | null
          segment_id?: string
          supersedes_id?: string | null
          technical_operation_id?: string | null
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
            foreignKeyName: "institutional_class_record_versio_recorded_by_principal_id_fkey"
            columns: ["recorded_by_principal_id"]
            isOneToOne: false
            referencedRelation: "institutional_sector_principals"
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
          {
            foreignKeyName: "institutional_class_record_versions_technical_operation_id_fkey"
            columns: ["technical_operation_id"]
            isOneToOne: false
            referencedRelation: "technical_execution_operations"
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
      institutional_integration_runs: {
        Row: {
          attempts: number
          code: string
          config_version: number | null
          id: string
          integration_key: string
          kind: string
          outcome: string
          ran_at: string
          run_by: string | null
        }
        Insert: {
          attempts?: number
          code: string
          config_version?: number | null
          id?: string
          integration_key: string
          kind: string
          outcome: string
          ran_at?: string
          run_by?: string | null
        }
        Update: {
          attempts?: number
          code?: string
          config_version?: number | null
          id?: string
          integration_key?: string
          kind?: string
          outcome?: string
          ran_at?: string
          run_by?: string | null
        }
        Relationships: []
      }
      institutional_integration_versions: {
        Row: {
          config: Json
          id: string
          integration_key: string
          mapping: Json
          provider: string
          reason: string
          recorded_at: string
          recorded_by: string
          secret_ref: string | null
          slot: string
          state: string
          version: number
        }
        Insert: {
          config?: Json
          id?: string
          integration_key: string
          mapping?: Json
          provider: string
          reason: string
          recorded_at?: string
          recorded_by: string
          secret_ref?: string | null
          slot: string
          state: string
          version: number
        }
        Update: {
          config?: Json
          id?: string
          integration_key?: string
          mapping?: Json
          provider?: string
          reason?: string
          recorded_at?: string
          recorded_by?: string
          secret_ref?: string | null
          slot?: string
          state?: string
          version?: number
        }
        Relationships: []
      }
      institutional_period_organization_versions: {
        Row: {
          change_reason: string | null
          created_at: string
          id: string
          is_active: boolean
          official_name: string
          organization_id: string
          originating_act_ref: string | null
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
          originating_act_ref?: string | null
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
          originating_act_ref?: string | null
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
      institutional_person_identifiers: {
        Row: {
          identifier_kind: string
          person_id: string
          recorded_at: string
          technical_operation_id: string | null
          value: string
        }
        Insert: {
          identifier_kind: string
          person_id: string
          recorded_at?: string
          technical_operation_id?: string | null
          value: string
        }
        Update: {
          identifier_kind?: string
          person_id?: string
          recorded_at?: string
          technical_operation_id?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "institutional_person_identifiers_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_person_identifiers_technical_operation_id_fkey"
            columns: ["technical_operation_id"]
            isOneToOne: false
            referencedRelation: "technical_execution_operations"
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
      institutional_rule_drafts: {
        Row: {
          domain: string
          id: string
          logical_id: string
          payload: Json
          reason: string
          recorded_at: string
          recorded_by: string
          recorded_engagement_id: string
          recorded_person_id: string
          source_ref: string | null
          valid_from: string | null
          valid_until: string | null
          version: number
        }
        Insert: {
          domain: string
          id?: string
          logical_id: string
          payload: Json
          reason: string
          recorded_at?: string
          recorded_by: string
          recorded_engagement_id: string
          recorded_person_id: string
          source_ref?: string | null
          valid_from?: string | null
          valid_until?: string | null
          version: number
        }
        Update: {
          domain?: string
          id?: string
          logical_id?: string
          payload?: Json
          reason?: string
          recorded_at?: string
          recorded_by?: string
          recorded_engagement_id?: string
          recorded_person_id?: string
          source_ref?: string | null
          valid_from?: string | null
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "institutional_rule_drafts_recorded_engagement_id_fkey"
            columns: ["recorded_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_rule_drafts_recorded_person_id_fkey"
            columns: ["recorded_person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
        ]
      }
      institutional_rule_homologations: {
        Row: {
          domain: string
          draft_id: string
          homologated_at: string
          homologated_by: string
          homologated_engagement_id: string
          homologated_person_id: string
          id: string
          logical_id: string
          reason: string
          source_ref: string | null
          version: number
        }
        Insert: {
          domain: string
          draft_id: string
          homologated_at?: string
          homologated_by: string
          homologated_engagement_id: string
          homologated_person_id: string
          id?: string
          logical_id: string
          reason: string
          source_ref?: string | null
          version: number
        }
        Update: {
          domain?: string
          draft_id?: string
          homologated_at?: string
          homologated_by?: string
          homologated_engagement_id?: string
          homologated_person_id?: string
          id?: string
          logical_id?: string
          reason?: string
          source_ref?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "institutional_rule_homologations_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: true
            referencedRelation: "institutional_rule_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_rule_homologations_homologated_engagement_id_fkey"
            columns: ["homologated_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_rule_homologations_homologated_person_id_fkey"
            columns: ["homologated_person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
        ]
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
          originating_act_ref: string | null
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
          originating_act_ref?: string | null
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
          originating_act_ref?: string | null
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
          administrative_dependency: string | null
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
          partnership_public_authority: string | null
          phone: string | null
          private_school_category: string | null
          registered_at: string
          school_id: string
          supersedes_version_id: string | null
          valid_from: string
          version_number: number
        }
        Insert: {
          active: boolean
          address?: string | null
          administrative_dependency?: string | null
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
          partnership_public_authority?: string | null
          phone?: string | null
          private_school_category?: string | null
          registered_at?: string
          school_id: string
          supersedes_version_id?: string | null
          valid_from: string
          version_number: number
        }
        Update: {
          active?: boolean
          address?: string | null
          administrative_dependency?: string | null
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
          partnership_public_authority?: string | null
          phone?: string | null
          private_school_category?: string | null
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
      institutional_sector_principal_revocations: {
        Row: {
          principal_id: string
          reason: string
          recorded_at: string
          revoked_on: string
        }
        Insert: {
          principal_id: string
          reason: string
          recorded_at?: string
          revoked_on: string
        }
        Update: {
          principal_id?: string
          reason?: string
          recorded_at?: string
          revoked_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "institutional_sector_principal_revocations_principal_id_fkey"
            columns: ["principal_id"]
            isOneToOne: true
            referencedRelation: "institutional_sector_principals"
            referencedColumns: ["id"]
          },
        ]
      }
      institutional_sector_principals: {
        Row: {
          auth_user_id: string
          created_at: string
          id: string
          principal_kind: string
          provenance: string
          provisioning_operation: string
          school_id: string | null
          scope_kind: string
          station_code: string
          valid_from: string
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          id?: string
          principal_kind?: string
          provenance: string
          provisioning_operation: string
          school_id?: string | null
          scope_kind: string
          station_code: string
          valid_from?: string
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          id?: string
          principal_kind?: string
          provenance?: string
          provisioning_operation?: string
          school_id?: string | null
          scope_kind?: string
          station_code?: string
          valid_from?: string
        }
        Relationships: [
          {
            foreignKeyName: "institutional_sector_principals_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
        ]
      }
      institutional_sector_provisioning_events: {
        Row: {
          executor: string
          id: string
          operation: string
          outcome: string
          principal_id: string
          recorded_at: string
        }
        Insert: {
          executor?: string
          id?: string
          operation: string
          outcome: string
          principal_id: string
          recorded_at?: string
        }
        Update: {
          executor?: string
          id?: string
          operation?: string
          outcome?: string
          principal_id?: string
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "institutional_sector_provisioning_events_principal_id_fkey"
            columns: ["principal_id"]
            isOneToOne: false
            referencedRelation: "institutional_sector_principals"
            referencedColumns: ["id"]
          },
        ]
      }
      institutional_student_persons: {
        Row: {
          person_id: string
          recorded_at: string
          student_id: string
          technical_operation_id: string | null
        }
        Insert: {
          person_id: string
          recorded_at?: string
          student_id: string
          technical_operation_id?: string | null
        }
        Update: {
          person_id?: string
          recorded_at?: string
          student_id?: string
          technical_operation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "institutional_student_persons_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_student_persons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "institutional_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_student_persons_technical_operation_id_fkey"
            columns: ["technical_operation_id"]
            isOneToOne: false
            referencedRelation: "technical_execution_operations"
            referencedColumns: ["id"]
          },
        ]
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
      integration_admin_events: {
        Row: {
          action: string
          actor: string
          created_at: string
          detail: Json
          id: string
          target_id: string | null
        }
        Insert: {
          action: string
          actor: string
          created_at?: string
          detail?: Json
          id?: string
          target_id?: string | null
        }
        Update: {
          action?: string
          actor?: string
          created_at?: string
          detail?: Json
          id?: string
          target_id?: string | null
        }
        Relationships: []
      }
      integration_clients: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          id: string
          name: string
          rate_limit_per_minute: number
          school_ids: string[] | null
          scopes: string[]
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by: string
          id?: string
          name: string
          rate_limit_per_minute?: number
          school_ids?: string[] | null
          scopes?: string[]
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          rate_limit_per_minute?: number
          school_ids?: string[] | null
          scopes?: string[]
        }
        Relationships: []
      }
      integration_keys: {
        Row: {
          client_id: string
          created_at: string
          created_by: string
          id: string
          key_hash: string
          key_prefix: string
          revoked_at: string | null
          revoked_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by: string
          id?: string
          key_hash: string
          key_prefix: string
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_keys_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "integration_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_requests: {
        Row: {
          client_id: string | null
          created_at: string
          error_code: string | null
          id: string
          idempotency_key: string | null
          key_id: string | null
          method: string
          request_id: string | null
          response_body: Json | null
          route: string
          status: number
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          error_code?: string | null
          id?: string
          idempotency_key?: string | null
          key_id?: string | null
          method: string
          request_id?: string | null
          response_body?: Json | null
          route: string
          status: number
        }
        Update: {
          client_id?: string | null
          created_at?: string
          error_code?: string | null
          id?: string
          idempotency_key?: string | null
          key_id?: string | null
          method?: string
          request_id?: string | null
          response_body?: Json | null
          route?: string
          status?: number
        }
        Relationships: [
          {
            foreignKeyName: "integration_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "integration_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_requests_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "integration_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      intelligence_dashboard_versions: {
        Row: {
          audience_capability: string | null
          author_engagement: string | null
          author_principal_id: string | null
          author_user_id: string
          event_kind: string
          filters: Json
          id: string
          logical_id: string
          reason: string | null
          recorded_at: string
          supersedes_id: string | null
          title: string
          version: number
          visibility: string
          widgets: Json
        }
        Insert: {
          audience_capability?: string | null
          author_engagement?: string | null
          author_principal_id?: string | null
          author_user_id: string
          event_kind: string
          filters?: Json
          id?: string
          logical_id: string
          reason?: string | null
          recorded_at?: string
          supersedes_id?: string | null
          title: string
          version: number
          visibility: string
          widgets: Json
        }
        Update: {
          audience_capability?: string | null
          author_engagement?: string | null
          author_principal_id?: string | null
          author_user_id?: string
          event_kind?: string
          filters?: Json
          id?: string
          logical_id?: string
          reason?: string | null
          recorded_at?: string
          supersedes_id?: string | null
          title?: string
          version?: number
          visibility?: string
          widgets?: Json
        }
        Relationships: [
          {
            foreignKeyName: "intelligence_dashboard_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "intelligence_dashboard_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_chunks: {
        Row: {
          body: string
          id: string
          ordinal: number
          page: number | null
          section: string | null
          tsv: unknown
          version_id: string
        }
        Insert: {
          body: string
          id?: string
          ordinal: number
          page?: number | null
          section?: string | null
          tsv?: unknown
          version_id: string
        }
        Update: {
          body?: string
          id?: string
          ordinal?: number
          page?: number | null
          section?: string | null
          tsv?: unknown
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_chunks_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "kb_document_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_document_events: {
        Row: {
          id: string
          kind: string
          reason: string
          recorded_at: string
          recorded_by: string
          version_id: string
        }
        Insert: {
          id?: string
          kind: string
          reason: string
          recorded_at?: string
          recorded_by: string
          version_id: string
        }
        Update: {
          id?: string
          kind?: string
          reason?: string
          recorded_at?: string
          recorded_by?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_document_events_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "kb_document_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_document_versions: {
        Row: {
          classification: string
          document_id: string
          id: string
          original_ref: string
          original_sha256: string
          recorded_at: string
          recorded_by: string
          required_capability: string | null
          supersedes_id: string | null
          title: string
          version: number
        }
        Insert: {
          classification: string
          document_id: string
          id?: string
          original_ref: string
          original_sha256: string
          recorded_at?: string
          recorded_by: string
          required_capability?: string | null
          supersedes_id?: string | null
          title: string
          version: number
        }
        Update: {
          classification?: string
          document_id?: string
          id?: string
          original_ref?: string
          original_sha256?: string
          recorded_at?: string
          recorded_by?: string
          required_capability?: string | null
          supersedes_id?: string | null
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "kb_document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "kb_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_document_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "kb_document_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_documents: {
        Row: {
          created_at: string
          id: string
          source_kind: string
        }
        Insert: {
          created_at?: string
          id: string
          source_kind: string
        }
        Update: {
          created_at?: string
          id?: string
          source_kind?: string
        }
        Relationships: []
      }
      lesson_curricular_references: {
        Row: {
          edition_id: string
          lesson_version_id: string
          reference_item_id: string
        }
        Insert: {
          edition_id: string
          lesson_version_id: string
          reference_item_id: string
        }
        Update: {
          edition_id?: string
          lesson_version_id?: string
          reference_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_curricular_references_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "curricular_reference_editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_curricular_references_lesson_version_id_fkey"
            columns: ["lesson_version_id"]
            isOneToOne: false
            referencedRelation: "lesson_record_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_curricular_references_reference_item_id_fkey"
            columns: ["reference_item_id"]
            isOneToOne: false
            referencedRelation: "curricular_reference_items"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_record_drafts: {
        Row: {
          author_user_id: string
          discarded: boolean
          draft_key: string
          id: string
          payload: Json
          recorded_at: string
          seq: number
        }
        Insert: {
          author_user_id?: string
          discarded?: boolean
          draft_key: string
          id?: string
          payload: Json
          recorded_at?: string
          seq: number
        }
        Update: {
          author_user_id?: string
          discarded?: boolean
          draft_key?: string
          id?: string
          payload?: Json
          recorded_at?: string
          seq?: number
        }
        Relationships: []
      }
      lesson_record_versions: {
        Row: {
          academic_year_id: string | null
          assignment_id: string
          author_person_id: string
          author_user_id: string
          authorizing_engagement_id: string
          calendar_id: string | null
          calendar_version_id: string | null
          capability_policy_id: string
          capability_policy_version: number
          class_id: string
          component_id: string
          concluded_at: string
          consulted_closing_id: string | null
          diary_contract: string | null
          facts: Json
          id: string
          item_key: string | null
          lesson_date: string
          logical_record_id: string
          matrix_version_id: string | null
          period_id: string | null
          plan_id: string
          rectification: Json | null
          schedule_block_ids: string[]
          substitution_version_id: string | null
          supersedes_version_id: string | null
          teaching_assignment_version_id: string | null
          version_number: number
        }
        Insert: {
          academic_year_id?: string | null
          assignment_id: string
          author_person_id: string
          author_user_id: string
          authorizing_engagement_id: string
          calendar_id?: string | null
          calendar_version_id?: string | null
          capability_policy_id: string
          capability_policy_version: number
          class_id: string
          component_id: string
          concluded_at?: string
          consulted_closing_id?: string | null
          diary_contract?: string | null
          facts: Json
          id?: string
          item_key?: string | null
          lesson_date: string
          logical_record_id: string
          matrix_version_id?: string | null
          period_id?: string | null
          plan_id: string
          rectification?: Json | null
          schedule_block_ids?: string[]
          substitution_version_id?: string | null
          supersedes_version_id?: string | null
          teaching_assignment_version_id?: string | null
          version_number: number
        }
        Update: {
          academic_year_id?: string | null
          assignment_id?: string
          author_person_id?: string
          author_user_id?: string
          authorizing_engagement_id?: string
          calendar_id?: string | null
          calendar_version_id?: string | null
          capability_policy_id?: string
          capability_policy_version?: number
          class_id?: string
          component_id?: string
          concluded_at?: string
          consulted_closing_id?: string | null
          diary_contract?: string | null
          facts?: Json
          id?: string
          item_key?: string | null
          lesson_date?: string
          logical_record_id?: string
          matrix_version_id?: string | null
          period_id?: string | null
          plan_id?: string
          rectification?: Json | null
          schedule_block_ids?: string[]
          substitution_version_id?: string | null
          supersedes_version_id?: string | null
          teaching_assignment_version_id?: string | null
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
            foreignKeyName: "lesson_record_versions_substitution_version_id_fkey"
            columns: ["substitution_version_id"]
            isOneToOne: false
            referencedRelation: "teaching_substitution_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_record_versions_supersedes_version_id_fkey"
            columns: ["supersedes_version_id"]
            isOneToOne: true
            referencedRelation: "lesson_record_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_record_versions_teaching_assignment_version_id_fkey"
            columns: ["teaching_assignment_version_id"]
            isOneToOne: false
            referencedRelation: "teaching_assignment_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      map_competence_rules: {
        Row: {
          created_at: string
          definition: Json
          drafted_by: string | null
          drafted_engagement_id: string | null
          drafted_person_id: string | null
          homologated_at: string | null
          homologated_by: string | null
          homologated_engagement_id: string | null
          homologated_person_id: string | null
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
          drafted_by?: string | null
          drafted_engagement_id?: string | null
          drafted_person_id?: string | null
          homologated_at?: string | null
          homologated_by?: string | null
          homologated_engagement_id?: string | null
          homologated_person_id?: string | null
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
          drafted_by?: string | null
          drafted_engagement_id?: string | null
          drafted_person_id?: string | null
          homologated_at?: string | null
          homologated_by?: string | null
          homologated_engagement_id?: string | null
          homologated_person_id?: string | null
          homologation_act_ref?: string | null
          id?: string
          status?: string
          valid_from?: string
          valid_until?: string | null
          version?: number
        }
        Relationships: []
      }
      meal_content_staging_events: {
        Row: {
          action: string
          author_person_id: string | null
          author_principal_id: string | null
          author_user_id: string
          id: string
          reason: string | null
          recorded_at: string
          staging_id: string
        }
        Insert: {
          action: string
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id: string
          id?: string
          reason?: string | null
          recorded_at?: string
          staging_id: string
        }
        Update: {
          action?: string
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id?: string
          id?: string
          reason?: string | null
          recorded_at?: string
          staging_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_content_staging_events_staging_id_fkey"
            columns: ["staging_id"]
            isOneToOne: false
            referencedRelation: "meal_content_stagings"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_content_stagings: {
        Row: {
          author_person_id: string | null
          author_principal_id: string | null
          author_user_id: string
          context_key: string
          id: string
          kind: string
          recorded_at: string
          rows: Json
          sha256: string
          source_name: string | null
        }
        Insert: {
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id: string
          context_key: string
          id?: string
          kind: string
          recorded_at?: string
          rows: Json
          sha256: string
          source_name?: string | null
        }
        Update: {
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id?: string
          context_key?: string
          id?: string
          kind?: string
          recorded_at?: string
          rows?: Json
          sha256?: string
          source_name?: string | null
        }
        Relationships: []
      }
      meal_daily_executions: {
        Row: {
          author_engagement: string | null
          author_person_id: string | null
          author_principal_id: string | null
          author_user_id: string
          count_basis: string | null
          deviation: string | null
          deviation_authorization_ref: string | null
          deviation_reason: string | null
          event_kind: string
          executed_on: string
          executed_preparation: string | null
          followed: boolean | null
          id: string
          logical_id: string
          meal_slot_value_id: string
          meals_breakdown: Json
          meals_total: number | null
          planned_menu_ref: string | null
          reason: string | null
          recorded_at: string
          school_id: string
          students_present: number | null
          students_present_source: string | null
          supersedes_id: string | null
          version: number
        }
        Insert: {
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id: string
          count_basis?: string | null
          deviation?: string | null
          deviation_authorization_ref?: string | null
          deviation_reason?: string | null
          event_kind: string
          executed_on: string
          executed_preparation?: string | null
          followed?: boolean | null
          id?: string
          logical_id: string
          meal_slot_value_id: string
          meals_breakdown?: Json
          meals_total?: number | null
          planned_menu_ref?: string | null
          reason?: string | null
          recorded_at?: string
          school_id: string
          students_present?: number | null
          students_present_source?: string | null
          supersedes_id?: string | null
          version: number
        }
        Update: {
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id?: string
          count_basis?: string | null
          deviation?: string | null
          deviation_authorization_ref?: string | null
          deviation_reason?: string | null
          event_kind?: string
          executed_on?: string
          executed_preparation?: string | null
          followed?: boolean | null
          id?: string
          logical_id?: string
          meal_slot_value_id?: string
          meals_breakdown?: Json
          meals_total?: number | null
          planned_menu_ref?: string | null
          reason?: string | null
          recorded_at?: string
          school_id?: string
          students_present?: number | null
          students_present_source?: string | null
          supersedes_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_daily_executions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_daily_executions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "meal_daily_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_delivery_schedules: {
        Row: {
          action: string
          apresentacao_ref: string | null
          author_engagement: string | null
          author_person_id: string | null
          author_principal_id: string | null
          author_user_id: string
          competence: string
          contrato_ref: string | null
          expected_on: string
          frequencia_ref: string | null
          id: string
          item_ref: string
          logical_id: string
          order_logical_id: string
          quantity: number
          reason: string | null
          recorded_at: string
          school_id: string
          supersedes_id: string | null
          unidade_ref: string
          version: number
        }
        Insert: {
          action: string
          apresentacao_ref?: string | null
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id: string
          competence: string
          contrato_ref?: string | null
          expected_on: string
          frequencia_ref?: string | null
          id?: string
          item_ref: string
          logical_id: string
          order_logical_id: string
          quantity: number
          reason?: string | null
          recorded_at?: string
          school_id: string
          supersedes_id?: string | null
          unidade_ref: string
          version: number
        }
        Update: {
          action?: string
          apresentacao_ref?: string | null
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id?: string
          competence?: string
          contrato_ref?: string | null
          expected_on?: string
          frequencia_ref?: string | null
          id?: string
          item_ref?: string
          logical_id?: string
          order_logical_id?: string
          quantity?: number
          reason?: string | null
          recorded_at?: string
          school_id?: string
          supersedes_id?: string | null
          unidade_ref?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_delivery_schedules_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_delivery_schedules_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "meal_delivery_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_demand_consolidations: {
        Row: {
          author_engagement: string | null
          author_person_id: string | null
          author_principal_id: string | null
          author_user_id: string
          competence: string
          id: string
          order_version_ids: string[]
          reason: string | null
          recorded_at: string
          sequence: number
          snapshot: Json
        }
        Insert: {
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id: string
          competence: string
          id?: string
          order_version_ids: string[]
          reason?: string | null
          recorded_at?: string
          sequence: number
          snapshot: Json
        }
        Update: {
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id?: string
          competence?: string
          id?: string
          order_version_ids?: string[]
          reason?: string | null
          recorded_at?: string
          sequence?: number
          snapshot?: Json
        }
        Relationships: []
      }
      meal_evidence_attachments: {
        Row: {
          author_engagement: string | null
          author_person_id: string | null
          author_principal_id: string | null
          author_user_id: string
          event_kind: string
          id: string
          label: string | null
          logical_id: string
          media_type: string | null
          reason: string | null
          recorded_at: string
          school_id: string
          sha256: string | null
          size_bytes: number | null
          storage_path: string | null
          supersedes_id: string | null
          target_kind: string
          target_logical_id: string
          version: number
        }
        Insert: {
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id: string
          event_kind: string
          id?: string
          label?: string | null
          logical_id: string
          media_type?: string | null
          reason?: string | null
          recorded_at?: string
          school_id: string
          sha256?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          supersedes_id?: string | null
          target_kind: string
          target_logical_id: string
          version: number
        }
        Update: {
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id?: string
          event_kind?: string
          id?: string
          label?: string | null
          logical_id?: string
          media_type?: string | null
          reason?: string | null
          recorded_at?: string
          school_id?: string
          sha256?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          supersedes_id?: string | null
          target_kind?: string
          target_logical_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_evidence_attachments_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "meal_evidence_attachments"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_execution_consumptions: {
        Row: {
          execution_logical_id: string
          line_key: string
          movement_id: string
          recorded_at: string
        }
        Insert: {
          execution_logical_id: string
          line_key: string
          movement_id: string
          recorded_at?: string
        }
        Update: {
          execution_logical_id?: string
          line_key?: string
          movement_id?: string
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_execution_consumptions_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: true
            referencedRelation: "meal_inventory_movements"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_fiscal_documents: {
        Row: {
          author_engagement: string | null
          author_person_id: string | null
          author_principal_id: string | null
          author_user_id: string
          id: string
          issued_on: string | null
          issuer_ref: string | null
          logical_id: string
          number: string
          reason: string | null
          recorded_at: string
          schedule_logical_id: string | null
          school_id: string
          sha256: string
          status: string
          storage_ref: string | null
          supersedes_id: string | null
          version: number
        }
        Insert: {
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id: string
          id?: string
          issued_on?: string | null
          issuer_ref?: string | null
          logical_id: string
          number: string
          reason?: string | null
          recorded_at?: string
          schedule_logical_id?: string | null
          school_id: string
          sha256: string
          status: string
          storage_ref?: string | null
          supersedes_id?: string | null
          version: number
        }
        Update: {
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id?: string
          id?: string
          issued_on?: string | null
          issuer_ref?: string | null
          logical_id?: string
          number?: string
          reason?: string | null
          recorded_at?: string
          schedule_logical_id?: string | null
          school_id?: string
          sha256?: string
          status?: string
          storage_ref?: string | null
          supersedes_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_fiscal_documents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_fiscal_documents_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "meal_fiscal_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_forecasts: {
        Row: {
          author_engagement: string | null
          author_principal_id: string | null
          author_user_id: string
          basis: string
          event_kind: string
          forecast_count: number
          id: string
          logical_id: string
          meal_slot_value_id: string
          reason: string | null
          recorded_at: string
          school_id: string
          served_on: string
          supersedes_id: string | null
          version: number
        }
        Insert: {
          author_engagement?: string | null
          author_principal_id?: string | null
          author_user_id: string
          basis: string
          event_kind: string
          forecast_count: number
          id?: string
          logical_id: string
          meal_slot_value_id: string
          reason?: string | null
          recorded_at?: string
          school_id: string
          served_on: string
          supersedes_id?: string | null
          version: number
        }
        Update: {
          author_engagement?: string | null
          author_principal_id?: string | null
          author_user_id?: string
          basis?: string
          event_kind?: string
          forecast_count?: number
          id?: string
          logical_id?: string
          meal_slot_value_id?: string
          reason?: string | null
          recorded_at?: string
          school_id?: string
          served_on?: string
          supersedes_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_forecasts_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "meal_forecasts"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_inventory_movements: {
        Row: {
          author_engagement: string | null
          author_person_id: string | null
          author_principal_id: string | null
          author_user_id: string
          contract_ref: string | null
          delivery_schedule_ref: string | null
          direction: number | null
          event_kind: string
          expires_on: string | null
          id: string
          item_value_id: string
          item_value_version: number
          logical_id: string
          lot: string | null
          moved_on: string
          movement_class: string | null
          movement_kind: string
          note: string | null
          quantity: number
          reason: string | null
          recorded_at: string
          school_id: string
          source_document_ref: string | null
          source_literal: string | null
          source_receipt_version_id: string | null
          stock_count_ref: string | null
          supersedes_id: string | null
          transfer_pair_id: string | null
          transfer_peer_school: string | null
          unit_value_id: string
          unit_value_version: number
          version: number
        }
        Insert: {
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id: string
          contract_ref?: string | null
          delivery_schedule_ref?: string | null
          direction?: number | null
          event_kind: string
          expires_on?: string | null
          id?: string
          item_value_id: string
          item_value_version: number
          logical_id: string
          lot?: string | null
          moved_on: string
          movement_class?: string | null
          movement_kind: string
          note?: string | null
          quantity: number
          reason?: string | null
          recorded_at?: string
          school_id: string
          source_document_ref?: string | null
          source_literal?: string | null
          source_receipt_version_id?: string | null
          stock_count_ref?: string | null
          supersedes_id?: string | null
          transfer_pair_id?: string | null
          transfer_peer_school?: string | null
          unit_value_id: string
          unit_value_version: number
          version: number
        }
        Update: {
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id?: string
          contract_ref?: string | null
          delivery_schedule_ref?: string | null
          direction?: number | null
          event_kind?: string
          expires_on?: string | null
          id?: string
          item_value_id?: string
          item_value_version?: number
          logical_id?: string
          lot?: string | null
          moved_on?: string
          movement_class?: string | null
          movement_kind?: string
          note?: string | null
          quantity?: number
          reason?: string | null
          recorded_at?: string
          school_id?: string
          source_document_ref?: string | null
          source_literal?: string | null
          source_receipt_version_id?: string | null
          stock_count_ref?: string | null
          supersedes_id?: string | null
          transfer_pair_id?: string | null
          transfer_peer_school?: string | null
          unit_value_id?: string
          unit_value_version?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_inventory_movements_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "meal_inventory_movements"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_kitchen_school_links: {
        Row: {
          author_engagement: string | null
          author_person_id: string | null
          author_principal_id: string | null
          author_user_id: string
          event_kind: string
          id: string
          kitchen_id: string
          logical_id: string
          reason: string | null
          recorded_at: string
          school_id: string
          supersedes_id: string | null
          valid_from: string
          valid_to: string | null
          version: number
        }
        Insert: {
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id: string
          event_kind: string
          id?: string
          kitchen_id: string
          logical_id: string
          reason?: string | null
          recorded_at?: string
          school_id: string
          supersedes_id?: string | null
          valid_from: string
          valid_to?: string | null
          version: number
        }
        Update: {
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id?: string
          event_kind?: string
          id?: string
          kitchen_id?: string
          logical_id?: string
          reason?: string | null
          recorded_at?: string
          school_id?: string
          supersedes_id?: string | null
          valid_from?: string
          valid_to?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_kitchen_school_links_kitchen_id_fkey"
            columns: ["kitchen_id"]
            isOneToOne: false
            referencedRelation: "meal_kitchens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_kitchen_school_links_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "meal_kitchen_school_links"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_kitchen_versions: {
        Row: {
          author_engagement: string | null
          author_person_id: string | null
          author_principal_id: string | null
          author_user_id: string
          host_school_id: string | null
          id: string
          kitchen_id: string
          name: string
          reason: string | null
          recorded_at: string
          supersedes_id: string | null
          valid_from: string
          valid_to: string | null
          version: number
        }
        Insert: {
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id: string
          host_school_id?: string | null
          id?: string
          kitchen_id: string
          name: string
          reason?: string | null
          recorded_at?: string
          supersedes_id?: string | null
          valid_from: string
          valid_to?: string | null
          version: number
        }
        Update: {
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id?: string
          host_school_id?: string | null
          id?: string
          kitchen_id?: string
          name?: string
          reason?: string | null
          recorded_at?: string
          supersedes_id?: string | null
          valid_from?: string
          valid_to?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_kitchen_versions_kitchen_id_fkey"
            columns: ["kitchen_id"]
            isOneToOne: false
            referencedRelation: "meal_kitchens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_kitchen_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "meal_kitchen_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_kitchens: {
        Row: {
          created_at: string
          id: string
        }
        Insert: {
          created_at?: string
          id?: string
        }
        Update: {
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      meal_master_records: {
        Row: {
          author_engagement: string | null
          author_person_id: string | null
          author_principal_id: string | null
          author_user_id: string
          id: string
          kind: string
          logical_id: string
          payload: Json
          reason: string | null
          recorded_at: string
          school_id: string | null
          source_staging_id: string | null
          status: string
          supersedes_id: string | null
          valid_from: string
          valid_to: string | null
          version: number
        }
        Insert: {
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id: string
          id?: string
          kind: string
          logical_id: string
          payload: Json
          reason?: string | null
          recorded_at?: string
          school_id?: string | null
          source_staging_id?: string | null
          status: string
          supersedes_id?: string | null
          valid_from: string
          valid_to?: string | null
          version: number
        }
        Update: {
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id?: string
          id?: string
          kind?: string
          logical_id?: string
          payload?: Json
          reason?: string | null
          recorded_at?: string
          school_id?: string | null
          source_staging_id?: string | null
          status?: string
          supersedes_id?: string | null
          valid_from?: string
          valid_to?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_master_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_master_records_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "meal_master_records"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_menu_publications: {
        Row: {
          action: string
          author_engagement: string | null
          author_person_id: string | null
          author_principal_id: string | null
          author_user_id: string
          id: string
          menu_logical_id: string
          menu_version_id: string
          reason: string | null
          recorded_at: string
          school_id: string
          sequence: number
        }
        Insert: {
          action: string
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id: string
          id?: string
          menu_logical_id: string
          menu_version_id: string
          reason?: string | null
          recorded_at?: string
          school_id: string
          sequence: number
        }
        Update: {
          action?: string
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id?: string
          id?: string
          menu_logical_id?: string
          menu_version_id?: string
          reason?: string | null
          recorded_at?: string
          school_id?: string
          sequence?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_menu_publications_menu_version_id_fkey"
            columns: ["menu_version_id"]
            isOneToOne: false
            referencedRelation: "meal_menu_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_menu_versions: {
        Row: {
          author_engagement: string | null
          author_principal_id: string | null
          author_user_id: string
          ends_on: string
          entries: Json
          event_kind: string
          id: string
          logical_id: string
          reason: string | null
          recorded_at: string
          school_id: string
          service_group_value_id: string | null
          starts_on: string
          supersedes_id: string | null
          version: number
        }
        Insert: {
          author_engagement?: string | null
          author_principal_id?: string | null
          author_user_id: string
          ends_on: string
          entries: Json
          event_kind: string
          id?: string
          logical_id: string
          reason?: string | null
          recorded_at?: string
          school_id: string
          service_group_value_id?: string | null
          starts_on: string
          supersedes_id?: string | null
          version: number
        }
        Update: {
          author_engagement?: string | null
          author_principal_id?: string | null
          author_user_id?: string
          ends_on?: string
          entries?: Json
          event_kind?: string
          id?: string
          logical_id?: string
          reason?: string | null
          recorded_at?: string
          school_id?: string
          service_group_value_id?: string | null
          starts_on?: string
          supersedes_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_menu_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "meal_menu_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_nonconformities: {
        Row: {
          author_engagement: string | null
          author_person_id: string | null
          author_principal_id: string | null
          author_user_id: string
          deadline_rule_ref: string | null
          evidence_refs: string[]
          id: string
          item_ref: string | null
          logical_id: string
          motive: string
          note: string | null
          reason: string | null
          receipt_logical_id: string | null
          recorded_at: string
          returned_qty: number | null
          schedule_logical_id: string | null
          school_id: string
          status: string
          supersedes_id: string | null
          supplier_ref: string | null
          version: number
        }
        Insert: {
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id: string
          deadline_rule_ref?: string | null
          evidence_refs?: string[]
          id?: string
          item_ref?: string | null
          logical_id: string
          motive: string
          note?: string | null
          reason?: string | null
          receipt_logical_id?: string | null
          recorded_at?: string
          returned_qty?: number | null
          schedule_logical_id?: string | null
          school_id: string
          status: string
          supersedes_id?: string | null
          supplier_ref?: string | null
          version: number
        }
        Update: {
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id?: string
          deadline_rule_ref?: string | null
          evidence_refs?: string[]
          id?: string
          item_ref?: string | null
          logical_id?: string
          motive?: string
          note?: string | null
          reason?: string | null
          receipt_logical_id?: string | null
          recorded_at?: string
          returned_qty?: number | null
          schedule_logical_id?: string | null
          school_id?: string
          status?: string
          supersedes_id?: string | null
          supplier_ref?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_nonconformities_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_nonconformities_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "meal_nonconformities"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_operational_records: {
        Row: {
          author_engagement: string | null
          author_principal_id: string | null
          author_user_id: string
          event_kind: string
          field_values: Json
          id: string
          logical_id: string
          meal_slot_value_id: string | null
          model_ref: string
          reason: string | null
          recorded_at: string
          recorded_on: string
          school_id: string
          signed_by_person_id: string
          supersedes_id: string | null
          version: number
        }
        Insert: {
          author_engagement?: string | null
          author_principal_id?: string | null
          author_user_id: string
          event_kind: string
          field_values: Json
          id?: string
          logical_id: string
          meal_slot_value_id?: string | null
          model_ref: string
          reason?: string | null
          recorded_at?: string
          recorded_on: string
          school_id: string
          signed_by_person_id: string
          supersedes_id?: string | null
          version: number
        }
        Update: {
          author_engagement?: string | null
          author_principal_id?: string | null
          author_user_id?: string
          event_kind?: string
          field_values?: Json
          id?: string
          logical_id?: string
          meal_slot_value_id?: string | null
          model_ref?: string
          reason?: string | null
          recorded_at?: string
          recorded_on?: string
          school_id?: string
          signed_by_person_id?: string
          supersedes_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_operational_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_operational_records_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "meal_operational_records"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_order_opinions: {
        Row: {
          author_engagement: string | null
          author_person_id: string | null
          author_principal_id: string | null
          author_user_id: string
          id: string
          opinion: string
          order_version_id: string
          recorded_at: string
        }
        Insert: {
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id: string
          id?: string
          opinion: string
          order_version_id: string
          recorded_at?: string
        }
        Update: {
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id?: string
          id?: string
          opinion?: string
          order_version_id?: string
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_order_opinions_order_version_id_fkey"
            columns: ["order_version_id"]
            isOneToOne: false
            referencedRelation: "meal_order_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_order_versions: {
        Row: {
          author_engagement: string | null
          author_person_id: string | null
          author_principal_id: string | null
          author_user_id: string
          competence: string
          id: string
          lines: Json
          logical_id: string
          reason: string | null
          recorded_at: string
          school_id: string
          status: string
          supersedes_id: string | null
          version: number
          window_version_id: string
        }
        Insert: {
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id: string
          competence: string
          id?: string
          lines: Json
          logical_id: string
          reason?: string | null
          recorded_at?: string
          school_id: string
          status: string
          supersedes_id?: string | null
          version: number
          window_version_id: string
        }
        Update: {
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id?: string
          competence?: string
          id?: string
          lines?: Json
          logical_id?: string
          reason?: string | null
          recorded_at?: string
          school_id?: string
          status?: string
          supersedes_id?: string | null
          version?: number
          window_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_order_versions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_order_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "meal_order_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_order_versions_window_version_id_fkey"
            columns: ["window_version_id"]
            isOneToOne: false
            referencedRelation: "meal_order_windows"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_order_windows: {
        Row: {
          action: string
          author_engagement: string | null
          author_person_id: string | null
          author_principal_id: string | null
          author_user_id: string
          basis: string
          closes_at: string
          competence: string
          id: string
          logical_id: string
          opens_at: string
          reason: string | null
          recorded_at: string
          rule_ref: string | null
          school_ids: string[] | null
          supersedes_id: string | null
          time_zone: string
          version: number
        }
        Insert: {
          action: string
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id: string
          basis: string
          closes_at: string
          competence: string
          id?: string
          logical_id: string
          opens_at: string
          reason?: string | null
          recorded_at?: string
          rule_ref?: string | null
          school_ids?: string[] | null
          supersedes_id?: string | null
          time_zone: string
          version: number
        }
        Update: {
          action?: string
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id?: string
          basis?: string
          closes_at?: string
          competence?: string
          id?: string
          logical_id?: string
          opens_at?: string
          reason?: string | null
          recorded_at?: string
          rule_ref?: string | null
          school_ids?: string[] | null
          supersedes_id?: string | null
          time_zone?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_order_windows_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "meal_order_windows"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_receipts: {
        Row: {
          accepted_qty: number
          author_engagement: string | null
          author_person_id: string | null
          author_principal_id: string | null
          author_user_id: string
          brand_observed: string | null
          checklist: Json
          checklist_ref: string | null
          condition_note: string | null
          delivered_qty: number
          evidence_refs: string[]
          expires_on: string | null
          fiscal_document_logical_id: string | null
          id: string
          logical_id: string
          lot: string | null
          note: string | null
          reason: string | null
          received_at: string
          recorded_at: string
          rejected_qty: number
          schedule_logical_id: string
          school_id: string
          spec_observed: string | null
          status: string
          supersedes_id: string | null
          temperature: number | null
          time_zone: string
          version: number
        }
        Insert: {
          accepted_qty: number
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id: string
          brand_observed?: string | null
          checklist?: Json
          checklist_ref?: string | null
          condition_note?: string | null
          delivered_qty: number
          evidence_refs?: string[]
          expires_on?: string | null
          fiscal_document_logical_id?: string | null
          id?: string
          logical_id: string
          lot?: string | null
          note?: string | null
          reason?: string | null
          received_at: string
          recorded_at?: string
          rejected_qty: number
          schedule_logical_id: string
          school_id: string
          spec_observed?: string | null
          status: string
          supersedes_id?: string | null
          temperature?: number | null
          time_zone: string
          version: number
        }
        Update: {
          accepted_qty?: number
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id?: string
          brand_observed?: string | null
          checklist?: Json
          checklist_ref?: string | null
          condition_note?: string | null
          delivered_qty?: number
          evidence_refs?: string[]
          expires_on?: string | null
          fiscal_document_logical_id?: string | null
          id?: string
          logical_id?: string
          lot?: string | null
          note?: string | null
          reason?: string | null
          received_at?: string
          recorded_at?: string
          rejected_qty?: number
          schedule_logical_id?: string
          school_id?: string
          spec_observed?: string | null
          status?: string
          supersedes_id?: string | null
          temperature?: number | null
          time_zone?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_receipts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_receipts_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "meal_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_sensitive_access_events: {
        Row: {
          author_user_id: string
          consulted_on: string
          id: string
          purpose: string
          recorded_at: string
          rows_returned: number
          school_id: string
        }
        Insert: {
          author_user_id: string
          consulted_on: string
          id?: string
          purpose: string
          recorded_at?: string
          rows_returned: number
          school_id: string
        }
        Update: {
          author_user_id?: string
          consulted_on?: string
          id?: string
          purpose?: string
          recorded_at?: string
          rows_returned?: number
          school_id?: string
        }
        Relationships: []
      }
      meal_service_records: {
        Row: {
          author_engagement: string | null
          author_principal_id: string | null
          author_user_id: string
          event_kind: string
          id: string
          logical_id: string
          meal_slot_value_id: string
          offered_count: number | null
          reason: string | null
          recorded_at: string
          school_id: string
          served_count: number | null
          served_on: string
          source_note: string | null
          supersedes_id: string | null
          version: number
        }
        Insert: {
          author_engagement?: string | null
          author_principal_id?: string | null
          author_user_id: string
          event_kind: string
          id?: string
          logical_id: string
          meal_slot_value_id: string
          offered_count?: number | null
          reason?: string | null
          recorded_at?: string
          school_id: string
          served_count?: number | null
          served_on: string
          source_note?: string | null
          supersedes_id?: string | null
          version: number
        }
        Update: {
          author_engagement?: string | null
          author_principal_id?: string | null
          author_user_id?: string
          event_kind?: string
          id?: string
          logical_id?: string
          meal_slot_value_id?: string
          offered_count?: number | null
          reason?: string | null
          recorded_at?: string
          school_id?: string
          served_count?: number | null
          served_on?: string
          source_note?: string | null
          supersedes_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_service_records_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "meal_service_records"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_stock_closings: {
        Row: {
          author_engagement: string | null
          author_person_id: string | null
          author_principal_id: string | null
          author_user_id: string
          balances: Json
          closing_on: string
          competence: string
          id: string
          known_at: string
          manifest_sha256: string
          movement_ids: string[]
          reason: string | null
          recorded_at: string
          school_id: string
          supersedes_id: string | null
          version: number
        }
        Insert: {
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id: string
          balances: Json
          closing_on: string
          competence: string
          id?: string
          known_at: string
          manifest_sha256: string
          movement_ids: string[]
          reason?: string | null
          recorded_at?: string
          school_id: string
          supersedes_id?: string | null
          version: number
        }
        Update: {
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id?: string
          balances?: Json
          closing_on?: string
          competence?: string
          id?: string
          known_at?: string
          manifest_sha256?: string
          movement_ids?: string[]
          reason?: string | null
          recorded_at?: string
          school_id?: string
          supersedes_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_stock_closings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_stock_closings_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "meal_stock_closings"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_stock_counts: {
        Row: {
          author_engagement: string | null
          author_person_id: string | null
          author_principal_id: string | null
          author_user_id: string
          counted_on: string
          id: string
          lines: Json
          logical_id: string
          reason: string | null
          recorded_at: string
          school_id: string
          status: string
          supersedes_id: string | null
          version: number
        }
        Insert: {
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id: string
          counted_on: string
          id?: string
          lines: Json
          logical_id: string
          reason?: string | null
          recorded_at?: string
          school_id: string
          status: string
          supersedes_id?: string | null
          version: number
        }
        Update: {
          author_engagement?: string | null
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id?: string
          counted_on?: string
          id?: string
          lines?: Json
          logical_id?: string
          reason?: string | null
          recorded_at?: string
          school_id?: string
          status?: string
          supersedes_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_stock_counts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_stock_counts_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "meal_stock_counts"
            referencedColumns: ["id"]
          },
        ]
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
      notification_deliveries: {
        Row: {
          channel: string
          event_id: string
          id: string
          recipient_user_id: string
          recorded_at: string
          rule_version_id: string
          template_version_id: string
        }
        Insert: {
          channel?: string
          event_id: string
          id?: string
          recipient_user_id: string
          recorded_at?: string
          rule_version_id: string
          template_version_id: string
        }
        Update: {
          channel?: string
          event_id?: string
          id?: string
          recipient_user_id?: string
          recorded_at?: string
          rule_version_id?: string
          template_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "notification_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_rule_version_id_fkey"
            columns: ["rule_version_id"]
            isOneToOne: false
            referencedRelation: "notification_delivery_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "notification_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_delivery_rules: {
        Row: {
          author_user_id: string
          basis_capability: string | null
          basis_section: string | null
          event_kind: string
          id: string
          logical_id: string
          reason: string | null
          recipient_basis: string
          recorded_at: string
          retired: boolean
          supersedes_id: string | null
          template_key: string
          version: number
        }
        Insert: {
          author_user_id: string
          basis_capability?: string | null
          basis_section?: string | null
          event_kind: string
          id?: string
          logical_id: string
          reason?: string | null
          recipient_basis: string
          recorded_at?: string
          retired?: boolean
          supersedes_id?: string | null
          template_key: string
          version: number
        }
        Update: {
          author_user_id?: string
          basis_capability?: string | null
          basis_section?: string | null
          event_kind?: string
          id?: string
          logical_id?: string
          reason?: string | null
          recipient_basis?: string
          recorded_at?: string
          retired?: boolean
          supersedes_id?: string | null
          template_key?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "notification_delivery_rules_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "notification_delivery_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_event_cancellations: {
        Row: {
          cancelled_by: string
          event_id: string
          reason: string
          recorded_at: string
        }
        Insert: {
          cancelled_by: string
          event_id: string
          reason: string
          recorded_at?: string
        }
        Update: {
          cancelled_by?: string
          event_id?: string
          reason?: string
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_event_cancellations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "notification_events"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_events: {
        Row: {
          deep_link: string | null
          emitted_by: string
          emitted_engagement: string
          event_key: string
          event_kind: string
          expires_at: string | null
          id: string
          payload: Json
          recorded_at: string
          school_id: string
          subject_student_id: string | null
        }
        Insert: {
          deep_link?: string | null
          emitted_by: string
          emitted_engagement: string
          event_key: string
          event_kind: string
          expires_at?: string | null
          id?: string
          payload?: Json
          recorded_at?: string
          school_id: string
          subject_student_id?: string | null
        }
        Update: {
          deep_link?: string | null
          emitted_by?: string
          emitted_engagement?: string
          event_key?: string
          event_kind?: string
          expires_at?: string | null
          id?: string
          payload?: Json
          recorded_at?: string
          school_id?: string
          subject_student_id?: string | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          event_kind: string
          id: string
          opted_out: boolean
          recorded_at: string
          user_id: string
        }
        Insert: {
          event_kind: string
          id?: string
          opted_out: boolean
          recorded_at?: string
          user_id: string
        }
        Update: {
          event_kind?: string
          id?: string
          opted_out?: boolean
          recorded_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_reads: {
        Row: {
          delivery_id: string
          read_at: string
        }
        Insert: {
          delivery_id: string
          read_at?: string
        }
        Update: {
          delivery_id?: string
          read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: true
            referencedRelation: "notification_deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_template_versions: {
        Row: {
          allowed_variables: string[]
          author_user_id: string
          body: string
          external_summary: string
          id: string
          mandatory: boolean
          reason: string | null
          recorded_at: string
          retired: boolean
          supersedes_id: string | null
          template_key: string
          title: string
          version: number
        }
        Insert: {
          allowed_variables?: string[]
          author_user_id: string
          body: string
          external_summary: string
          id?: string
          mandatory: boolean
          reason?: string | null
          recorded_at?: string
          retired?: boolean
          supersedes_id?: string | null
          template_key: string
          title: string
          version: number
        }
        Update: {
          allowed_variables?: string[]
          author_user_id?: string
          body?: string
          external_summary?: string
          id?: string
          mandatory?: boolean
          reason?: string | null
          recorded_at?: string
          retired?: boolean
          supersedes_id?: string | null
          template_key?: string
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "notification_template_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "notification_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_task_events: {
        Row: {
          actor: string
          assignee_engagement: string | null
          comment: string | null
          id: string
          idempotency_key: string
          kind: string
          recorded_at: string
          seq: number
          status: string | null
          task_id: string
        }
        Insert: {
          actor: string
          assignee_engagement?: string | null
          comment?: string | null
          id?: string
          idempotency_key: string
          kind: string
          recorded_at?: string
          seq: number
          status?: string | null
          task_id: string
        }
        Update: {
          actor?: string
          assignee_engagement?: string | null
          comment?: string | null
          id?: string
          idempotency_key?: string
          kind?: string
          recorded_at?: string
          seq?: number
          status?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_task_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "operational_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_task_priorities: {
        Row: {
          id: string
          label: string
          ordinal: number
          recorded_at: string
          recorded_by: string
        }
        Insert: {
          id: string
          label: string
          ordinal: number
          recorded_at?: string
          recorded_by: string
        }
        Update: {
          id?: string
          label?: string
          ordinal?: number
          recorded_at?: string
          recorded_by?: string
        }
        Relationships: []
      }
      operational_tasks: {
        Row: {
          created_at: string
          created_by: string
          dedupe_key: string
          description: string | null
          due_on: string | null
          id: string
          priority_id: string | null
          recurrence: Json | null
          school_id: string
          source_kind: string | null
          source_ref: string | null
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          dedupe_key: string
          description?: string | null
          due_on?: string | null
          id?: string
          priority_id?: string | null
          recurrence?: Json | null
          school_id: string
          source_kind?: string | null
          source_ref?: string | null
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          dedupe_key?: string
          description?: string | null
          due_on?: string | null
          id?: string
          priority_id?: string | null
          recurrence?: Json | null
          school_id?: string
          source_kind?: string | null
          source_ref?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_tasks_priority_id_fkey"
            columns: ["priority_id"]
            isOneToOne: false
            referencedRelation: "operational_task_priorities"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_disclosure_versions: {
        Row: {
          author_engagement: string
          author_user_id: string
          event_kind: string
          id: string
          logical_id: string
          min_group_size: number
          reason: string | null
          recorded_at: string
          source_note: string
          supersedes_id: string | null
          version: number
        }
        Insert: {
          author_engagement: string
          author_user_id: string
          event_kind: string
          id?: string
          logical_id: string
          min_group_size: number
          reason?: string | null
          recorded_at?: string
          source_note: string
          supersedes_id?: string | null
          version: number
        }
        Update: {
          author_engagement?: string
          author_user_id?: string
          event_kind?: string
          id?: string
          logical_id?: string
          min_group_size?: number
          reason?: string | null
          recorded_at?: string
          source_note?: string
          supersedes_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "performance_disclosure_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "performance_disclosure_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_goals: {
        Row: {
          author_engagement: string
          author_user_id: string
          comparator: string
          event_kind: string
          id: string
          logical_id: string
          metric_version_id: string
          reason: string | null
          recorded_at: string
          school_id: string | null
          source_note: string
          supersedes_id: string | null
          target_value: number
          version: number
        }
        Insert: {
          author_engagement: string
          author_user_id: string
          comparator: string
          event_kind: string
          id?: string
          logical_id: string
          metric_version_id: string
          reason?: string | null
          recorded_at?: string
          school_id?: string | null
          source_note: string
          supersedes_id?: string | null
          target_value: number
          version: number
        }
        Update: {
          author_engagement?: string
          author_user_id?: string
          comparator?: string
          event_kind?: string
          id?: string
          logical_id?: string
          metric_version_id?: string
          reason?: string | null
          recorded_at?: string
          school_id?: string | null
          source_note?: string
          supersedes_id?: string | null
          target_value?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "performance_goals_metric_version_id_fkey"
            columns: ["metric_version_id"]
            isOneToOne: false
            referencedRelation: "performance_metric_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_goals_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "performance_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_metric_versions: {
        Row: {
          assessment_logical_id: string
          author_engagement: string
          author_user_id: string
          event_kind: string
          formula: Json
          id: string
          label: string
          logical_id: string
          population_key: string
          reason: string | null
          recorded_at: string
          source_note: string
          supersedes_id: string | null
          unit_label: string | null
          version: number
        }
        Insert: {
          assessment_logical_id: string
          author_engagement: string
          author_user_id: string
          event_kind: string
          formula: Json
          id?: string
          label: string
          logical_id: string
          population_key: string
          reason?: string | null
          recorded_at?: string
          source_note: string
          supersedes_id?: string | null
          unit_label?: string | null
          version: number
        }
        Update: {
          assessment_logical_id?: string
          author_engagement?: string
          author_user_id?: string
          event_kind?: string
          formula?: Json
          id?: string
          label?: string
          logical_id?: string
          population_key?: string
          reason?: string | null
          recorded_at?: string
          source_note?: string
          supersedes_id?: string | null
          unit_label?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "performance_metric_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "performance_metric_versions"
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
      professional_census_declarations: {
        Row: {
          class_code: string
          class_id: string | null
          function_literal: string
          functional_link_logical_id: string | null
          id: string
          known_at: string
          person_id: string
          regime_literal: string | null
          school_id: string
          source_hash: string
          source_locator: string | null
          technical_operation_id: string
          valid_from: string
        }
        Insert: {
          class_code: string
          class_id?: string | null
          function_literal: string
          functional_link_logical_id?: string | null
          id?: string
          known_at?: string
          person_id: string
          regime_literal?: string | null
          school_id: string
          source_hash: string
          source_locator?: string | null
          technical_operation_id: string
          valid_from: string
        }
        Update: {
          class_code?: string
          class_id?: string | null
          function_literal?: string
          functional_link_logical_id?: string | null
          id?: string
          known_at?: string
          person_id?: string
          regime_literal?: string | null
          school_id?: string
          source_hash?: string
          source_locator?: string | null
          technical_operation_id?: string
          valid_from?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_census_declarations_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "institutional_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_census_declarations_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_census_declarations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_census_declarations_technical_operation_id_fkey"
            columns: ["technical_operation_id"]
            isOneToOne: false
            referencedRelation: "technical_execution_operations"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_exercises: {
        Row: {
          author_user_id: string | null
          authorizing_engagement_id: string | null
          capability_policy_id: string | null
          capability_policy_version: number | null
          correction_reason: string | null
          function_id: string
          function_version: number
          functional_link_logical_id: string
          id: string
          logical_id: string
          posting_logical_id: string | null
          recorded_at: string
          revoked: boolean
          school_id: string
          source_ref: string | null
          supersedes_id: string | null
          technical_operation_id: string | null
          valid_from: string
          valid_until: string | null
          version: number
        }
        Insert: {
          author_user_id?: string | null
          authorizing_engagement_id?: string | null
          capability_policy_id?: string | null
          capability_policy_version?: number | null
          correction_reason?: string | null
          function_id: string
          function_version: number
          functional_link_logical_id: string
          id?: string
          logical_id: string
          posting_logical_id?: string | null
          recorded_at?: string
          revoked?: boolean
          school_id: string
          source_ref?: string | null
          supersedes_id?: string | null
          technical_operation_id?: string | null
          valid_from: string
          valid_until?: string | null
          version: number
        }
        Update: {
          author_user_id?: string | null
          authorizing_engagement_id?: string | null
          capability_policy_id?: string | null
          capability_policy_version?: number | null
          correction_reason?: string | null
          function_id?: string
          function_version?: number
          functional_link_logical_id?: string
          id?: string
          logical_id?: string
          posting_logical_id?: string | null
          recorded_at?: string
          revoked?: boolean
          school_id?: string
          source_ref?: string | null
          supersedes_id?: string | null
          technical_operation_id?: string | null
          valid_from?: string
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "professional_exercises_authorizing_engagement_id_fkey"
            columns: ["authorizing_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_exercises_capability_policy_id_fkey"
            columns: ["capability_policy_id"]
            isOneToOne: false
            referencedRelation: "capability_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_exercises_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_exercises_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "professional_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_exercises_technical_operation_id_fkey"
            columns: ["technical_operation_id"]
            isOneToOne: false
            referencedRelation: "technical_execution_operations"
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
          technical_operation_id: string | null
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
          technical_operation_id?: string | null
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
          technical_operation_id?: string | null
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
          {
            foreignKeyName: "professional_functional_links_technical_operation_id_fkey"
            columns: ["technical_operation_id"]
            isOneToOne: false
            referencedRelation: "technical_execution_operations"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_functional_processes: {
        Row: {
          author_user_id: string | null
          authorizing_engagement_id: string | null
          capability_policy_id: string | null
          capability_policy_version: number | null
          closed_on: string | null
          correction_reason: string | null
          functional_link_logical_id: string
          id: string
          logical_id: string
          opened_on: string
          process_kind_id: string
          process_kind_version: number
          recorded_at: string
          related_event_logical_id: string | null
          revoked: boolean
          school_id: string
          source_ref: string | null
          supersedes_id: string | null
          version: number
        }
        Insert: {
          author_user_id?: string | null
          authorizing_engagement_id?: string | null
          capability_policy_id?: string | null
          capability_policy_version?: number | null
          closed_on?: string | null
          correction_reason?: string | null
          functional_link_logical_id: string
          id?: string
          logical_id: string
          opened_on: string
          process_kind_id: string
          process_kind_version: number
          recorded_at?: string
          related_event_logical_id?: string | null
          revoked?: boolean
          school_id: string
          source_ref?: string | null
          supersedes_id?: string | null
          version: number
        }
        Update: {
          author_user_id?: string | null
          authorizing_engagement_id?: string | null
          capability_policy_id?: string | null
          capability_policy_version?: number | null
          closed_on?: string | null
          correction_reason?: string | null
          functional_link_logical_id?: string
          id?: string
          logical_id?: string
          opened_on?: string
          process_kind_id?: string
          process_kind_version?: number
          recorded_at?: string
          related_event_logical_id?: string | null
          revoked?: boolean
          school_id?: string
          source_ref?: string | null
          supersedes_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "professional_functional_processe_authorizing_engagement_id_fkey"
            columns: ["authorizing_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_functional_processes_capability_policy_id_fkey"
            columns: ["capability_policy_id"]
            isOneToOne: false
            referencedRelation: "capability_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_functional_processes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_functional_processes_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "professional_functional_processes"
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
      professional_qualifications: {
        Row: {
          author_user_id: string | null
          authorizing_engagement_id: string | null
          capability_policy_id: string | null
          capability_policy_version: number | null
          correction_reason: string | null
          id: string
          logical_id: string
          person_id: string
          qualification_id: string
          qualification_version: number
          recorded_at: string
          revoked: boolean
          school_id: string
          source_ref: string | null
          supersedes_id: string | null
          valid_from: string | null
          valid_until: string | null
          version: number
        }
        Insert: {
          author_user_id?: string | null
          authorizing_engagement_id?: string | null
          capability_policy_id?: string | null
          capability_policy_version?: number | null
          correction_reason?: string | null
          id?: string
          logical_id: string
          person_id: string
          qualification_id: string
          qualification_version: number
          recorded_at?: string
          revoked?: boolean
          school_id: string
          source_ref?: string | null
          supersedes_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
          version: number
        }
        Update: {
          author_user_id?: string | null
          authorizing_engagement_id?: string | null
          capability_policy_id?: string | null
          capability_policy_version?: number | null
          correction_reason?: string | null
          id?: string
          logical_id?: string
          person_id?: string
          qualification_id?: string
          qualification_version?: number
          recorded_at?: string
          revoked?: boolean
          school_id?: string
          source_ref?: string | null
          supersedes_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "professional_qualifications_authorizing_engagement_id_fkey"
            columns: ["authorizing_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_qualifications_capability_policy_id_fkey"
            columns: ["capability_policy_id"]
            isOneToOne: false
            referencedRelation: "capability_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_qualifications_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_qualifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_qualifications_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "professional_qualifications"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_schedule_declarations: {
        Row: {
          class_code: string
          class_id: string | null
          id: string
          issues: string[]
          known_at: string
          link_kind: string
          person_id: string | null
          person_ref: string
          schedule_text: string | null
          school_id: string
          source_hash: string
          source_locator: string
          status: string
          technical_operation_id: string
          total_minutes_declared: number | null
          valid_from: string
          weekly_minutes: number | null
        }
        Insert: {
          class_code: string
          class_id?: string | null
          id?: string
          issues?: string[]
          known_at?: string
          link_kind: string
          person_id?: string | null
          person_ref: string
          schedule_text?: string | null
          school_id: string
          source_hash: string
          source_locator: string
          status: string
          technical_operation_id: string
          total_minutes_declared?: number | null
          valid_from: string
          weekly_minutes?: number | null
        }
        Update: {
          class_code?: string
          class_id?: string | null
          id?: string
          issues?: string[]
          known_at?: string
          link_kind?: string
          person_id?: string | null
          person_ref?: string
          schedule_text?: string | null
          school_id?: string
          source_hash?: string
          source_locator?: string
          status?: string
          technical_operation_id?: string
          total_minutes_declared?: number | null
          valid_from?: string
          weekly_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "professional_schedule_declarations_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "institutional_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_schedule_declarations_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_schedule_declarations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_schedule_declarations_technical_operation_id_fkey"
            columns: ["technical_operation_id"]
            isOneToOne: false
            referencedRelation: "technical_execution_operations"
            referencedColumns: ["id"]
          },
        ]
      }
      public_publication_versions: {
        Row: {
          body: string
          id: string
          publication_id: string
          reason: string | null
          recorded_at: string
          recorded_by: string
          state: string
          summary: string | null
          title: string
          version: number
        }
        Insert: {
          body?: string
          id?: string
          publication_id: string
          reason?: string | null
          recorded_at?: string
          recorded_by?: string
          state: string
          summary?: string | null
          title: string
          version: number
        }
        Update: {
          body?: string
          id?: string
          publication_id?: string
          reason?: string | null
          recorded_at?: string
          recorded_by?: string
          state?: string
          summary?: string | null
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "public_publication_versions_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "public_publications"
            referencedColumns: ["id"]
          },
        ]
      }
      public_publications: {
        Row: {
          created_at: string
          created_by: string
          id: string
          kind: string
          slug: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          kind: string
          slug: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          kind?: string
          slug?: string
        }
        Relationships: []
      }
      report_template_versions: {
        Row: {
          archived: boolean
          choice: Json
          id: string
          idempotency_key: string
          name: string
          owner_id: string
          recorded_at: string
          sector: string
          version: number
        }
        Insert: {
          archived?: boolean
          choice: Json
          id?: string
          idempotency_key: string
          name: string
          owner_id?: string
          recorded_at?: string
          sector: string
          version?: number
        }
        Update: {
          archived?: boolean
          choice?: Json
          id?: string
          idempotency_key?: string
          name?: string
          owner_id?: string
          recorded_at?: string
          sector?: string
          version?: number
        }
        Relationships: []
      }
      school_communication_acts: {
        Row: {
          act: string
          author_engagement: string
          author_person_id: string
          author_user_id: string
          communication_id: string
          id: string
          reason: string | null
          recorded_at: string
          sequence: number
          version_id: string
        }
        Insert: {
          act: string
          author_engagement: string
          author_person_id: string
          author_user_id: string
          communication_id: string
          id?: string
          reason?: string | null
          recorded_at?: string
          sequence: number
          version_id: string
        }
        Update: {
          act?: string
          author_engagement?: string
          author_person_id?: string
          author_user_id?: string
          communication_id?: string
          id?: string
          reason?: string | null
          recorded_at?: string
          sequence?: number
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_communication_acts_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "school_communications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_communication_acts_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "school_communication_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      school_communication_receipts: {
        Row: {
          communication_id: string
          id: string
          kind: string
          reader_user_id: string
          recorded_at: string
          student_id: string | null
          version_id: string
        }
        Insert: {
          communication_id: string
          id?: string
          kind: string
          reader_user_id: string
          recorded_at?: string
          student_id?: string | null
          version_id: string
        }
        Update: {
          communication_id?: string
          id?: string
          kind?: string
          reader_user_id?: string
          recorded_at?: string
          student_id?: string | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_communication_receipts_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "school_communications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_communication_receipts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "institutional_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_communication_receipts_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "school_communication_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      school_communication_versions: {
        Row: {
          audience_kind: string
          author_capability: string
          author_engagement: string
          author_person_id: string
          author_user_id: string
          body: string
          class_id: string | null
          communication_id: string
          id: string
          reason: string | null
          recorded_at: string
          requires_acknowledgement: boolean
          supersedes_id: string | null
          title: string
          version: number
        }
        Insert: {
          audience_kind: string
          author_capability: string
          author_engagement: string
          author_person_id: string
          author_user_id: string
          body: string
          class_id?: string | null
          communication_id: string
          id?: string
          reason?: string | null
          recorded_at?: string
          requires_acknowledgement?: boolean
          supersedes_id?: string | null
          title: string
          version: number
        }
        Update: {
          audience_kind?: string
          author_capability?: string
          author_engagement?: string
          author_person_id?: string
          author_user_id?: string
          body?: string
          class_id?: string | null
          communication_id?: string
          id?: string
          reason?: string | null
          recorded_at?: string
          requires_acknowledgement?: boolean
          supersedes_id?: string | null
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "school_communication_versions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "institutional_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_communication_versions_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "school_communications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_communication_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "school_communication_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      school_communications: {
        Row: {
          created_at: string
          id: string
          school_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          school_id: string
        }
        Update: {
          created_at?: string
          id?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_communications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
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
          recorded_by_engagement: string | null
          recorded_by_principal_id: string | null
          replacement_emission_id: string | null
        }
        Insert: {
          emission_id: string
          event_kind: string
          id?: string
          reason: string
          recorded_at?: string
          recorded_by: string
          recorded_by_engagement?: string | null
          recorded_by_principal_id?: string | null
          replacement_emission_id?: string | null
        }
        Update: {
          emission_id?: string
          event_kind?: string
          id?: string
          reason?: string
          recorded_at?: string
          recorded_by?: string
          recorded_by_engagement?: string | null
          recorded_by_principal_id?: string | null
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
            foreignKeyName: "school_document_emission_events_recorded_by_principal_id_fkey"
            columns: ["recorded_by_principal_id"]
            isOneToOne: false
            referencedRelation: "institutional_sector_principals"
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
      school_document_emission_requests: {
        Row: {
          created_at: string
          idempotency_key: string
          request_digest: string
          requested_by: string
          result: Json
        }
        Insert: {
          created_at?: string
          idempotency_key: string
          request_digest: string
          requested_by: string
          result: Json
        }
        Update: {
          created_at?: string
          idempotency_key?: string
          request_digest?: string
          requested_by?: string
          result?: Json
        }
        Relationships: []
      }
      school_document_emissions: {
        Row: {
          context: Json
          document_kind: string
          emission_kind: string
          emission_number: string | null
          emitted_at: string
          emitted_by: string
          emitted_by_engagement: string | null
          emitted_by_person: string | null
          emitted_by_principal_id: string | null
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
          emitted_by_engagement?: string | null
          emitted_by_person?: string | null
          emitted_by_principal_id?: string | null
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
          emitted_by_engagement?: string | null
          emitted_by_person?: string | null
          emitted_by_principal_id?: string | null
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
            foreignKeyName: "school_document_emissions_emitted_by_principal_id_fkey"
            columns: ["emitted_by_principal_id"]
            isOneToOne: false
            referencedRelation: "institutional_sector_principals"
            referencedColumns: ["id"]
          },
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
          technical_operation_id: string | null
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
          technical_operation_id?: string | null
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
          technical_operation_id?: string | null
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
          {
            foreignKeyName: "school_enrollments_technical_operation_id_fkey"
            columns: ["technical_operation_id"]
            isOneToOne: false
            referencedRelation: "technical_execution_operations"
            referencedColumns: ["id"]
          },
        ]
      }
      school_infrastructure_attribute_versions: {
        Row: {
          attribute_id: string
          author_person_id: string | null
          author_user_id: string | null
          authorizing_engagement_id: string | null
          catalog_values: string[] | null
          id: string
          label: string
          recorded_at: string
          source_field: string | null
          source_ref: string | null
          supersedes_version_id: string | null
          technical_operation_id: string | null
          unit_label: string | null
          value_type: string
          version_number: number
        }
        Insert: {
          attribute_id: string
          author_person_id?: string | null
          author_user_id?: string | null
          authorizing_engagement_id?: string | null
          catalog_values?: string[] | null
          id?: string
          label: string
          recorded_at?: string
          source_field?: string | null
          source_ref?: string | null
          supersedes_version_id?: string | null
          technical_operation_id?: string | null
          unit_label?: string | null
          value_type: string
          version_number: number
        }
        Update: {
          attribute_id?: string
          author_person_id?: string | null
          author_user_id?: string | null
          authorizing_engagement_id?: string | null
          catalog_values?: string[] | null
          id?: string
          label?: string
          recorded_at?: string
          source_field?: string | null
          source_ref?: string | null
          supersedes_version_id?: string | null
          technical_operation_id?: string | null
          unit_label?: string | null
          value_type?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "school_infrastructure_attribute_ver_technical_operation_id_fkey"
            columns: ["technical_operation_id"]
            isOneToOne: false
            referencedRelation: "technical_execution_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_infrastructure_attribute_vers_supersedes_version_id_fkey"
            columns: ["supersedes_version_id"]
            isOneToOne: false
            referencedRelation: "school_infrastructure_attribute_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      school_infrastructure_observations: {
        Row: {
          attribute_id: string
          attribute_version_id: string
          author_person_id: string | null
          author_user_id: string | null
          authorizing_engagement_id: string | null
          id: string
          known_at: string
          school_id: string
          source_hash: string
          source_locator: string | null
          source_ref: string
          technical_operation_id: string | null
          valid_from: string
          value_boolean: boolean | null
          value_catalog: string | null
          value_decimal: number | null
          value_integer: number | null
          value_text: string | null
        }
        Insert: {
          attribute_id: string
          attribute_version_id: string
          author_person_id?: string | null
          author_user_id?: string | null
          authorizing_engagement_id?: string | null
          id?: string
          known_at?: string
          school_id: string
          source_hash: string
          source_locator?: string | null
          source_ref: string
          technical_operation_id?: string | null
          valid_from: string
          value_boolean?: boolean | null
          value_catalog?: string | null
          value_decimal?: number | null
          value_integer?: number | null
          value_text?: string | null
        }
        Update: {
          attribute_id?: string
          attribute_version_id?: string
          author_person_id?: string | null
          author_user_id?: string | null
          authorizing_engagement_id?: string | null
          id?: string
          known_at?: string
          school_id?: string
          source_hash?: string
          source_locator?: string | null
          source_ref?: string
          technical_operation_id?: string | null
          valid_from?: string
          value_boolean?: boolean | null
          value_catalog?: string | null
          value_decimal?: number | null
          value_integer?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_infrastructure_observations_attribute_version_id_fkey"
            columns: ["attribute_version_id"]
            isOneToOne: false
            referencedRelation: "school_infrastructure_attribute_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_infrastructure_observations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_infrastructure_observations_technical_operation_id_fkey"
            columns: ["technical_operation_id"]
            isOneToOne: false
            referencedRelation: "technical_execution_operations"
            referencedColumns: ["id"]
          },
        ]
      }
      school_pedagogical_records: {
        Row: {
          author_engagement: string
          author_person_id: string | null
          author_user_id: string
          body: string
          category_scheme_id: string
          category_value_id: string
          category_value_version: number
          event_kind: string
          id: string
          logical_id: string
          occurred_on: string
          period_id: string | null
          reason: string | null
          recorded_at: string
          referral: string | null
          responsible_person_id: string | null
          return_on: string | null
          school_id: string
          status_value_id: string | null
          status_value_version: number | null
          subject_id: string
          subject_kind: string
          supersedes_id: string | null
          version: number
          visibility: string
        }
        Insert: {
          author_engagement: string
          author_person_id?: string | null
          author_user_id: string
          body: string
          category_scheme_id: string
          category_value_id: string
          category_value_version: number
          event_kind: string
          id?: string
          logical_id: string
          occurred_on: string
          period_id?: string | null
          reason?: string | null
          recorded_at?: string
          referral?: string | null
          responsible_person_id?: string | null
          return_on?: string | null
          school_id: string
          status_value_id?: string | null
          status_value_version?: number | null
          subject_id: string
          subject_kind: string
          supersedes_id?: string | null
          version: number
          visibility: string
        }
        Update: {
          author_engagement?: string
          author_person_id?: string | null
          author_user_id?: string
          body?: string
          category_scheme_id?: string
          category_value_id?: string
          category_value_version?: number
          event_kind?: string
          id?: string
          logical_id?: string
          occurred_on?: string
          period_id?: string | null
          reason?: string | null
          recorded_at?: string
          referral?: string | null
          responsible_person_id?: string | null
          return_on?: string | null
          school_id?: string
          status_value_id?: string | null
          status_value_version?: number | null
          subject_id?: string
          subject_kind?: string
          supersedes_id?: string | null
          version?: number
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_pedagogical_records_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "school_pedagogical_records"
            referencedColumns: ["id"]
          },
        ]
      }
      school_staff_presence: {
        Row: {
          academic_year_id: string
          author_person_id: string
          author_user_id: string
          created_at: string
          declared_on: string | null
          functional_link_logical_id: string
          id: string
          reason: string | null
          school_id: string
          sequence: number
          status: string
        }
        Insert: {
          academic_year_id: string
          author_person_id: string
          author_user_id: string
          created_at?: string
          declared_on?: string | null
          functional_link_logical_id: string
          id?: string
          reason?: string | null
          school_id: string
          sequence: number
          status: string
        }
        Update: {
          academic_year_id?: string
          author_person_id?: string
          author_user_id?: string
          created_at?: string
          declared_on?: string | null
          functional_link_logical_id?: string
          id?: string
          reason?: string | null
          school_id?: string
          sequence?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_staff_presence_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "institutional_academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_staff_presence_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_supervision_records: {
        Row: {
          author_engagement: string
          author_person_id: string
          author_user_id: string
          event_kind: string
          id: string
          logical_id: string
          modality_value_id: string
          modality_value_version: number
          occurred_on: string
          reason: string | null
          recorded_at: string
          referral: string | null
          responsible_label: string | null
          return_on: string | null
          school_id: string
          school_visible: boolean
          status_value_id: string | null
          status_value_version: number | null
          subject: string
          supersedes_id: string | null
          version: number
        }
        Insert: {
          author_engagement: string
          author_person_id: string
          author_user_id: string
          event_kind: string
          id?: string
          logical_id: string
          modality_value_id: string
          modality_value_version: number
          occurred_on: string
          reason?: string | null
          recorded_at?: string
          referral?: string | null
          responsible_label?: string | null
          return_on?: string | null
          school_id: string
          school_visible?: boolean
          status_value_id?: string | null
          status_value_version?: number | null
          subject: string
          supersedes_id?: string | null
          version: number
        }
        Update: {
          author_engagement?: string
          author_person_id?: string
          author_user_id?: string
          event_kind?: string
          id?: string
          logical_id?: string
          modality_value_id?: string
          modality_value_version?: number
          occurred_on?: string
          reason?: string | null
          recorded_at?: string
          referral?: string | null
          responsible_label?: string | null
          return_on?: string | null
          school_id?: string
          school_visible?: boolean
          status_value_id?: string | null
          status_value_version?: number | null
          subject?: string
          supersedes_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "school_supervision_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_supervision_records_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "school_supervision_records"
            referencedColumns: ["id"]
          },
        ]
      }
      school_transport_facts: {
        Row: {
          author_user_id: string
          id: string
          kind: string
          label: string | null
          logical_id: string
          recorded_at: string
          revoked: boolean
          route_logical_id: string | null
          school_id: string
          stop_logical_id: string | null
          student_id: string | null
          valid_from: string
          valid_until: string | null
          version: number
        }
        Insert: {
          author_user_id?: string
          id?: string
          kind: string
          label?: string | null
          logical_id: string
          recorded_at?: string
          revoked?: boolean
          route_logical_id?: string | null
          school_id: string
          stop_logical_id?: string | null
          student_id?: string | null
          valid_from: string
          valid_until?: string | null
          version: number
        }
        Update: {
          author_user_id?: string
          id?: string
          kind?: string
          label?: string | null
          logical_id?: string
          recorded_at?: string
          revoked?: boolean
          route_logical_id?: string | null
          school_id?: string
          stop_logical_id?: string | null
          student_id?: string | null
          valid_from?: string
          valid_until?: string | null
          version?: number
        }
        Relationships: []
      }
      sector_station_rule_versions: {
        Row: {
          decision_ref: string
          recorded_at: string
          rules_version: number
          status: string
          valid_from: string
        }
        Insert: {
          decision_ref: string
          recorded_at?: string
          rules_version: number
          status: string
          valid_from: string
        }
        Update: {
          decision_ref?: string
          recorded_at?: string
          rules_version?: number
          status?: string
          valid_from?: string
        }
        Relationships: []
      }
      sector_station_rules: {
        Row: {
          capability_id: string
          decision_ref: string
          recorded_at: string
          rules_version: number
          station_code: string
        }
        Insert: {
          capability_id: string
          decision_ref: string
          recorded_at?: string
          rules_version: number
          station_code: string
        }
        Update: {
          capability_id?: string
          decision_ref?: string
          recorded_at?: string
          rules_version?: number
          station_code?: string
        }
        Relationships: []
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
      sigem_capability_catalog: {
        Row: {
          capability_id: string
          origin: string
          recorded_at: string
        }
        Insert: {
          capability_id: string
          origin: string
          recorded_at?: string
        }
        Update: {
          capability_id?: string
          origin?: string
          recorded_at?: string
        }
        Relationships: []
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
      sigem_master_reserved_capabilities: {
        Row: {
          capability_id: string
          decided_on: string
          origin: string
          recorded_at: string
        }
        Insert: {
          capability_id: string
          decided_on: string
          origin: string
          recorded_at?: string
        }
        Update: {
          capability_id?: string
          decided_on?: string
          origin?: string
          recorded_at?: string
        }
        Relationships: []
      }
      statistical_map_cell_adjustments: {
        Row: {
          actor_side: string
          adjusted_value: Json | null
          calculated_value: Json | null
          cell_id: string
          id: string
          kind: string
          map_id: string
          person_id: string | null
          principal_id: string | null
          reason: string
          recorded_at: string
          recorded_by: string
          supersedes_id: string | null
        }
        Insert: {
          actor_side: string
          adjusted_value?: Json | null
          calculated_value?: Json | null
          cell_id: string
          id?: string
          kind: string
          map_id: string
          person_id?: string | null
          principal_id?: string | null
          reason: string
          recorded_at?: string
          recorded_by: string
          supersedes_id?: string | null
        }
        Update: {
          actor_side?: string
          adjusted_value?: Json | null
          calculated_value?: Json | null
          cell_id?: string
          id?: string
          kind?: string
          map_id?: string
          person_id?: string | null
          principal_id?: string | null
          reason?: string
          recorded_at?: string
          recorded_by?: string
          supersedes_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "statistical_map_cell_adjustments_map_id_fkey"
            columns: ["map_id"]
            isOneToOne: false
            referencedRelation: "statistical_maps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statistical_map_cell_adjustments_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statistical_map_cell_adjustments_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "statistical_map_cell_adjustments"
            referencedColumns: ["id"]
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
          principal_id: string | null
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
          principal_id?: string | null
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
          principal_id?: string | null
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
      student_card_issuances: {
        Row: {
          academic_year: string
          actor_engagement: string
          actor_user_id: string
          class_label: string | null
          id: string
          kind: string
          public_id: string
          reason: string | null
          recorded_at: string
          school_id: string
          school_name: string
          student_id: string
          student_name: string
          valid_until: string
          version: number
        }
        Insert: {
          academic_year: string
          actor_engagement: string
          actor_user_id: string
          class_label?: string | null
          id?: string
          kind: string
          public_id: string
          reason?: string | null
          recorded_at?: string
          school_id: string
          school_name: string
          student_id: string
          student_name: string
          valid_until: string
          version: number
        }
        Update: {
          academic_year?: string
          actor_engagement?: string
          actor_user_id?: string
          class_label?: string | null
          id?: string
          kind?: string
          public_id?: string
          reason?: string | null
          recorded_at?: string
          school_id?: string
          school_name?: string
          student_id?: string
          student_name?: string
          valid_until?: string
          version?: number
        }
        Relationships: []
      }
      student_class_bond_observations: {
        Row: {
          class_id: string
          enrollment_code: string
          enrollment_id: string
          id: string
          known_at: string
          multi_stage_literal: string | null
          recorded_at: string
          school_id: string
          source_hash: string
          source_locator: string
          source_ref: string
          stage_literal: string | null
          student_id: string
          technical_operation_id: string
          valid_from: string | null
        }
        Insert: {
          class_id: string
          enrollment_code: string
          enrollment_id: string
          id?: string
          known_at: string
          multi_stage_literal?: string | null
          recorded_at?: string
          school_id: string
          source_hash: string
          source_locator: string
          source_ref: string
          stage_literal?: string | null
          student_id: string
          technical_operation_id: string
          valid_from?: string | null
        }
        Update: {
          class_id?: string
          enrollment_code?: string
          enrollment_id?: string
          id?: string
          known_at?: string
          multi_stage_literal?: string | null
          recorded_at?: string
          school_id?: string
          source_hash?: string
          source_locator?: string
          source_ref?: string
          stage_literal?: string | null
          student_id?: string
          technical_operation_id?: string
          valid_from?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_class_bond_observations_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "institutional_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_class_bond_observations_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "school_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_class_bond_observations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_class_bond_observations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "institutional_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_class_bond_observations_technical_operation_id_fkey"
            columns: ["technical_operation_id"]
            isOneToOne: false
            referencedRelation: "technical_execution_operations"
            referencedColumns: ["id"]
          },
        ]
      }
      student_document_pendency_events: {
        Row: {
          actor_user_id: string
          description: string
          due_on: string | null
          enrollment_id: string
          id: string
          note: string | null
          pendency_id: string
          recorded_at: string
          school_id: string
          status: string
          version: number
        }
        Insert: {
          actor_user_id: string
          description: string
          due_on?: string | null
          enrollment_id: string
          id?: string
          note?: string | null
          pendency_id: string
          recorded_at?: string
          school_id: string
          status: string
          version: number
        }
        Update: {
          actor_user_id?: string
          description?: string
          due_on?: string | null
          enrollment_id?: string
          id?: string
          note?: string | null
          pendency_id?: string
          recorded_at?: string
          school_id?: string
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_document_pendency_events_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "school_enrollments"
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
          recorded_by_principal_id: string | null
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
          recorded_by_principal_id?: string | null
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
          recorded_by_principal_id?: string | null
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
      student_photo_versions: {
        Row: {
          created_at: string
          id: string
          object_path: string
          recorded_by: string
          school_id: string
          source_draft_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          object_path: string
          recorded_by: string
          school_id: string
          source_draft_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          object_path?: string
          recorded_by?: string
          school_id?: string
          source_draft_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_photo_versions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "institutional_students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_registration_events: {
        Row: {
          author_person_id: string
          author_user_id: string
          created_at: string
          id: string
          person_id: string
          person_reused: boolean
          purpose: string
          school_id: string
          student_id: string
        }
        Insert: {
          author_person_id: string
          author_user_id: string
          created_at?: string
          id?: string
          person_id: string
          person_reused: boolean
          purpose: string
          school_id: string
          student_id: string
        }
        Update: {
          author_person_id?: string
          author_user_id?: string
          created_at?: string
          id?: string
          person_id?: string
          person_reused?: boolean
          purpose?: string
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_registration_events_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "institutional_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_registration_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_registration_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "institutional_students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_school_day_observations: {
        Row: {
          class_id: string
          id: string
          known_at: string
          link_kind_literal: string | null
          link_role: string
          recorded_at: string
          schedule_literal: string | null
          school_id: string
          source_hash: string
          source_locator: string
          source_ref: string
          stage_literal: string | null
          student_id: string
          technical_operation_id: string
          weekly_load_literal: string | null
        }
        Insert: {
          class_id: string
          id?: string
          known_at: string
          link_kind_literal?: string | null
          link_role: string
          recorded_at?: string
          schedule_literal?: string | null
          school_id: string
          source_hash: string
          source_locator: string
          source_ref: string
          stage_literal?: string | null
          student_id: string
          technical_operation_id: string
          weekly_load_literal?: string | null
        }
        Update: {
          class_id?: string
          id?: string
          known_at?: string
          link_kind_literal?: string | null
          link_role?: string
          recorded_at?: string
          schedule_literal?: string | null
          school_id?: string
          source_hash?: string
          source_locator?: string
          source_ref?: string
          stage_literal?: string | null
          student_id?: string
          technical_operation_id?: string
          weekly_load_literal?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_school_day_observations_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "institutional_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_school_day_observations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_school_day_observations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "institutional_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_school_day_observations_technical_operation_id_fkey"
            columns: ["technical_operation_id"]
            isOneToOne: false
            referencedRelation: "technical_execution_operations"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_emission_events: {
        Row: {
          actor_id: string
          at: string
          emission_id: string
          id: string
          kind: string
          reason: string
          replaced_by: string | null
        }
        Insert: {
          actor_id: string
          at?: string
          emission_id: string
          id?: string
          kind: string
          reason: string
          replaced_by?: string | null
        }
        Update: {
          actor_id?: string
          at?: string
          emission_id?: string
          id?: string
          kind?: string
          reason?: string
          replaced_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "studio_emission_events_emission_id_fkey"
            columns: ["emission_id"]
            isOneToOne: true
            referencedRelation: "studio_emissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_emission_events_replaced_by_fkey"
            columns: ["replaced_by"]
            isOneToOne: false
            referencedRelation: "studio_emissions"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_emissions: {
        Row: {
          actor_id: string
          id: string
          issued_at: string
          issuer_label: string
          school_id: string | null
          snapshot: Json
          snapshot_sha256: string
          template_version_id: string
          title: string
          verification_code: string
        }
        Insert: {
          actor_id: string
          id?: string
          issued_at?: string
          issuer_label: string
          school_id?: string | null
          snapshot: Json
          snapshot_sha256: string
          template_version_id: string
          title: string
          verification_code: string
        }
        Update: {
          actor_id?: string
          id?: string
          issued_at?: string
          issuer_label?: string
          school_id?: string | null
          snapshot?: Json
          snapshot_sha256?: string
          template_version_id?: string
          title?: string
          verification_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_emissions_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "studio_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_template_events: {
        Row: {
          actor_id: string
          at: string
          id: string
          kind: string
          note: string | null
          version_id: string
        }
        Insert: {
          actor_id: string
          at?: string
          id?: string
          kind: string
          note?: string | null
          version_id: string
        }
        Update: {
          actor_id?: string
          at?: string
          id?: string
          kind?: string
          note?: string | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_template_events_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "studio_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_template_versions: {
        Row: {
          author_id: string
          base_template_id: string | null
          blocks: Json
          content_sha256: string
          created_at: string
          id: string
          page: Json
          sector: string
          supersedes_id: string | null
          template_id: string
          title: string
          version_no: number
        }
        Insert: {
          author_id: string
          base_template_id?: string | null
          blocks: Json
          content_sha256: string
          created_at?: string
          id?: string
          page: Json
          sector: string
          supersedes_id?: string | null
          template_id: string
          title: string
          version_no: number
        }
        Update: {
          author_id?: string
          base_template_id?: string | null
          blocks?: Json
          content_sha256?: string
          created_at?: string
          id?: string
          page?: Json
          sector?: string
          supersedes_id?: string | null
          template_id?: string
          title?: string
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "studio_template_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "studio_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_diary_approvals: {
        Row: {
          approved_at: string
          approver_station: string
          assignment_id: string
          author_person_id: string | null
          author_principal_id: string | null
          author_user_id: string
          class_id: string
          collegial_minute_id: string
          id: string
          period_id: string
          school_id: string
        }
        Insert: {
          approved_at?: string
          approver_station: string
          assignment_id: string
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id: string
          class_id: string
          collegial_minute_id: string
          id?: string
          period_id: string
          school_id: string
        }
        Update: {
          approved_at?: string
          approver_station?: string
          assignment_id?: string
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id?: string
          class_id?: string
          collegial_minute_id?: string
          id?: string
          period_id?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_diary_approvals_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "teaching_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_diary_approvals_collegial_minute_id_fkey"
            columns: ["collegial_minute_id"]
            isOneToOne: false
            referencedRelation: "collegial_minute_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_instrument_versions: {
        Row: {
          assignment_id: string
          author_user_id: string
          class_id: string
          id: string
          instructions: string | null
          instrument_id: string
          items: Json
          period_id: string | null
          randomization: Json | null
          recorded_at: string
          results_instrument_id: string | null
          school_id: string
          status: string
          supersedes_id: string | null
          title: string
          version: number
        }
        Insert: {
          assignment_id: string
          author_user_id: string
          class_id: string
          id?: string
          instructions?: string | null
          instrument_id: string
          items?: Json
          period_id?: string | null
          randomization?: Json | null
          recorded_at?: string
          results_instrument_id?: string | null
          school_id: string
          status: string
          supersedes_id?: string | null
          title: string
          version: number
        }
        Update: {
          assignment_id?: string
          author_user_id?: string
          class_id?: string
          id?: string
          instructions?: string | null
          instrument_id?: string
          items?: Json
          period_id?: string | null
          randomization?: Json | null
          recorded_at?: string
          results_instrument_id?: string | null
          school_id?: string
          status?: string
          supersedes_id?: string | null
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "teacher_instrument_versions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "teaching_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_instrument_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "teacher_instrument_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_work_review_events: {
        Row: {
          actor_engagement: string | null
          actor_user_id: string
          comment: string | null
          event: string
          id: string
          recorded_at: string
          school_id: string
          seq: number
          subject_id: string
          subject_kind: string
          subject_version_id: string
        }
        Insert: {
          actor_engagement?: string | null
          actor_user_id: string
          comment?: string | null
          event: string
          id?: string
          recorded_at?: string
          school_id: string
          seq: number
          subject_id: string
          subject_kind: string
          subject_version_id: string
        }
        Update: {
          actor_engagement?: string | null
          actor_user_id?: string
          comment?: string | null
          event?: string
          id?: string
          recorded_at?: string
          school_id?: string
          seq?: number
          subject_id?: string
          subject_kind?: string
          subject_version_id?: string
        }
        Relationships: []
      }
      teaching_assignment_versions: {
        Row: {
          assignment_id: string
          change_kind: string
          change_reason: string | null
          created_at: string
          engagement_id: string
          functional_link_logical_id: string | null
          id: string
          item_key: string
          matrix_id: string
          matrix_version_id: string
          posting_logical_id: string | null
          recorded_by: string
          recorded_by_person_id: string | null
          recorded_by_principal_id: string | null
          recorded_via_engagement_id: string | null
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
          functional_link_logical_id?: string | null
          id?: string
          item_key: string
          matrix_id: string
          matrix_version_id: string
          posting_logical_id?: string | null
          recorded_by: string
          recorded_by_person_id?: string | null
          recorded_by_principal_id?: string | null
          recorded_via_engagement_id?: string | null
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
          functional_link_logical_id?: string | null
          id?: string
          item_key?: string
          matrix_id?: string
          matrix_version_id?: string
          posting_logical_id?: string | null
          recorded_by?: string
          recorded_by_person_id?: string | null
          recorded_by_principal_id?: string | null
          recorded_via_engagement_id?: string | null
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
            foreignKeyName: "teaching_assignment_versions_recorded_by_principal_id_fkey"
            columns: ["recorded_by_principal_id"]
            isOneToOne: false
            referencedRelation: "institutional_sector_principals"
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
      teaching_plan_attachments: {
        Row: {
          author_user_id: string
          content_sha256: string
          id: string
          label: string
          object_path: string
          plan_id: string
          recorded_at: string
          revoked: boolean
          supersedes_id: string | null
        }
        Insert: {
          author_user_id: string
          content_sha256: string
          id?: string
          label: string
          object_path: string
          plan_id: string
          recorded_at?: string
          revoked?: boolean
          supersedes_id?: string | null
        }
        Update: {
          author_user_id?: string
          content_sha256?: string
          id?: string
          label?: string
          object_path?: string
          plan_id?: string
          recorded_at?: string
          revoked?: boolean
          supersedes_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teaching_plan_attachments_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "teaching_plan_attachments"
            referencedColumns: ["id"]
          },
        ]
      }
      teaching_plan_lesson_links: {
        Row: {
          id: string
          lesson_logical_record_id: string
          linked_by: string
          plan_version_id: string
          recorded_at: string
          revoked: boolean
          supersedes_id: string | null
        }
        Insert: {
          id?: string
          lesson_logical_record_id: string
          linked_by: string
          plan_version_id: string
          recorded_at?: string
          revoked?: boolean
          supersedes_id?: string | null
        }
        Update: {
          id?: string
          lesson_logical_record_id?: string
          linked_by?: string
          plan_version_id?: string
          recorded_at?: string
          revoked?: boolean
          supersedes_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teaching_plan_lesson_links_plan_version_id_fkey"
            columns: ["plan_version_id"]
            isOneToOne: false
            referencedRelation: "teaching_plan_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_plan_lesson_links_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "teaching_plan_lesson_links"
            referencedColumns: ["id"]
          },
        ]
      }
      teaching_plan_versions: {
        Row: {
          assignment_id: string
          assignment_version_id: string
          author_engagement_id: string
          author_user_id: string
          blocks: Json
          change_reason: string | null
          class_id: string
          copied_from_version_id: string | null
          covers_from: string | null
          covers_until: string | null
          curricular_refs: Json
          id: string
          level_value_id: string | null
          matrix_version_id: string
          period_id: string | null
          plan_id: string
          recorded_at: string
          school_id: string
          status: string
          supersedes_id: string | null
          target_date: string | null
          title: string
          version: number
        }
        Insert: {
          assignment_id: string
          assignment_version_id: string
          author_engagement_id: string
          author_user_id: string
          blocks?: Json
          change_reason?: string | null
          class_id: string
          copied_from_version_id?: string | null
          covers_from?: string | null
          covers_until?: string | null
          curricular_refs?: Json
          id?: string
          level_value_id?: string | null
          matrix_version_id: string
          period_id?: string | null
          plan_id: string
          recorded_at?: string
          school_id: string
          status: string
          supersedes_id?: string | null
          target_date?: string | null
          title: string
          version: number
        }
        Update: {
          assignment_id?: string
          assignment_version_id?: string
          author_engagement_id?: string
          author_user_id?: string
          blocks?: Json
          change_reason?: string | null
          class_id?: string
          copied_from_version_id?: string | null
          covers_from?: string | null
          covers_until?: string | null
          curricular_refs?: Json
          id?: string
          level_value_id?: string | null
          matrix_version_id?: string
          period_id?: string | null
          plan_id?: string
          recorded_at?: string
          school_id?: string
          status?: string
          supersedes_id?: string | null
          target_date?: string | null
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "teaching_plan_versions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "teaching_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_plan_versions_copied_from_version_id_fkey"
            columns: ["copied_from_version_id"]
            isOneToOne: false
            referencedRelation: "teaching_plan_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_plan_versions_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "institutional_academic_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_plan_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "teaching_plan_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      teaching_substitution_versions: {
        Row: {
          change_kind: string
          created_at: string
          functional_link_logical_id: string
          id: string
          posting_logical_id: string
          reason: string
          recorded_by: string
          recorded_by_person_id: string
          recorded_via_engagement_id: string
          source_ref: string | null
          substitute_engagement_id: string
          substitution_id: string
          supersedes_id: string | null
          valid_from: string
          valid_until: string
          version: number
          withdrawn: boolean
        }
        Insert: {
          change_kind: string
          created_at?: string
          functional_link_logical_id: string
          id?: string
          posting_logical_id: string
          reason: string
          recorded_by: string
          recorded_by_person_id: string
          recorded_via_engagement_id: string
          source_ref?: string | null
          substitute_engagement_id: string
          substitution_id: string
          supersedes_id?: string | null
          valid_from: string
          valid_until: string
          version: number
          withdrawn?: boolean
        }
        Update: {
          change_kind?: string
          created_at?: string
          functional_link_logical_id?: string
          id?: string
          posting_logical_id?: string
          reason?: string
          recorded_by?: string
          recorded_by_person_id?: string
          recorded_via_engagement_id?: string
          source_ref?: string | null
          substitute_engagement_id?: string
          substitution_id?: string
          supersedes_id?: string | null
          valid_from?: string
          valid_until?: string
          version?: number
          withdrawn?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "teaching_substitution_versions_substitute_engagement_id_fkey"
            columns: ["substitute_engagement_id"]
            isOneToOne: false
            referencedRelation: "institutional_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_substitution_versions_substitution_id_fkey"
            columns: ["substitution_id"]
            isOneToOne: false
            referencedRelation: "teaching_substitutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_substitution_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "teaching_substitution_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      teaching_substitutions: {
        Row: {
          assignment_id: string
          created_at: string
          id: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          id: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teaching_substitutions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "teaching_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_automation_settings: {
        Row: {
          decided_by: string
          enabled: boolean
          id: string
          reason: string
          recorded_at: string
          setting_key: string
        }
        Insert: {
          decided_by: string
          enabled: boolean
          id?: string
          reason: string
          recorded_at?: string
          setting_key: string
        }
        Update: {
          decided_by?: string
          enabled?: boolean
          id?: string
          reason?: string
          recorded_at?: string
          setting_key?: string
        }
        Relationships: []
      }
      technical_execution_operations: {
        Row: {
          completed_at: string
          environment: string
          executor_kind: string
          executor_label: string
          id: string
          operation_kind: string
          payload_fingerprint: string
          requested_by: string
          result: Json
          source_hash: string
          source_ref: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string
          environment: string
          executor_kind: string
          executor_label: string
          id?: string
          operation_kind: string
          payload_fingerprint: string
          requested_by: string
          result: Json
          source_hash: string
          source_ref: string
          started_at: string
          status: string
        }
        Update: {
          completed_at?: string
          environment?: string
          executor_kind?: string
          executor_label?: string
          id?: string
          operation_kind?: string
          payload_fingerprint?: string
          requested_by?: string
          result?: Json
          source_hash?: string
          source_ref?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      technical_execution_targets: {
        Row: {
          operation_id: string
          target_id: string
          target_table: string
        }
        Insert: {
          operation_id: string
          target_id: string
          target_table: string
        }
        Update: {
          operation_id?: string
          target_id?: string
          target_table?: string
        }
        Relationships: [
          {
            foreignKeyName: "technical_execution_targets_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "technical_execution_operations"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_identity_secrets: {
        Row: {
          created_at: string
          purpose: string
          secret: string
        }
        Insert: {
          created_at?: string
          purpose: string
          secret: string
        }
        Update: {
          created_at?: string
          purpose?: string
          secret?: string
        }
        Relationships: []
      }
      technical_operation_findings: {
        Row: {
          code: string
          occurrences: number
          operation_id: string
        }
        Insert: {
          code: string
          occurrences: number
          operation_id: string
        }
        Update: {
          code?: string
          occurrences?: number
          operation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "technical_operation_findings_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "technical_execution_operations"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_payload_staging: {
        Row: {
          id: string
          operation_kind: string
          part: string
          payload: Json
          source_hash: string
          staged_at: string
        }
        Insert: {
          id?: string
          operation_kind: string
          part?: string
          payload: Json
          source_hash: string
          staged_at?: string
        }
        Update: {
          id?: string
          operation_kind?: string
          part?: string
          payload?: Json
          source_hash?: string
          staged_at?: string
        }
        Relationships: []
      }
      temporal_stand_in_neutralizations: {
        Row: {
          field: string
          id: string
          reason: string
          recorded_at: string
          status: string
          target_id: string
          target_table: string
          technical_operation_id: string
        }
        Insert: {
          field: string
          id?: string
          reason: string
          recorded_at?: string
          status: string
          target_id: string
          target_table: string
          technical_operation_id: string
        }
        Update: {
          field?: string
          id?: string
          reason?: string
          recorded_at?: string
          status?: string
          target_id?: string
          target_table?: string
          technical_operation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "temporal_stand_in_neutralizations_technical_operation_id_fkey"
            columns: ["technical_operation_id"]
            isOneToOne: false
            referencedRelation: "technical_execution_operations"
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
      webhook_deliveries: {
        Row: {
          attempts: number
          created_at: string
          event_id: string
          event_type: string
          id: string
          last_error: string | null
          last_http_status: number | null
          next_attempt_at: string
          payload: Json
          replay_count: number
          status: string
          subscription_id: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          event_id: string
          event_type: string
          id?: string
          last_error?: string | null
          last_http_status?: number | null
          next_attempt_at?: string
          payload: Json
          replay_count?: number
          status?: string
          subscription_id: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          event_id?: string
          event_type?: string
          id?: string
          last_error?: string | null
          last_http_status?: number | null
          next_attempt_at?: string
          payload?: Json
          replay_count?: number
          status?: string
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "webhook_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_subscriptions: {
        Row: {
          active: boolean
          client_id: string
          created_at: string
          created_by: string
          events: string[]
          id: string
          secret: string
          secret_version: number
          url: string
        }
        Insert: {
          active?: boolean
          client_id: string
          created_at?: string
          created_by: string
          events: string[]
          id?: string
          secret: string
          secret_version?: number
          url: string
        }
        Update: {
          active?: boolean
          client_id?: string
          created_at?: string
          created_by?: string
          events?: string[]
          id?: string
          secret?: string
          secret_version?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_subscriptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "integration_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_definitions: {
        Row: {
          created_at: string
          definition: Json
          homologated_at: string | null
          homologation_origin: string | null
          id: string
          recorded_by: string
          scope: string
          status: string
          title: string
          version: number
          workflow_key: string
        }
        Insert: {
          created_at?: string
          definition: Json
          homologated_at?: string | null
          homologation_origin?: string | null
          id?: string
          recorded_by: string
          scope: string
          status?: string
          title: string
          version: number
          workflow_key: string
        }
        Update: {
          created_at?: string
          definition?: Json
          homologated_at?: string | null
          homologation_origin?: string | null
          id?: string
          recorded_by?: string
          scope?: string
          status?: string
          title?: string
          version?: number
          workflow_key?: string
        }
        Relationships: []
      }
      workflow_events: {
        Row: {
          actor: string
          actor_person: string | null
          attachment_ref: string | null
          comment: string | null
          due_on: string | null
          from_state: string | null
          id: string
          idempotency_key: string
          instance_id: string
          recorded_at: string
          seq: number
          to_state: string
          transition_id: string | null
        }
        Insert: {
          actor: string
          actor_person?: string | null
          attachment_ref?: string | null
          comment?: string | null
          due_on?: string | null
          from_state?: string | null
          id?: string
          idempotency_key: string
          instance_id: string
          recorded_at?: string
          seq: number
          to_state: string
          transition_id?: string | null
        }
        Update: {
          actor?: string
          actor_person?: string | null
          attachment_ref?: string | null
          comment?: string | null
          due_on?: string | null
          from_state?: string | null
          id?: string
          idempotency_key?: string
          instance_id?: string
          recorded_at?: string
          seq?: number
          to_state?: string
          transition_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_events_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "workflow_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_instances: {
        Row: {
          definition_id: string
          id: string
          idempotency_key: string
          opened_at: string
          opened_by: string
          school_id: string | null
          subject_ref: string
        }
        Insert: {
          definition_id: string
          id?: string
          idempotency_key: string
          opened_at?: string
          opened_by: string
          school_id?: string | null
          subject_ref: string
        }
        Update: {
          definition_id?: string
          id?: string
          idempotency_key?: string
          opened_at?: string
          opened_by?: string
          school_id?: string | null
          subject_ref?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_instances_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "workflow_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_outbox: {
        Row: {
          created_at: string
          dispatched_at: string | null
          event_id: string
          id: string
          instance_id: string
          kind: string
        }
        Insert: {
          created_at?: string
          dispatched_at?: string | null
          event_id: string
          id?: string
          instance_id: string
          kind: string
        }
        Update: {
          created_at?: string
          dispatched_at?: string | null
          event_id?: string
          id?: string
          instance_id?: string
          kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_outbox_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "workflow_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_outbox_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "workflow_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      year_transition_decisions: {
        Row: {
          author_person_id: string | null
          author_principal_id: string | null
          author_user_id: string
          created_at: string
          decision: string
          declared_on: string | null
          from_year_id: string
          id: string
          reason: string | null
          resulting_enrollment_id: string | null
          school_id: string
          sequence: number
          student_id: string
          to_year_id: string
        }
        Insert: {
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id: string
          created_at?: string
          decision: string
          declared_on?: string | null
          from_year_id: string
          id?: string
          reason?: string | null
          resulting_enrollment_id?: string | null
          school_id: string
          sequence: number
          student_id: string
          to_year_id: string
        }
        Update: {
          author_person_id?: string | null
          author_principal_id?: string | null
          author_user_id?: string
          created_at?: string
          decision?: string
          declared_on?: string | null
          from_year_id?: string
          id?: string
          reason?: string | null
          resulting_enrollment_id?: string | null
          school_id?: string
          sequence?: number
          student_id?: string
          to_year_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "year_transition_decisions_author_principal_id_fkey"
            columns: ["author_principal_id"]
            isOneToOne: false
            referencedRelation: "institutional_sector_principals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "year_transition_decisions_from_year_id_fkey"
            columns: ["from_year_id"]
            isOneToOne: false
            referencedRelation: "institutional_academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "year_transition_decisions_resulting_enrollment_id_fkey"
            columns: ["resulting_enrollment_id"]
            isOneToOne: false
            referencedRelation: "school_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "year_transition_decisions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "institutional_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "year_transition_decisions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "institutional_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "year_transition_decisions_to_year_id_fkey"
            columns: ["to_year_id"]
            isOneToOne: false
            referencedRelation: "institutional_academic_years"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      aa_conference_state: { Args: { _instrument: string }; Returns: string }
      aa_instrument_completeness_internal: {
        Args: { _instrument: string }
        Returns: Json
      }
      aa_period_window: {
        Args: { _known_at: string; _period: string }
        Returns: Record<string, unknown>
      }
      ab_scope_allows: {
        Args: { _capability: string; _on: string; _school: string }
        Returns: boolean
      }
      academic_year_operational_state_at: {
        Args: { _academic_year_id: string }
        Returns: {
          academic_year_id: string
          recorded_at: string
          sequence: number
          state: string
          technical: boolean
        }[]
      }
      access_center_account_detail: {
        Args: { _on?: string; _user: string }
        Returns: {
          capability_id: string
          detail: string
          entry_kind: string
          on_date: string
          origin: string
          school_id: string
          scope: string
        }[]
      }
      access_center_authorize_reset: {
        Args: { _users: string[] }
        Returns: string
      }
      access_center_holder: { Args: never; Returns: boolean }
      access_center_inventory: {
        Args: never
        Returns: {
          account_kind: string
          banned: boolean
          created_at: string
          inep: string
          last_sign_in_at: string
          login: string
          origin: string
          person_name: string
          revoked: boolean
          school_id: string
          school_name: string
          scope_kind: string
          station_code: string
          user_id: string
        }[]
      }
      access_center_record_reset: {
        Args: { _succeeded: string[]; _users: string[] }
        Returns: string
      }
      act_as_verified_user: { Args: { _actor: string }; Returns: undefined }
      activate_sigem_reviewed: {
        Args: {
          _confirm_all_rules_reviewed: boolean
          _expected_fingerprint: string
          _policy_id: string
        }
        Returns: string
      }
      active_enrollments_at: {
        Args: { _known_at?: string; _on: string; _school: string }
        Returns: {
          active_ids: string[]
          undated_count: number
        }[]
      }
      admin_account_overview: {
        Args: never
        Returns: {
          banned: boolean
          last_sign_in_at: string
          login: string
          password_change_required: boolean
          person_id: string
          user_id: string
        }[]
      }
      aee_services_at: {
        Args: { _known_at: string; _school: string; _student: string }
        Returns: {
          eligibility_status: string
          event_kind: string
          id: string
          logical_id: string
          origin_kind: string
          reason: string
          recorded_at: string
          responsible_engagement_id: string
          slots: Json
          student_id: string
          valid_from: string
          valid_to: string
          version: number
        }[]
      }
      aee_sessions_at: {
        Args: { _known_at: string; _service_logical: string }
        Returns: {
          event_kind: string
          id: string
          logical_id: string
          pedagogical_note: string
          presence_scheme_id: string
          presence_value_id: string
          reason: string
          recorded_at: string
          session_date: string
          version: number
        }[]
      }
      af_document_facts: {
        Args: { _on: string; _school: string; _student: string }
        Returns: Json
      }
      af_enrollment_current: { Args: { _id: string }; Returns: boolean }
      af_episode_current: { Args: { _id: string }; Returns: boolean }
      af_natural_person: { Args: never; Returns: string }
      ah_engagement_active: {
        Args: { _engagement: string; _on: string }
        Returns: boolean
      }
      ah_grant: {
        Args: { _capability: string; _school: string }
        Returns: string
      }
      al_supervision_grant: {
        Args: { _capability: string; _school: string }
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
      applicable_class_designation_policy: {
        Args: { _on: string }
        Returns: {
          created_at: string
          criterion_params: Json
          criterion_type: string
          drafted_by: string
          drafted_by_person_id: string
          id: string
          policy_key: string
          provenance_note: string | null
          supersedes_id: string | null
          valid_from: string
          valid_until: string | null
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "class_designation_policy_versions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
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
      applicable_diary_policy_on: {
        Args: { _closing_present: boolean; _family: string; _on: string }
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
      applicable_map_rule_for_school: {
        Args: { _on: string; _school: string }
        Returns: {
          id: string
          version: number
        }[]
      }
      apply_assessment_instrument: {
        Args: { _expected_last_event_id: string; _instrument: string }
        Returns: string
      }
      apply_assessment_instrument_v2: {
        Args: {
          _applied_on: string
          _expected_last_event_id: string
          _instrument: string
        }
        Returns: string
      }
      apply_workflow_transition: {
        Args: {
          _attachment_ref: string
          _comment: string
          _due_on: string
          _expected_seq: number
          _idempotency_key: string
          _instance: string
          _transition: string
        }
        Returns: string
      }
      approve_teacher_diary: {
        Args: {
          _assignment: string
          _minute_id: string
          _period: string
          _role: string
        }
        Returns: string
      }
      assessment_analysis_definitions_at: {
        Args: { _known_at: string }
        Returns: {
          algorithm: string
          algorithm_version: string
          author_engagement: string | null
          author_person_id: string | null
          author_principal_id: string | null
          author_user_id: string
          id: string
          input_refs: Json
          kind: string
          logical_id: string
          parameters: Json
          reason: string | null
          recorded_at: string
          supersedes_id: string | null
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "assessment_analysis_definitions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      assessment_edition_cycle_at: {
        Args: { _edition: string; _known_at?: string }
        Returns: {
          from_state: string
          note: string
          recorded_at: string
          seq: number
          to_state: string
        }[]
      }
      assessment_editions_at: {
        Args: { _known_at: string; _program: string }
        Returns: {
          author_engagement: string | null
          author_person_id: string | null
          author_principal_id: string | null
          author_user_id: string
          cycle_label: string | null
          event_kind: string
          id: string
          instrument_logical_ids: string[]
          label: string
          logical_id: string
          program_logical_id: string
          reason: string | null
          recorded_at: string
          reference_date: string
          reference_edition_id: string | null
          source_note: string | null
          supersedes_id: string | null
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "assessment_edition_versions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      assessment_instrument_completeness: {
        Args: { _instrument: string }
        Returns: Json
      }
      assessment_instrument_governance_state: {
        Args: { _instrument: string }
        Returns: Json
      }
      assessment_metric_comparability_at: {
        Args: { _known_at: string }
        Returns: {
          author_engagement: string | null
          author_person_id: string | null
          author_principal_id: string | null
          author_user_id: string
          id: string
          logical_id: string
          metric_a: string
          metric_b: string
          reason: string | null
          recorded_at: string
          source_note: string
          status: string
          supersedes_id: string | null
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "assessment_metric_comparability"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      assessment_programs_at: {
        Args: { _known_at: string }
        Returns: {
          application_responsibility: string
          author_engagement: string | null
          author_person_id: string | null
          author_principal_id: string | null
          author_user_id: string
          correction_responsibility: string
          event_kind: string
          id: string
          logical_id: string
          name: string
          origin_kind: string
          reason: string | null
          recorded_at: string
          result_delivery: string
          source_note: string | null
          supersedes_id: string | null
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "assessment_program_versions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      assessment_value_problem: { Args: { _v: Json }; Returns: string }
      assign_class_designation: {
        Args: { _class: string; _expected_sequence: number; _reason: string }
        Returns: string
      }
      attendance_closing_covering: {
        Args: { _class: string; _lesson_logical: string }
        Returns: string
      }
      attribute_value_homologated: {
        Args: { _on: string; _scheme: string; _value: string; _version: number }
        Returns: boolean
      }
      attribute_value_state_on: {
        Args: { _on: string; _scheme: string; _value: string; _version: number }
        Returns: string
      }
      authorize_account_action: {
        Args: { _actor: string; _user: string }
        Returns: undefined
      }
      authorize_inclusion_attachment_access: {
        Args: { _attachment: string; _purpose: string }
        Returns: string
      }
      authorize_meal_evidence_access: { Args: { _id: string }; Returns: string }
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
          technical_operation_id: string | null
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
      bo_fixture_cleanup: { Args: { _operation_id: string }; Returns: number }
      bo_fixture_expire: {
        Args: { _operation_id: string; _user_id: string }
        Returns: undefined
      }
      bo_fixture_prepare: {
        Args: {
          _kind: string
          _operation_id: string
          _source_hash: string
          _user_id: string
          _with_person?: boolean
        }
        Returns: Json
      }
      bo_fixture_residue: { Args: never; Returns: Json }
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
      calendar_external_profile_at: {
        Args: {
          _calendar_id: string
          _known_at: string
          _on: string
          _template_code: string
        }
        Returns: Json
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
      can_read_assessment_item: {
        Args: {
          _author: string
          _school: string
          _status: string
          _visibility: string
        }
        Returns: boolean
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
      can_read_offer_organization: {
        Args: { _class_id: string }
        Returns: boolean
      }
      can_read_operational_task: { Args: { _task: string }; Returns: boolean }
      can_read_teaching_plan_version: {
        Args: { _author: string; _school: string; _status: string }
        Returns: boolean
      }
      cancel_notification_event: {
        Args: { _event: string; _reason: string }
        Returns: undefined
      }
      cancel_school_document_emission: {
        Args: { _emission_id: string; _reason: string }
        Returns: Json
      }
      canonical_reference_state: { Args: { _id: string }; Returns: string }
      capability_classes: { Args: { _capability: string }; Returns: string[] }
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
      capability_unbound: { Args: { _capability: string }; Returns: boolean }
      census_advance_stage: {
        Args: {
          _cycle: string
          _expected_seq: number
          _reason: string
          _stage: string
        }
        Returns: number
      }
      census_can_read_network: { Args: never; Returns: boolean }
      census_compare: {
        Args: { _import: string; _snapshot: string }
        Returns: {
          category: string
          measure: string
          school_id: string
          sigem_reason: string
          sigem_value: number
          source_value: number
        }[]
      }
      census_compose: { Args: { _on: string; _year: string }; Returns: Json }
      census_confer_snapshot: {
        Args: { _fingerprint: string; _note: string; _snapshot: string }
        Returns: string
      }
      census_cycles_overview: { Args: never; Returns: Json }
      census_fingerprint: { Args: { _content: Json }; Returns: string }
      census_head_seq: { Args: { _cycle: string }; Returns: number }
      census_live_preview: { Args: { _cycle: string }; Returns: Json }
      census_natural_person: { Args: never; Returns: string }
      census_official_receipts_at: {
        Args: { _known_at: string }
        Returns: {
          census_year: string
          closed_at: string | null
          content_sha256: string
          id: string
          inep: string
          issued_at: string
          measures: Json
          receipt_code_sha256: string | null
          recorded_at: string
          school_declared: Json
          school_id: string
          source_locator: string
          source_ref: string
          source_sha256: string
          supersedes_id: string | null
          technical_operation_id: string
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "census_official_receipt_snapshots"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      census_open_cycle: {
        Args: { _reason: string; _reference_date: string; _year: string }
        Returns: string
      }
      census_school_pending: {
        Args: { _cycle: string; _school: string }
        Returns: Json
      }
      census_snapshot_content: { Args: { _snapshot: string }; Returns: Json }
      census_source_parsers: { Args: never; Returns: Json }
      census_stage_source: {
        Args: {
          _cycle: string
          _edition_layout: string
          _origin: string
          _parser_id: string
          _parser_version: number
          _rows: Json
          _source_sha256: string
        }
        Returns: Json
      }
      census_take_snapshot: {
        Args: { _cycle: string; _expected_head: string; _reason: string }
        Returns: Json
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
          authorizing_policy_id: string | null
          change_reason: string | null
          class_id: string
          code: string | null
          created_at: string
          id: string
          name: string
          originating_act_ref: string | null
          recorded_by: string | null
          recorded_by_person_id: string | null
          recorded_by_principal_id: string | null
          recorded_via_engagement_id: string | null
          segment_id: string
          supersedes_id: string | null
          technical_operation_id: string | null
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
      class_block_teaching_engagements: {
        Args: {
          _class_id: string
          _item_key: string
          _known_at: string
          _matrix_version_id: string
          _on: string
        }
        Returns: string[]
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
      class_composition_at: {
        Args: { _class: string; _known_at?: string; _on: string }
        Returns: {
          author_actor_kind: string
          kind: string
          positions: Json
          recorded_at: string
          valid_from: string
          valid_until: string
          version: number
          version_id: string
        }[]
      }
      class_composition_core: {
        Args: {
          _class: string
          _expected_head: string
          _positions: Json
          _reason: string
          _valid_from: string
          _valid_until: string
        }
        Returns: string
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
      class_designation_criterion_issue: {
        Args: { _params: Json; _type: string }
        Returns: string
      }
      class_diary_readiness_at: {
        Args: { _class_id: string; _known_at: string; _on: string }
        Returns: {
          code: string
          scope: string
          state: string
          subject_ref: string
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
      class_period_any_diary_closed: {
        Args: { _class: string; _period: string }
        Returns: boolean
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
      class_time_capability_grant: {
        Args: { _capability: string; _on: string; _school: string }
        Returns: string
      }
      class_time_sector_principal: {
        Args: { _capability: string; _school: string }
        Returns: string
      }
      class_time_writable_target: {
        Args: {
          _class_id: string
          _domain: string
          _valid_from: string
          _valid_until: string
        }
        Returns: string
      }
      classes_at_batch: {
        Args: { _class_ids: string[]; _known_at?: string; _valid_on: string }
        Returns: {
          administrative_status: string
          authorizing_policy_id: string | null
          change_reason: string | null
          class_id: string
          code: string | null
          created_at: string
          id: string
          name: string
          originating_act_ref: string | null
          recorded_by: string | null
          recorded_by_person_id: string | null
          recorded_by_principal_id: string | null
          recorded_via_engagement_id: string | null
          segment_id: string
          supersedes_id: string | null
          technical_operation_id: string | null
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
      classes_with_period_link_at: {
        Args: { _known_at?: string; _valid_on: string }
        Returns: {
          academic_year_id: string
          class_id: string
          link: Json
          record: Json
          school_id: string
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
      comm_author_grant: {
        Args: { _audience: string; _class: string; _school: string }
        Returns: Record<string, unknown>
      }
      comm_student_in_class: {
        Args: { _class: string; _on: string; _student: string }
        Returns: boolean
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
      create_assessment_instrument_v2: {
        Args: {
          _assignment: string
          _definition: Json
          _id: string
          _instrument_type: string
          _period: string
          _planned_on: string
          _references: string[]
        }
        Returns: string
      }
      create_operational_task: {
        Args: {
          _assignee: string
          _dedupe_key: string
          _description: string
          _due_on: string
          _priority: string
          _recurrence: Json
          _school: string
          _source_kind: string
          _source_ref: string
          _title: string
        }
        Returns: string
      }
      current_actor: {
        Args: never
        Returns: {
          actor_id: string
          actor_kind: string
          institutional_principal_id: string
          person_id: string
          school_id: string
          scope_kind: string
          station_code: string
        }[]
      }
      current_closing_for_instrument: {
        Args: { _instrument: string }
        Returns: string
      }
      current_closing_id: { Args: { _scope_key: string }; Returns: string }
      current_person_id: { Args: never; Returns: string }
      current_principal_id: { Args: { _on?: string }; Returns: string }
      current_sector_rules_version: { Args: { _on?: string }; Returns: number }
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
      curricular_reference_children: {
        Args: { _edition: string; _parent: string }
        Returns: {
          code: string
          has_children: boolean
          item_id: string
          item_kind: string
          official_text: string
          source_labels: Json
          source_locator: string
        }[]
      }
      curricular_reference_edition_applicable_on: {
        Args: { _known_at: string; _on: string; _source_id: string }
        Returns: {
          edition_id: string
          result_kind: string
          revision_no: number
        }[]
      }
      curricular_reference_edition_chain: {
        Args: { _known_at: string; _source_id: string }
        Returns: {
          edition_id: string
          edition_label: string
          manifest_sha256: string
          recorded_at: string
          revision_no: number
          source_sha256: string
          supersedes_id: string
          valid_from: string
        }[]
      }
      curricular_reference_fold: { Args: { _t: string }; Returns: string }
      curricular_reference_glossary_at: {
        Args: { _known_at: string; _text: string }
        Returns: {
          definition: string
          definition_origin: string
          edition_id: string
          edition_label: string
          homologation: string
          item_id: string
          source_id: string
          source_locator: string
          term: string
          term_key: string
          version_no: number
        }[]
      }
      curricular_reference_homologation_state: {
        Args: { _id: string; _kind: string; _known_at: string }
        Returns: string
      }
      curricular_reference_item_at: {
        Args: { _item: string; _known_at: string }
        Returns: {
          authority: string
          code: string
          edition_homologation: string
          edition_id: string
          edition_label: string
          edition_state: string
          item_id: string
          item_kind: string
          keyword_terms: string[]
          keyword_version_id: string
          keywords_homologation: string
          official_text: string
          parent_item_id: string
          published_on: string
          result_kind: string
          simplification_homologation: string
          simplification_id: string
          simplification_version: number
          simplified_text: string
          source_id: string
          source_label: string
          source_labels: Json
          source_locator: string
          source_ref: string
          source_sha256: string
          valid_from: string
        }[]
      }
      curricular_reference_item_bindings_on: {
        Args: { _item: string; _on: string }
        Returns: {
          scheme_id: string
          state: string
          value_id: string
          value_version: number
        }[]
      }
      curricular_reference_no_correspondence_at: {
        Args: { _item: string; _known_at: string }
        Returns: {
          assessment_id: string
          criteria: Json
          homologation: string
          justification: string
          recorded_at: string
          target_source_id: string
          version_no: number
        }[]
      }
      curricular_reference_relations_at: {
        Args: { _item: string; _known_at: string }
        Returns: {
          criteria: Json
          direction: string
          homologation: string
          justification: string
          nature: string
          official_locator: string
          origin: string
          other_code: string
          other_edition_label: string
          other_item_id: string
          other_source_id: string
          recorded_at: string
          relation_direction: string
          relation_id: string
        }[]
      }
      curricular_reference_search: {
        Args: {
          _bindings: Json
          _edition_id: string
          _item_kind: string
          _known_at: string
          _limit: number
          _only_current: boolean
          _source_id: string
          _text: string
        }
        Returns: {
          code: string
          edition_id: string
          edition_label: string
          has_active_relation: boolean
          item_id: string
          item_kind: string
          keyword_terms: string[]
          matched_in: string[]
          official_text: string
          simplification_homologation: string
          simplified_text: string
          source_id: string
          source_label: string
          source_locator: string
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
      data_quality_can_review: { Args: { _school: string }; Returns: boolean }
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
      designation_actor: { Args: never; Returns: string }
      designation_policies_for_category: {
        Args: { _category: string; _on: string }
        Returns: {
          chain_ok: boolean
          policy: Database["public"]["Tables"]["class_designation_policy_versions"]["Row"]
        }[]
      }
      designation_school_engagement: {
        Args: { _school: string }
        Returns: string
      }
      designation_year_valid_on: { Args: { _year: string }; Returns: string }
      designation_year_writable: { Args: { _year: string }; Returns: undefined }
      diary_holder_scope: {
        Args: { _assignment: string; _on: string; _substitution: string }
        Returns: Record<string, unknown>
      }
      diary_period_at: {
        Args: { _class: string; _known_at: string; _on: string }
        Returns: string
      }
      diary_roster_at: {
        Args: { _assignment: string; _on: string; _substitution: string }
        Returns: {
          allocation_ended_on: string
          allocation_valid_from: string
          display_name: string
          student_id: string
        }[]
      }
      diary_school_day_issue: {
        Args: { _known_at: string; _on: string; _school: string }
        Returns: Record<string, unknown>
      }
      diary_school_overview_at: {
        Args: { _from: string; _school: string; _to: string }
        Returns: {
          assignment_id: string
          attendance_version: number
          class_id: string
          component_id: string
          eligible_count: number
          lesson_date: string
          lesson_version: number
          logical_record_id: string
          marked_count: number
          recorded_as: string
          result_kind: string
        }[]
      }
      diary_teacher_actor: {
        Args: {
          _assignment: string
          _capability: string
          _on: string
          _substitution: string
        }
        Returns: Record<string, unknown>
      }
      dietary_restriction_instructions: {
        Args: { _on: string; _purpose: string; _school: string }
        Returns: {
          handling_note: string
          restriction_value_id: string
          student_id: string
        }[]
      }
      dietary_restrictions_at: {
        Args: { _known_at: string; _on: string; _school: string }
        Returns: {
          author_engagement: string | null
          author_principal_id: string | null
          author_user_id: string
          event_kind: string
          handling_note: string | null
          id: string
          logical_id: string
          reason: string | null
          recorded_at: string
          restriction_value_id: string
          school_id: string
          student_id: string
          supersedes_id: string | null
          valid_from: string
          valid_to: string | null
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "dietary_restrictions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      dispatch_notification_event: { Args: { _event: string }; Returns: number }
      draft_class_designation_policy: {
        Args: {
          _criterion_params: Json
          _criterion_type: string
          _expected_version: number
          _policy_key: string
          _provenance_note: string
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
      effective_capability_grants: {
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
          scope_level: string
        }[]
      }
      effective_capability_scope_classes: {
        Args: { _on?: string }
        Returns: {
          class_id: string
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
      ei_can_read: { Args: never; Returns: boolean }
      ei_grant: {
        Args: { _capability: string; _school: string }
        Returns: string
      }
      ei_widgets_valid: { Args: { _w: Json }; Returns: boolean }
      emit_notification_event: {
        Args: {
          _deep_link: string
          _event_key: string
          _expires: string
          _kind: string
          _payload: Json
          _school: string
          _student: string
        }
        Returns: string
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
      emit_school_document_v2: {
        Args: {
          _reproduces_id: string
          _retification_reason: string
          _retifies_id: string
          _school_id: string
          _student_id: string
          _template_version_id: string
          _valid_on: string
        }
        Returns: Json
      }
      emit_school_document_v3: {
        Args: {
          _idempotency_key: string
          _reproduces_id: string
          _retification_reason: string
          _retifies_id: string
          _school_id: string
          _student_id: string
          _template_version_id: string
          _valid_on: string
        }
        Returns: Json
      }
      end_engagement: {
        Args: { _act_ref: string; _ended_on: string; _engagement: string }
        Returns: undefined
      }
      enroll_student_in_school_year: {
        Args: {
          _act_ref: string
          _declared_on: string
          _school: string
          _student: string
          _year: string
        }
        Returns: string
      }
      enrollment_draft_abandon: {
        Args: { _draft: string; _expected: number; _reason: string }
        Returns: number
      }
      enrollment_draft_complete: {
        Args: {
          _class: string
          _declared_on: string
          _draft: string
          _expected: number
          _year: string
        }
        Returns: Json
      }
      enrollment_draft_save: {
        Args: {
          _cpf: string
          _draft: string
          _existing_student: string
          _expected: number
          _inep: string
          _payload: Json
          _school: string
          _step: number
        }
        Returns: number
      }
      enrollment_drafts_open: {
        Args: { _school: string }
        Returns: {
          cpf_hint: string
          draft_id: string
          existing_student_id: string
          existing_student_name: string
          has_cpf: boolean
          inep: string
          mine: boolean
          payload: Json
          sequence: number
          step: number
          updated_at: string
        }[]
      }
      enrollment_form_for_student: {
        Args: { _school: string; _student: string }
        Returns: {
          completed_at: string
          cpf_hint: string
          draft_id: string
          payload: Json
          result: Json
        }[]
      }
      enrollment_photo_bind: { Args: { _draft: string }; Returns: string }
      enrollment_wizard_class_options: {
        Args: { _on: string; _school: string; _year: string }
        Returns: {
          administrative_status: string
          capacity: number
          class_id: string
          name: string
          occupancy: number
          shift_label: string
        }[]
      }
      ew_head: {
        Args: { _draft: string }
        Returns: {
          author_person_id: string
          author_user_id: string
          cpf_hint: string | null
          cpf_hmac: string | null
          created_at: string
          draft_id: string
          existing_student_id: string | null
          id: string
          inep: string | null
          kind: string
          payload: Json
          reason: string | null
          result: Json | null
          school_id: string
          sequence: number
          step: number
        }
        SetofOptions: {
          from: "*"
          to: "enrollment_wizard_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ewd_head: {
        Args: { _draft: string }
        Returns: {
          author_actor_kind: string
          author_person_id: string | null
          author_principal_id: string | null
          author_user_id: string
          cpf_hint: string | null
          cpf_hmac: string | null
          created_at: string
          draft_id: string
          existing_student_id: string | null
          id: string
          inep: string | null
          kind: string
          payload: Json
          reason: string | null
          result: Json | null
          school_id: string
          sequence: number
          step: number
        }
        SetofOptions: {
          from: "*"
          to: "enrollment_wizard_draft_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      family_authorization: {
        Args: { _student: string }
        Returns: {
          event_kind: string
          guardian_person_id: string | null
          guardian_user_id: string
          id: string
          logical_id: string
          reason: string | null
          recorded_at: string
          recorded_by: string
          recorded_engagement: string
          relation_scheme_id: string | null
          relation_value_id: string | null
          school_id: string
          sections: string[]
          source_ref: string | null
          student_id: string
          supersedes_id: string | null
          valid_from: string
          valid_until: string | null
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "guardian_authorizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      family_communications: {
        Args: { _student: string }
        Returns: {
          acknowledged_at: string
          body: string
          communication_id: string
          published_at: string
          read_at: string
          rectified: boolean
          requires_acknowledgement: boolean
          title: string
          version: number
          version_id: string
        }[]
      }
      family_enrollment_school: {
        Args: { _on: string; _student: string }
        Returns: string
      }
      family_published_menus: {
        Args: { _on: string; _student: string }
        Returns: {
          ends_on: string
          entries: Json
          published_at: string
          school_id: string
          starts_on: string
        }[]
      }
      family_student_cards: {
        Args: { _student: string }
        Returns: {
          academic_year: string
          class_label: string
          public_id: string
          school_name: string
          status: string
          student_name: string
          valid_until: string
          version: number
        }[]
      }
      family_student_summary: { Args: { _student: string }; Returns: Json }
      family_students: {
        Args: never
        Returns: {
          display_name: string
          sections: string[]
          student_id: string
          valid_until: string
        }[]
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
      global_search: {
        Args: {
          _categories?: string[]
          _limit?: number
          _offset?: number
          _q: string
        }
        Returns: {
          category: string
          entity_id: string
          match_kind: string
          score: number
          subtitle: string
          title: string
        }[]
      }
      guardian_authorization_chain: {
        Args: { _school: string; _student: string }
        Returns: {
          event_kind: string
          guardian_name: string
          guardian_person_id: string
          id: string
          is_head: boolean
          logical_id: string
          reason: string
          recorded_at: string
          relation_scheme_id: string
          relation_value_id: string
          sections: string[]
          valid_from: string
          valid_until: string
          version: number
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
      homologate_assessment_correction_policy: {
        Args: {
          _logical_id: string
          _reason: string
          _source_ref: string
          _version: number
        }
        Returns: string
      }
      homologate_attendance_calculation_policy: {
        Args: {
          _logical_id: string
          _reason: string
          _source_ref: string
          _version: number
        }
        Returns: string
      }
      homologate_attendance_occurrence_type: {
        Args: {
          _logical_id: string
          _reason: string
          _source_ref: string
          _version: number
        }
        Returns: string
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
      homologate_capability_policy_expected: {
        Args: { _act_ref: string; _policy: string; _valid_from: string }
        Returns: undefined
      }
      homologate_class_designation_policy: {
        Args: { _policy_version_id: string; _reason: string }
        Returns: string
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
      homologate_collegial_body_configuration: {
        Args: {
          _logical_id: string
          _reason: string
          _source_ref: string
          _version: number
        }
        Returns: string
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
      homologate_curricular_reference: {
        Args: {
          _decision: string
          _effective_on: string
          _expected_head: string
          _reason: string
          _target_id: string
          _target_kind: string
        }
        Returns: string
      }
      homologate_cycle_closing_policy: {
        Args: {
          _logical_id: string
          _reason: string
          _source_ref: string
          _version: number
        }
        Returns: string
      }
      homologate_diary_correction_policy: {
        Args: {
          _logical_id: string
          _reason: string
          _source_ref: string
          _version: number
        }
        Returns: string
      }
      homologate_map_competence_rule: {
        Args: { _id: string; _source_ref: string; _version: number }
        Returns: undefined
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
      homologate_workflow_definition: {
        Args: { _id: string }
        Returns: undefined
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
      inclusion_access_trail: {
        Args: { _attachment: string }
        Returns: {
          at: string
          denial_code: string
          granted: boolean
          purpose: string
          user_id: string
        }[]
      }
      inclusion_attachments_for: {
        Args: { _record_logical: string }
        Returns: {
          classification: string
          id: string
          media_type: string
          purpose: string
          recorded_at: string
          size_bytes: number
          withdrawn: boolean
        }[]
      }
      inclusion_clinical_records_for: {
        Args: { _purpose: string; _school: string; _student: string }
        Returns: {
          attachment_id: string
          cid_as_written: string
          dimension_scheme_id: string
          dimension_value_id: string
          event_kind: string
          id: string
          is_head: boolean
          logical_id: string
          note: string
          reason: string
          recorded_at: string
          source_document: string
          valid_from: string
          valid_to: string
          version: number
        }[]
      }
      inclusion_grant: {
        Args: { _capability: string; _school: string }
        Returns: string
      }
      inclusion_mediations_at: {
        Args: { _known_at: string; _school: string }
        Returns: {
          author_engagement: string
          author_user_id: string
          class_id: string | null
          event_kind: string
          id: string
          logical_id: string
          mediator_engagement_id: string
          reason: string | null
          recorded_at: string
          school_id: string
          student_id: string
          supersedes_id: string | null
          valid_from: string
          valid_to: string | null
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "inclusion_mediation_assignments"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      inclusion_my_mediated_students: {
        Args: { _on: string }
        Returns: {
          class_id: string
          mediation_logical_id: string
          school_id: string
          student_id: string
          student_name: string
          valid_from: string
          valid_to: string
        }[]
      }
      inclusion_my_mediation: {
        Args: { _on: string; _student: string }
        Returns: boolean
      }
      inclusion_network_overview: {
        Args: { _on: string }
        Returns: {
          active_aee_services: number
          active_mediations: number
          school_id: string
        }[]
      }
      inclusion_record_location: {
        Args: { _record_logical: string }
        Returns: {
          school_id: string
          student_id: string
        }[]
      }
      inclusion_records_at: {
        Args: {
          _known_at: string
          _logical_id: string
          _school: string
          _student: string
        }
        Returns: {
          author_engagement: string
          author_person_id: string | null
          author_user_id: string
          body: string
          category_scheme_id: string | null
          category_value_id: string | null
          category_value_version: number | null
          educational_purpose: string
          event_kind: string
          id: string
          logical_id: string
          reason: string | null
          record_type: string
          recorded_at: string
          school_id: string
          share_with_mediation: boolean
          student_id: string
          supersedes_id: string | null
          valid_from: string
          valid_to: string | null
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "inclusion_records"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      inclusion_require: {
        Args: { _capability: string; _school: string }
        Returns: string
      }
      inclusion_teaching_support_flags: {
        Args: { _on: string }
        Returns: {
          class_id: string
          has_active_mediation: boolean
          student_id: string
        }[]
      }
      inclusion_term_grant: { Args: never; Returns: string }
      inclusion_term_reviews_at: {
        Args: { _known_at?: string }
        Returns: {
          alias: string
          category_value_id: string
          note: string
          origin: string
          original_term: string
          recorded_at: string
          seq: number
          status: string
          term_logical_id: string
        }[]
      }
      infrastructure_coverage_at: {
        Args: { _on: string }
        Returns: {
          informed_attribute_ids: string[]
          school_id: string
        }[]
      }
      inst_assessment_result_history: {
        Args: { _logical_id: string }
        Returns: {
          assessment_logical_id: string
          assessment_version_id: string
          author_engagement: string | null
          author_principal_id: string | null
          author_user_id: string
          class_id: string | null
          event_kind: string
          id: string
          item_id: string | null
          logical_id: string
          numeric_value: number | null
          plan_key: string | null
          raw_value: string | null
          reason: string | null
          recorded_at: string
          school_id: string
          source_ref: string | null
          status: string
          student_id: string
          supersedes_id: string | null
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "inst_assessment_results"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      inst_assessment_results_at: {
        Args: { _assessment: string; _known_at: string; _school: string }
        Returns: {
          assessment_logical_id: string
          assessment_version_id: string
          author_engagement: string | null
          author_principal_id: string | null
          author_user_id: string
          class_id: string | null
          event_kind: string
          id: string
          item_id: string | null
          logical_id: string
          numeric_value: number | null
          plan_key: string | null
          raw_value: string | null
          reason: string | null
          recorded_at: string
          school_id: string
          source_ref: string | null
          status: string
          student_id: string
          supersedes_id: string | null
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "inst_assessment_results"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      inst_assessments_at: {
        Args: { _known_at: string; _logical_id: string }
        Returns: {
          applied_from: string
          applied_to: string
          author_engagement: string | null
          author_principal_id: string | null
          author_user_id: string
          event_kind: string
          id: string
          items: Json
          logical_id: string
          origin: string
          reason: string | null
          recorded_at: string
          scale: Json
          source_note: string | null
          supersedes_id: string | null
          target_population: Json
          title: string
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "inst_assessment_versions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
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
      institutional_actor_person: { Args: never; Returns: string }
      institutional_class_register_core: {
        Args: {
          _academic_year_id: string
          _act_ref: string
          _administrative_status: string
          _code: string
          _engagement: string
          _name: string
          _op: string
          _person: string
          _policy: string
          _recorded_by: string
          _school_id: string
          _valid_from: string
          _valid_until: string
        }
        Returns: string
      }
      institutional_class_register_principal: {
        Args: {
          _academic_year_id: string
          _act_ref: string
          _code: string
          _name: string
          _principal: string
          _school_id: string
          _valid_from: string
          _valid_until: string
        }
        Returns: string
      }
      institutional_integrations_overview: { Args: never; Returns: Json }
      institutional_rule_capability: {
        Args: { _action: string; _domain: string }
        Returns: string
      }
      institutional_rule_engagement: {
        Args: { _capability: string }
        Returns: string
      }
      institutional_rule_homologate: {
        Args: {
          _domain: string
          _logical: string
          _reason: string
          _source_ref: string
          _version: number
        }
        Returns: string
      }
      institutional_rule_homologate_core: {
        Args: {
          _actor: string
          _domain: string
          _engagement: string
          _logical: string
          _person: string
          _reason: string
          _source_ref: string
          _version: number
        }
        Returns: string
      }
      institutional_rule_payload_issue: {
        Args: {
          _domain: string
          _p: Json
          _valid_from: string
          _valid_until: string
        }
        Returns: string
      }
      institutional_rule_record_draft: {
        Args: {
          _domain: string
          _expected: number
          _logical: string
          _payload: Json
          _reason: string
          _source_ref: string
          _valid_from: string
          _valid_until: string
        }
        Returns: number
      }
      institutional_rule_record_draft_core: {
        Args: {
          _actor: string
          _domain: string
          _engagement: string
          _expected: number
          _logical: string
          _payload: Json
          _person: string
          _reason: string
          _source_ref: string
          _valid_from: string
          _valid_until: string
        }
        Returns: number
      }
      institutional_rule_slug_array_issue: {
        Args: { _field: string; _nullable: boolean; _v: Json }
        Returns: string
      }
      institutional_rule_target_head: {
        Args: { _domain: string; _logical: string }
        Returns: number
      }
      institutional_rule_versions_at: {
        Args: { _domain: string; _known_at: string; _on: string }
        Returns: {
          homologated_at: string
          homologated_person_id: string
          homologation_id: string
          homologation_reason: string
          logical_id: string
          payload: Json
          reason: string
          recorded_at: string
          recorded_person_id: string
          source_ref: string
          state: string
          valid_from: string
          valid_until: string
          version: number
        }[]
      }
      institutional_rule_versions_core: {
        Args: { _domain: string; _known_at: string; _on: string }
        Returns: {
          homologated_at: string
          homologated_person_id: string
          homologation_id: string
          homologation_reason: string
          logical_id: string
          payload: Json
          reason: string
          recorded_at: string
          recorded_person_id: string
          source_ref: string
          state: string
          valid_from: string
          valid_until: string
          version: number
        }[]
      }
      integration_create_client: {
        Args: {
          _name: string
          _rate: number
          _school_ids: string[]
          _scopes: string[]
        }
        Returns: string
      }
      integration_create_subscription: {
        Args: { _client: string; _events: string[]; _url: string }
        Returns: Json
      }
      integration_issue_key: { Args: { _client: string }; Returns: string }
      integration_overview: { Args: never; Returns: Json }
      integration_random_token: { Args: never; Returns: string }
      integration_replay_delivery: {
        Args: { _delivery: string }
        Returns: undefined
      }
      integration_require_admin: { Args: never; Returns: undefined }
      integration_revoke_key: { Args: { _key: string }; Returns: undefined }
      integration_rotate_secret: {
        Args: { _subscription: string }
        Returns: string
      }
      integration_set_client_active: {
        Args: { _active: boolean; _client: string }
        Returns: undefined
      }
      intelligence_dashboards_visible: {
        Args: never
        Returns: {
          audience_capability: string | null
          author_engagement: string | null
          author_principal_id: string | null
          author_user_id: string
          event_kind: string
          filters: Json
          id: string
          logical_id: string
          reason: string | null
          recorded_at: string
          supersedes_id: string | null
          title: string
          version: number
          visibility: string
          widgets: Json
        }[]
        SetofOptions: {
          from: "*"
          to: "intelligence_dashboard_versions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      kb_can_read_version: { Args: { _version: string }; Returns: boolean }
      kb_search: {
        Args: { _limit?: number; _q: string }
        Returns: {
          body: string
          chunk_id: string
          classification: string
          document_id: string
          page: number
          rank: number
          section: string
          status: string
          title: string
          version: number
          version_id: string
        }[]
      }
      link_institutional_account: {
        Args: { _actor: string; _login: string; _person: string; _user: string }
        Returns: undefined
      }
      link_lesson_to_plan: {
        Args: {
          _lesson_logical_record_id: string
          _plan_version_id: string
          _revoke_link: string
        }
        Returns: string
      }
      locate_guardian_person_exact: {
        Args: { _kind: string; _school: string; _value: string }
        Returns: {
          account_state: string
          display_name: string
          outcome: string
          person_id: string
        }[]
      }
      locate_professional_exact: {
        Args: { _kind: string; _school: string; _value: string }
        Returns: {
          display_name: string
          functional_link_logical_ids: string[]
          outcome: string
          person_id: string
        }[]
      }
      locate_student_exact: {
        Args: { _kind: string; _school: string; _value: string; _year: string }
        Returns: {
          active_elsewhere: boolean
          active_here: boolean
          display_name: string
          outcome: string
          student_id: string
        }[]
      }
      locate_student_for_enrollment: {
        Args: { _kind: string; _value: string }
        Returns: {
          display_name: string
          student_id: string
        }[]
      }
      map_mediation_projection_at: {
        Args: { _on: string; _school: string }
        Returns: {
          assignment_logical_id: string
          assignment_version: number
          mediator_active: boolean
          mediator_engagement_id: string
          student_ref: string
          valid_from: string
          valid_to: string
        }[]
      }
      map_previous_competence_issue: {
        Args: {
          _month: number
          _rule_id: string
          _rule_version: number
          _school: string
          _year: number
        }
        Returns: string
      }
      map_rule_definition_issue: { Args: { _d: Json }; Returns: string }
      map_rule_network_engagement: { Args: never; Returns: string }
      map_single_applicable_rule: {
        Args: { _on: string; _school: string }
        Returns: {
          id: string
          version: number
        }[]
      }
      map_snapshot_binding_issue: {
        Args: { _map: string; _snapshot: Json; _snapshot_date: string }
        Returns: string
      }
      map_snapshot_criterion_issue: { Args: { _s: Json }; Returns: string }
      map_snapshot_digest: { Args: { _snapshot: Json }; Returns: string }
      map_year_state_on: { Args: { _on: string }; Returns: string }
      meal_audit_trail_at: {
        Args: { _from: string; _school: string; _to: string }
        Returns: {
          act: string
          author_person_id: string
          logical_id: string
          reason: string
          recorded_at: string
          school_id: string
          source: string
          version: number
        }[]
      }
      meal_can_read_receiving: { Args: { _school: string }; Returns: boolean }
      meal_catalog_version: {
        Args: { _scheme: string; _value: string }
        Returns: number
      }
      meal_competence_checklist_at: {
        Args: { _competence: string; _school: string }
        Returns: {
          amount: number
          area: string
          code: string
          state: string
        }[]
      }
      meal_content_stagings_list: {
        Args: never
        Returns: {
          context_key: string
          id: string
          kind: string
          recorded_at: string
          row_count: number
          sha256: string
          source_name: string
          state: string
        }[]
      }
      meal_deliveries_at: {
        Args: {
          _as_of: string
          _from: string
          _known_at: string
          _school: string
          _to: string
        }
        Returns: {
          accepted_qty: number
          action: string
          apresentacao_ref: string
          competence: string
          contrato_ref: string
          delivered_qty: number
          expected_brand: string
          expected_on: string
          item_ref: string
          late: boolean
          open_nonconformities: number
          order_logical_id: string
          pending_qty: number
          quantity: number
          receipt_logical_id: string
          receipt_status: string
          receipt_version: number
          received_at: string
          rejected_qty: number
          schedule_logical_id: string
          schedule_version: number
          school_id: string
          unidade_ref: string
        }[]
      }
      meal_demand_consolidation_at: {
        Args: { _competence: string }
        Returns: {
          apresentacao_ref: string
          by_school: Json
          contrato_ref: string
          item_ref: string
          order_version_ids: string[]
          total: number
          unidade_ref: string
        }[]
      }
      meal_evidence_can_read: {
        Args: { _kind: string; _school: string }
        Returns: boolean
      }
      meal_evidence_capability: { Args: { _kind: string }; Returns: string }
      meal_evidence_for: {
        Args: { _kind: string; _target: string }
        Returns: {
          event_kind: string
          id: string
          is_head: boolean
          label: string
          logical_id: string
          media_type: string
          readable: boolean
          reason: string
          recorded_at: string
          sha256: string
          size_bytes: number
          version: number
        }[]
      }
      meal_evidence_slot: {
        Args: { _kind: string; _media: string; _size: number; _target: string }
        Returns: string
      }
      meal_evidence_target_school: {
        Args: { _kind: string; _target: string }
        Returns: string
      }
      meal_executions_at: {
        Args: { _from: string; _known_at: string; _school: string; _to: string }
        Returns: {
          author_engagement: string | null
          author_person_id: string | null
          author_principal_id: string | null
          author_user_id: string
          count_basis: string | null
          deviation: string | null
          deviation_authorization_ref: string | null
          deviation_reason: string | null
          event_kind: string
          executed_on: string
          executed_preparation: string | null
          followed: boolean | null
          id: string
          logical_id: string
          meal_slot_value_id: string
          meals_breakdown: Json
          meals_total: number | null
          planned_menu_ref: string | null
          reason: string | null
          recorded_at: string
          school_id: string
          students_present: number | null
          students_present_source: string | null
          supersedes_id: string | null
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "meal_daily_executions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      meal_fiscal_documents_at: {
        Args: { _school: string }
        Returns: {
          issued_on: string
          issuer_ref: string
          logical_id: string
          number: string
          recorded_at: string
          schedule_logical_id: string
          school_id: string
          sha256: string
          status: string
          version: number
        }[]
      }
      meal_forecasts_at: {
        Args: { _from: string; _known_at: string; _school: string; _to: string }
        Returns: {
          author_engagement: string | null
          author_principal_id: string | null
          author_user_id: string
          basis: string
          event_kind: string
          forecast_count: number
          id: string
          logical_id: string
          meal_slot_value_id: string
          reason: string | null
          recorded_at: string
          school_id: string
          served_on: string
          supersedes_id: string | null
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "meal_forecasts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      meal_grant: {
        Args: { _capability: string; _school: string }
        Returns: string
      }
      meal_grant_on: {
        Args: { _capability: string; _on: string; _school: string }
        Returns: string
      }
      meal_has_network: { Args: { _caps: string[] }; Returns: boolean }
      meal_inventory_at: {
        Args: { _from: string; _known_at: string; _school: string; _to: string }
        Returns: {
          author_engagement: string | null
          author_person_id: string | null
          author_principal_id: string | null
          author_user_id: string
          contract_ref: string | null
          delivery_schedule_ref: string | null
          direction: number | null
          event_kind: string
          expires_on: string | null
          id: string
          item_value_id: string
          item_value_version: number
          logical_id: string
          lot: string | null
          moved_on: string
          movement_class: string | null
          movement_kind: string
          note: string | null
          quantity: number
          reason: string | null
          recorded_at: string
          school_id: string
          source_document_ref: string | null
          source_literal: string | null
          source_receipt_version_id: string | null
          stock_count_ref: string | null
          supersedes_id: string | null
          transfer_pair_id: string | null
          transfer_peer_school: string | null
          unit_value_id: string
          unit_value_version: number
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "meal_inventory_movements"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      meal_kitchen_day_at: {
        Args: { _on: string; _school: string }
        Returns: Json
      }
      meal_kitchens_at: {
        Args: { _on: string }
        Returns: {
          host_school_id: string
          kitchen_id: string
          name: string
          served_schools: string[]
          valid_from: string
          valid_to: string
          version: number
        }[]
      }
      meal_master_at: {
        Args: {
          _include_drafts: boolean
          _kind: string
          _known_at: string
          _on: string
        }
        Returns: {
          author_person_id: string
          functional_validation: string
          logical_id: string
          payload: Json
          recorded_at: string
          school_id: string
          status: string
          valid_from: string
          valid_to: string
          version: number
        }[]
      }
      meal_master_head: {
        Args: { _logical: string }
        Returns: {
          author_engagement: string | null
          author_person_id: string | null
          author_principal_id: string | null
          author_user_id: string
          id: string
          kind: string
          logical_id: string
          payload: Json
          reason: string | null
          recorded_at: string
          school_id: string | null
          source_staging_id: string | null
          status: string
          supersedes_id: string | null
          valid_from: string
          valid_to: string | null
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "meal_master_records"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      meal_master_history: {
        Args: { _logical: string }
        Returns: {
          author_person_id: string
          payload: Json
          reason: string
          recorded_at: string
          status: string
          valid_from: string
          valid_to: string
          version: number
        }[]
      }
      meal_master_homologated: {
        Args: { _kind: string; _logical: string; _on: string }
        Returns: boolean
      }
      meal_master_spec: {
        Args: { _kind: string }
        Returns: Record<string, unknown>
      }
      meal_menu_publications_at: {
        Args: { _school: string }
        Returns: {
          action: string
          current_version: boolean
          menu_logical_id: string
          menu_version_id: string
          reason: string
          recorded_at: string
          sequence: number
        }[]
      }
      meal_menus_at: {
        Args: {
          _from: string
          _known_at: string
          _logical_id: string
          _school: string
          _to: string
        }
        Returns: {
          author_engagement: string | null
          author_principal_id: string | null
          author_user_id: string
          ends_on: string
          entries: Json
          event_kind: string
          id: string
          logical_id: string
          reason: string | null
          recorded_at: string
          school_id: string
          service_group_value_id: string | null
          starts_on: string
          supersedes_id: string | null
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "meal_menu_versions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      meal_movement_class: {
        Args: {
          m: Database["public"]["Tables"]["meal_inventory_movements"]["Row"]
        }
        Returns: string
      }
      meal_movement_sign: {
        Args: {
          m: Database["public"]["Tables"]["meal_inventory_movements"]["Row"]
        }
        Returns: number
      }
      meal_network_action_summary: {
        Args: { _competence: string; _on: string }
        Returns: {
          key: string
          reason: string
          state: string
          value: number
        }[]
      }
      meal_network_data_quality: {
        Args: { _on: string }
        Returns: {
          key: string
          reason: string
          state: string
          value: number
        }[]
      }
      meal_network_grant: { Args: { _capability: string }; Returns: string }
      meal_network_grant_on: {
        Args: { _capability: string; _on: string }
        Returns: string
      }
      meal_network_overview: {
        Args: { _from: string; _to: string }
        Returns: {
          forecast_days: number
          forecast_total: number
          menu_days: number
          published_menus: number
          school_id: string
          served_days: number
          served_total: number
          served_unknown_records: number
        }[]
      }
      meal_nonconformities_at: {
        Args: { _known_at: string; _school: string }
        Returns: {
          deadline_state: string
          evidence_refs: string[]
          item_ref: string
          logical_id: string
          motive: string
          opened_at: string
          receipt_logical_id: string
          recorded_at: string
          returned_qty: number
          schedule_logical_id: string
          school_id: string
          status: string
          supplier_ref: string
          version: number
        }[]
      }
      meal_operational_records_at: {
        Args: { _from: string; _known_at: string; _school: string; _to: string }
        Returns: {
          author_engagement: string | null
          author_principal_id: string | null
          author_user_id: string
          event_kind: string
          field_values: Json
          id: string
          logical_id: string
          meal_slot_value_id: string | null
          model_ref: string
          reason: string | null
          recorded_at: string
          recorded_on: string
          school_id: string
          signed_by_person_id: string
          supersedes_id: string | null
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "meal_operational_records"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      meal_order_history: {
        Args: { _logical: string }
        Returns: {
          author_person_id: string
          lines: Json
          reason: string
          recorded_at: string
          status: string
          version: number
        }[]
      }
      meal_order_lines_check: {
        Args: { _lines: Json; _on: string }
        Returns: undefined
      }
      meal_order_window_for: {
        Args: { _competence: string; _school: string }
        Returns: {
          action: string
          author_engagement: string | null
          author_person_id: string | null
          author_principal_id: string | null
          author_user_id: string
          basis: string
          closes_at: string
          competence: string
          id: string
          logical_id: string
          opens_at: string
          reason: string | null
          recorded_at: string
          rule_ref: string | null
          school_ids: string[] | null
          supersedes_id: string | null
          time_zone: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "meal_order_windows"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      meal_order_windows_at: {
        Args: { _competence: string }
        Returns: {
          action: string
          basis: string
          closes_at: string
          competence: string
          logical_id: string
          opens_at: string
          reason: string
          recorded_at: string
          school_ids: string[]
          time_zone: string
          version: number
        }[]
      }
      meal_orders_at: {
        Args: { _competence: string; _known_at: string; _school: string }
        Returns: {
          competence: string
          first_recorded_at: string
          lines: Json
          logical_id: string
          opinions: number
          reason: string
          recorded_at: string
          school_id: string
          status: string
          version: number
          window_closes_at: string
          window_time_zone: string
        }[]
      }
      meal_policy_on: { Args: { _kind: string; _on: string }; Returns: Json }
      meal_reporting_facts: {
        Args: { _dataset: string; _from: string; _school: string; _to: string }
        Returns: {
          classe: string
          item: string
          lote: string
          on_date: string
          ref: string
          row_data: Json
          school_id: string
          situacao: string
          validade: string
        }[]
      }
      meal_reporting_rows: {
        Args: {
          _dataset: string
          _filters: Json
          _from: string
          _limit: number
          _offset: number
          _school: string
          _to: string
        }
        Returns: {
          row_data: Json
          school_id: string
          total: number
        }[]
      }
      meal_reporting_scope: {
        Args: { _from: string; _school: string; _to: string }
        Returns: undefined
      }
      meal_reporting_summary: {
        Args: { _from: string; _school: string; _to: string }
        Returns: {
          dataset: string
          key: string
          reason: string
          state: string
          value: number
        }[]
      }
      meal_services_at: {
        Args: { _from: string; _known_at: string; _school: string; _to: string }
        Returns: {
          author_engagement: string | null
          author_principal_id: string | null
          author_user_id: string
          event_kind: string
          id: string
          logical_id: string
          meal_slot_value_id: string
          offered_count: number | null
          reason: string | null
          recorded_at: string
          school_id: string
          served_count: number | null
          served_on: string
          source_note: string | null
          supersedes_id: string | null
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "meal_service_records"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      meal_stock_alerts_at: {
        Args: { _expiry_window_days: number; _on: string; _school: string }
        Returns: {
          detail: string
          item_value_id: string
          kind: string
          lot: string
          unit_value_id: string
        }[]
      }
      meal_stock_balance_at: {
        Args: { _known_at: string; _on: string; _school: string }
        Returns: {
          balance: number
          expires_on: string
          item_value_id: string
          lot: string
          movements: number
          unit_value_id: string
          unknown_sign: number
        }[]
      }
      meal_stock_basis_at: {
        Args: { _competence: string; _school: string }
        Returns: {
          policy: Json
          state: string
        }[]
      }
      meal_stock_closings_at: {
        Args: { _school: string }
        Returns: {
          author_engagement: string | null
          author_person_id: string | null
          author_principal_id: string | null
          author_user_id: string
          balances: Json
          closing_on: string
          competence: string
          id: string
          known_at: string
          manifest_sha256: string
          movement_ids: string[]
          reason: string | null
          recorded_at: string
          school_id: string
          supersedes_id: string | null
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "meal_stock_closings"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      meal_stock_counts_at: {
        Args: { _school: string }
        Returns: {
          author_engagement: string | null
          author_person_id: string | null
          author_principal_id: string | null
          author_user_id: string
          counted_on: string
          id: string
          lines: Json
          logical_id: string
          reason: string | null
          recorded_at: string
          school_id: string
          status: string
          supersedes_id: string | null
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "meal_stock_counts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      meal_stock_ledger_at: {
        Args: { _from: string; _known_at: string; _school: string; _to: string }
        Returns: {
          contract_ref: string
          delivery_schedule_ref: string
          event_kind: string
          expires_on: string
          id: string
          item_value_id: string
          logical_id: string
          lot: string
          moved_on: string
          movement_class: string
          note: string
          quantity: number
          reason: string
          recorded_at: string
          sign: number
          source_document_ref: string
          source_literal: string
          source_receipt_version_id: string
          stock_count_ref: string
          superseded: boolean
          transfer_pair_id: string
          transfer_peer_school: string
          unit_value_id: string
          version: number
        }[]
      }
      meal_stock_lines: {
        Args: { _known: string; _on: string; _school: string }
        Returns: {
          balance: number
          expires_on: string
          item_value_id: string
          lot: string
          movements: number
          unit_value_id: string
          unknown_sign: number
        }[]
      }
      meal_stock_read_guard: { Args: { _school: string }; Returns: undefined }
      meal_value_ok: {
        Args: { _scheme: string; _value: string }
        Returns: boolean
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
      my_diaries_at: {
        Args: { _known_at: string; _on: string }
        Returns: {
          academic_year_id: string
          assignment_id: string
          assignment_state: string
          class_id: string
          component_id: string
          component_label: string
          effective_from: string
          effective_until: string
          engagement_id: string
          item_key: string
          matrix_id: string
          role: string
          school_id: string
          substitution_id: string
          year_state: string
        }[]
      }
      my_diary_lessons: {
        Args: { _assignment: string; _substitution: string }
        Returns: {
          attendance_version_id: string
          attendance_version_number: number
          eligible_student_ids: string[]
          facts: Json
          lesson_date: string
          lesson_version_id: string
          logical_record_id: string
          marks: Json
          period_id: string
          recorded_as: string
          reference_edition_ids: string[]
          reference_item_ids: string[]
          schedule_block_ids: string[]
          version_number: number
        }[]
      }
      my_diary_slots_at: {
        Args: { _assignment: string; _on: string; _substitution: string }
        Returns: {
          block_id: string
          block_key: string
          block_state: string
          ends_at: string
          starts_at: string
        }[]
      }
      my_notifications: {
        Args: { _before: string; _limit: number }
        Returns: {
          body: string
          delivery_id: string
          event_kind: string
          has_link: boolean
          mandatory: boolean
          read_at: string
          recorded_at: string
          still_authorized: boolean
          title: string
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
      my_unread_notification_count: { Args: never; Returns: number }
      network_indicators_at: {
        Args: {
          _known_at?: string
          _on: string
          _school?: string
          _year?: string
        }
        Returns: Json
      }
      notif_capability_holders: {
        Args: { _capability: string; _on: string; _school: string }
        Returns: string[]
      }
      notif_grant: {
        Args: { _capability: string; _school: string }
        Returns: string
      }
      notif_guardians: {
        Args: {
          _on: string
          _school: string
          _section: string
          _student: string
        }
        Returns: string[]
      }
      notif_still_authorized: { Args: { _delivery: string }; Returns: boolean }
      offer_capability_on: {
        Args: { _on: string; _school: string }
        Returns: boolean
      }
      offer_matrix_applicable_throughout: {
        Args: {
          _class_id: string
          _from: string
          _mv: string
          _school: string
          _until: string
        }
        Returns: boolean
      }
      offer_schedule_journey_gap: {
        Args: {
          _class_id: string
          _from: string
          _until: string
          _version_id: string
        }
        Returns: string
      }
      offer_window_days: {
        Args: { _class_id: string; _from: string; _until: string }
        Returns: string[]
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
      officialize_statistical_map:
        | {
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
        | {
            Args: {
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
      open_notification: { Args: { _delivery: string }; Returns: Json }
      open_statistical_map: {
        Args: { _month: number; _school: string; _year: number }
        Returns: string
      }
      open_statistical_map_correction:
        | {
            Args: {
              _actor: string
              _base_version: string
              _map: string
              _reason: string
            }
            Returns: string
          }
        | {
            Args: { _base_version: string; _map: string; _reason: string }
            Returns: string
          }
      operational_engagement_active: {
        Args: { _engagement: string; _school: string }
        Returns: boolean
      }
      operational_task_assignee: { Args: { _task: string }; Returns: string }
      own_engagement_network_now: { Args: never; Returns: boolean }
      own_engagement_schools_now: { Args: never; Returns: string[] }
      password_change_required: { Args: never; Returns: boolean }
      perf_grant: {
        Args: { _capability: string; _school: string }
        Returns: string
      }
      performance_disclosure_at: {
        Args: { _known_at: string }
        Returns: {
          author_engagement: string
          author_user_id: string
          event_kind: string
          id: string
          logical_id: string
          min_group_size: number
          reason: string | null
          recorded_at: string
          source_note: string
          supersedes_id: string | null
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "performance_disclosure_versions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      performance_goals_at: {
        Args: { _known_at: string; _metric_logical: string }
        Returns: {
          author_engagement: string
          author_user_id: string
          comparator: string
          event_kind: string
          id: string
          logical_id: string
          metric_version_id: string
          reason: string | null
          recorded_at: string
          school_id: string | null
          source_note: string
          supersedes_id: string | null
          target_value: number
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "performance_goals"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      performance_metrics_at: {
        Args: { _assessment: string; _known_at: string }
        Returns: {
          assessment_logical_id: string
          author_engagement: string
          author_user_id: string
          event_kind: string
          formula: Json
          id: string
          label: string
          logical_id: string
          population_key: string
          reason: string | null
          recorded_at: string
          source_note: string
          supersedes_id: string | null
          unit_label: string | null
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "performance_metric_versions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
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
      plan_period_window: {
        Args: {
          _class: string
          _known_at: string
          _on: string
          _period: string
        }
        Returns: Record<string, unknown>
      }
      plan_periods_for_assignment: {
        Args: { _assignment: string; _on: string }
        Returns: {
          ends_on: string
          label: string
          period_id: string
          starts_on: string
        }[]
      }
      preview_capability_policy: {
        Args: { _policy: string; _valid_from: string }
        Returns: {
          coverage_missing: string[]
          issue: string
        }[]
      }
      preview_institutional_rule_draft: {
        Args: {
          _domain: string
          _payload: Json
          _valid_from: string
          _valid_until: string
        }
        Returns: string
      }
      professional_school_observations_2026: {
        Args: { _school: string }
        Returns: {
          declaration_count: number
          display_name: string
          known_at: string
          person_id: string
          school_id: string
          start_known: boolean
        }[]
      }
      provision_sector_principal: {
        Args: {
          _auth_user: string
          _operation: string
          _school: string
          _station: string
        }
        Returns: string
      }
      public_portal_get: { Args: { _slug: string }; Returns: Json }
      public_portal_list: {
        Args: { _kind: string }
        Returns: {
          kind: string
          published_at: string
          slug: string
          summary: string
          title: string
          version: number
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
      readable_class_ids: { Args: never; Returns: string[] }
      readable_enrollments_count: { Args: never; Returns: number }
      readable_students_count: { Args: never; Returns: number }
      record_academic_year_operational_state: {
        Args: {
          _academic_year_id: string
          _expected_sequence: number
          _reason: string
          _state: string
        }
        Returns: string
      }
      record_aee_service: {
        Args: {
          _base_id: string
          _kind: string
          _reason: string
          _responsible_engagement: string
          _school: string
          _slots: Json
          _student: string
          _valid_from: string
          _valid_to: string
        }
        Returns: string
      }
      record_aee_session: {
        Args: {
          _base_id: string
          _date: string
          _kind: string
          _note: string
          _presence_scheme: string
          _presence_value: string
          _reason: string
          _service_logical: string
        }
        Returns: string
      }
      record_ai_assisted_action: {
        Args: {
          _kind: string
          _outcome: string
          _result_ref: string
          _school: string
          _sha256: string
          _writer: string
        }
        Returns: string
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
      record_assessment_analysis_definition: {
        Args: {
          _algorithm: string
          _algorithm_version: string
          _base_id: string
          _inputs: Json
          _kind: string
          _parameters: Json
          _reason: string
        }
        Returns: string
      }
      record_assessment_conference: {
        Args: {
          _expected_fingerprint: string
          _expected_head: string
          _instrument: string
        }
        Returns: string
      }
      record_assessment_correction_policy_draft: {
        Args: {
          _expected_version: number
          _logical_id: string
          _payload: Json
          _reason: string
          _source_ref: string
          _valid_from: string
          _valid_until: string
        }
        Returns: number
      }
      record_assessment_edition: {
        Args: {
          _base_id: string
          _cycle: string
          _instruments: string[]
          _kind: string
          _label: string
          _program: string
          _reason: string
          _reference_date: string
          _reference_edition: string
          _source: string
        }
        Returns: string
      }
      record_assessment_edition_cycle_event: {
        Args: {
          _edition: string
          _expected_seq: number
          _note: string
          _to_state: string
        }
        Returns: number
      }
      record_assessment_item_media: {
        Args: {
          _item_id: string
          _label: string
          _mime: string
          _object_path: string
          _sha256: string
        }
        Returns: string
      }
      record_assessment_item_version: {
        Args: {
          _answer: Json
          _copied_from: string
          _criteria: string
          _curricular_refs: Json
          _expected_head: string
          _item_id: string
          _item_type_id: string
          _key_shared: boolean
          _options: Json
          _school_id: string
          _status: string
          _stem: string
          _visibility: string
        }
        Returns: string
      }
      record_assessment_item_version_v2: {
        Args: {
          _answer: Json
          _copied_from: string
          _criteria: string
          _curricular_refs: Json
          _expected_head: string
          _item_id: string
          _item_type_id: string
          _key_shared: boolean
          _options: Json
          _reference_on: string
          _school_id: string
          _status: string
          _stem: string
          _visibility: string
        }
        Returns: string
      }
      record_assessment_officialization: {
        Args: { _conference_id: string; _instrument: string }
        Returns: string
      }
      record_assessment_program: {
        Args: {
          _application: string
          _base_id: string
          _correction: string
          _delivery: string
          _kind: string
          _name: string
          _origin: string
          _reason: string
          _source: string
        }
        Returns: string
      }
      record_attendance_calculation_policy_draft: {
        Args: {
          _expected_version: number
          _logical_id: string
          _payload: Json
          _reason: string
          _source_ref: string
          _valid_from: string
          _valid_until: string
        }
        Returns: number
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
      record_attendance_occurrence_type_draft: {
        Args: {
          _expected_version: number
          _logical_id: string
          _payload: Json
          _reason: string
          _source_ref: string
          _valid_from: string
          _valid_until: string
        }
        Returns: number
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
      record_attendance_version_v2: {
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
      record_calendar_external_profile: {
        Args: {
          _calendar_id: string
          _expected_head: string
          _profile: Json
          _reason: string
          _template_code: string
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
      record_class_composition: {
        Args: {
          _class: string
          _expected_head: string
          _positions: Json
          _reason: string
          _valid_from: string
          _valid_until: string
        }
        Returns: string
      }
      record_class_designation_category: {
        Args: {
          _category: string
          _class: string
          _expected_sequence: number
          _reason: string
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
      record_collegial_body_configuration_draft: {
        Args: {
          _expected_version: number
          _logical_id: string
          _payload: Json
          _reason: string
          _source_ref: string
          _valid_from: string
          _valid_until: string
        }
        Returns: number
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
      record_curricular_reference_edition_v2: {
        Args: {
          _authority: string
          _declared_item_count: number
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
      record_curricular_reference_glossary_term: {
        Args: {
          _definition: string
          _edition: string
          _effective_on: string
          _expected_head: string
          _item: string
          _locator: string
          _origin: string
          _reason: string
          _term: string
          _term_key: string
        }
        Returns: string
      }
      record_curricular_reference_keywords: {
        Args: {
          _effective_on: string
          _expected_head: string
          _item: string
          _reason: string
          _terms: string[]
        }
        Returns: string
      }
      record_curricular_reference_no_correspondence: {
        Args: {
          _criteria: Json
          _effective_on: string
          _expected_head: string
          _item: string
          _justification: string
          _reason: string
          _target_source_id: string
          _withdrawn: boolean
        }
        Returns: string
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
      record_curricular_reference_relation_v2: {
        Args: {
          _criteria: Json
          _direction: string
          _effective_on: string
          _from: string
          _justification: string
          _nature: string
          _official_locator: string
          _origin: string
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
      record_curricular_reference_simplification_v2: {
        Args: {
          _effective_on: string
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
      record_cycle_closing_policy_draft: {
        Args: {
          _expected_version: number
          _logical_id: string
          _payload: Json
          _reason: string
          _source_ref: string
          _valid_from: string
          _valid_until: string
        }
        Returns: number
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
      record_data_quality_review: {
        Args: {
          _evidence_sha256: string
          _expected_head: string
          _fingerprint: string
          _reason: string
          _rule_id: string
          _rule_version: number
          _school: string
          _state: string
        }
        Returns: string
      }
      record_diary_correction_policy_draft: {
        Args: {
          _expected_version: number
          _logical_id: string
          _payload: Json
          _reason: string
          _source_ref: string
          _valid_from: string
          _valid_until: string
        }
        Returns: number
      }
      record_dietary_restriction: {
        Args: {
          _base_id: string
          _from: string
          _kind: string
          _note: string
          _reason: string
          _restriction: string
          _school: string
          _student: string
          _to: string
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
      record_family_communication_receipt: {
        Args: { _kind: string; _student: string; _version: string }
        Returns: undefined
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
      record_functional_process: {
        Args: {
          _base: string
          _closed: string
          _correction_reason: string
          _kind: string
          _kind_version: number
          _link_logical: string
          _logical: string
          _opened: string
          _related_event: string
          _revoke: boolean
          _school: string
          _source: string
        }
        Returns: string
      }
      record_guardian_authorization: {
        Args: {
          _base_id: string
          _guardian_user: string
          _kind: string
          _reason: string
          _relation_scheme: string
          _relation_value: string
          _school: string
          _sections: string[]
          _source_ref: string
          _student: string
          _valid_from: string
          _valid_until: string
        }
        Returns: string
      }
      record_guardian_authorization_v2: {
        Args: {
          _base_id: string
          _guardian_person: string
          _guardian_user: string
          _kind: string
          _reason: string
          _relation_scheme: string
          _relation_value: string
          _school: string
          _sections: string[]
          _source_ref: string
          _student: string
          _valid_from: string
          _valid_until: string
        }
        Returns: string
      }
      record_guardian_authorization_v3: {
        Args: {
          _base_id: string
          _guardian_person: string
          _kind: string
          _reason: string
          _relation_scheme: string
          _relation_value: string
          _school: string
          _sections: string[]
          _source_ref: string
          _student: string
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
      record_inclusion_clinical: {
        Args: {
          _attachment: string
          _base_id: string
          _cid: string
          _dimension_scheme: string
          _dimension_value: string
          _kind: string
          _note: string
          _reason: string
          _school: string
          _source: string
          _student: string
          _valid_from: string
          _valid_to: string
        }
        Returns: string
      }
      record_inclusion_mediation: {
        Args: {
          _base_id: string
          _class: string
          _kind: string
          _mediator_engagement: string
          _reason: string
          _school: string
          _student: string
          _valid_from: string
          _valid_to: string
        }
        Returns: string
      }
      record_inclusion_record: {
        Args: {
          _base_id: string
          _body: string
          _category_scheme: string
          _category_value: string
          _kind: string
          _purpose: string
          _reason: string
          _record_type: string
          _school: string
          _share_with_mediation: boolean
          _student: string
          _valid_from: string
          _valid_to: string
        }
        Returns: string
      }
      record_inclusion_term_review: {
        Args: {
          _alias: string
          _category: string
          _expected_seq: number
          _note: string
          _origin: string
          _original: string
          _status: string
          _term: string
        }
        Returns: string
      }
      record_inclusion_term_review_v2: {
        Args: {
          _alias: string
          _category: string
          _category_version: number
          _expected_seq: number
          _note: string
          _origin: string
          _original: string
          _status: string
          _term: string
        }
        Returns: string
      }
      record_inst_assessment: {
        Args: {
          _base_id: string
          _from: string
          _items: Json
          _kind: string
          _origin: string
          _population: Json
          _reason: string
          _scale: Json
          _source: string
          _title: string
          _to: string
        }
        Returns: string
      }
      record_inst_assessment_result: {
        Args: {
          _assessment_version: string
          _base_id: string
          _class: string
          _item: string
          _kind: string
          _plan_key: string
          _raw: string
          _reason: string
          _school: string
          _source: string
          _status: string
          _student: string
        }
        Returns: string
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
      record_institutional_integration_version: {
        Args: {
          _config: Json
          _expected_version: number
          _key: string
          _mapping: Json
          _provider: string
          _reason: string
          _secret_ref: string
          _slot: string
          _state: string
        }
        Returns: number
      }
      record_intelligence_dashboard: {
        Args: {
          _audience: string
          _base_id: string
          _filters: Json
          _kind: string
          _reason: string
          _title: string
          _visibility: string
          _widgets: Json
        }
        Returns: string
      }
      record_kb_document_event: {
        Args: { _kind: string; _reason: string; _version: string }
        Returns: string
      }
      record_kb_document_version: {
        Args: {
          _chunks: Json
          _classification: string
          _document: string
          _expected_head: string
          _original_ref: string
          _original_sha256: string
          _required_capability: string
          _source_kind: string
          _title: string
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
      record_lesson_version_v2: {
        Args: {
          _assignment: string
          _base_version_id: string
          _blocks: string[]
          _changed_aspects: string[]
          _date: string
          _facts: Json
          _justification: string
          _logical: string
          _plan_id: string
          _references: string[]
          _substitution: string
        }
        Returns: string
      }
      record_map_cell_adjustment: {
        Args: {
          _adjusted: Json
          _annul: boolean
          _calculated: Json
          _cell: string
          _expected_head: string
          _map: string
          _reason: string
        }
        Returns: string
      }
      record_map_competence_rule_draft: {
        Args: {
          _definition: Json
          _expected_version: number
          _id: string
          _valid_from: string
          _valid_until: string
        }
        Returns: number
      }
      record_map_conference:
        | {
            Args: { _actor: string; _fingerprint: string; _map: string }
            Returns: string
          }
        | { Args: { _fingerprint: string; _map: string }; Returns: string }
        | {
            Args: { _fingerprint: string; _map: string; _snapshot: Json }
            Returns: string
          }
      record_map_observations: {
        Args: { _map: string; _text: string }
        Returns: string
      }
      record_meal_delivery_schedule: {
        Args: {
          _action: string
          _contract: string
          _expected_on: string
          _expected_version: number
          _frequency: string
          _item: string
          _logical: string
          _order: string
          _presentation: string
          _quantity: number
          _reason: string
          _unit: string
        }
        Returns: string
      }
      record_meal_demand_consolidation: {
        Args: {
          _competence: string
          _expected_sequence: number
          _reason: string
        }
        Returns: number
      }
      record_meal_evidence: {
        Args: {
          _event: string
          _expected_version: number
          _kind: string
          _label: string
          _logical: string
          _media: string
          _path: string
          _reason: string
          _sha256: string
          _size: number
          _target: string
        }
        Returns: string
      }
      record_meal_execution: {
        Args: {
          _authorization: string
          _base_id: string
          _breakdown: Json
          _consumption: Json
          _count_basis: string
          _deviation: string
          _deviation_reason: string
          _followed: boolean
          _kind: string
          _meals_total: number
          _on: string
          _planned_menu: string
          _preparation: string
          _reason: string
          _school: string
          _slot: string
          _students_present: number
          _students_source: string
          _tz: string
        }
        Returns: string
      }
      record_meal_fiscal_document: {
        Args: {
          _expected_version: number
          _issued_on: string
          _issuer: string
          _logical: string
          _number: string
          _reason: string
          _schedule: string
          _school: string
          _sha256: string
          _status: string
          _storage_ref: string
        }
        Returns: string
      }
      record_meal_forecast: {
        Args: {
          _base_id: string
          _basis: string
          _count: number
          _kind: string
          _on: string
          _reason: string
          _school: string
          _slot: string
        }
        Returns: string
      }
      record_meal_inventory_movement: {
        Args: {
          _base_id: string
          _item: string
          _kind: string
          _movement: string
          _note: string
          _on: string
          _quantity: number
          _reason: string
          _school: string
          _unit: string
        }
        Returns: string
      }
      record_meal_kitchen: {
        Args: {
          _expected_version: number
          _from: string
          _host_school: string
          _kitchen: string
          _name: string
          _reason: string
          _to: string
        }
        Returns: string
      }
      record_meal_kitchen_link: {
        Args: {
          _base_id: string
          _from: string
          _kind: string
          _kitchen: string
          _reason: string
          _school: string
          _to: string
        }
        Returns: string
      }
      record_meal_master: {
        Args: {
          _action: string
          _expected_version: number
          _from: string
          _kind: string
          _logical: string
          _payload: Json
          _reason: string
          _school: string
          _staging?: string
          _to: string
        }
        Returns: string
      }
      record_meal_menu: {
        Args: {
          _base_id: string
          _ends: string
          _entries: Json
          _group: string
          _kind: string
          _reason: string
          _school: string
          _starts: string
        }
        Returns: string
      }
      record_meal_menu_publication: {
        Args: {
          _action: string
          _expected_sequence: number
          _menu_version: string
          _reason: string
        }
        Returns: number
      }
      record_meal_nonconformity: {
        Args: {
          _deadline_rule: string
          _evidence: string[]
          _expected_version: number
          _logical: string
          _motive: string
          _note: string
          _reason: string
          _receipt: string
          _returned: number
          _status: string
        }
        Returns: string
      }
      record_meal_operational_record: {
        Args: {
          _base_id: string
          _kind: string
          _model: string
          _on: string
          _reason: string
          _school: string
          _slot: string
          _values: Json
        }
        Returns: string
      }
      record_meal_order: {
        Args: {
          _action: string
          _competence: string
          _expected_version: number
          _lines: Json
          _logical: string
          _reason: string
          _school: string
        }
        Returns: string
      }
      record_meal_order_opinion: {
        Args: { _opinion: string; _order_version: string }
        Returns: string
      }
      record_meal_order_window: {
        Args: {
          _action: string
          _basis: string
          _closes: string
          _competence: string
          _expected_version: number
          _logical: string
          _opens: string
          _reason: string
          _rule: string
          _school_ids: string[]
          _tz: string
        }
        Returns: string
      }
      record_meal_receipt: {
        Args: {
          _accepted: number
          _action: string
          _brand: string
          _checklist: Json
          _condition: string
          _delivered: number
          _evidence: string[]
          _expected_version: number
          _expires: string
          _fiscal: string
          _logical: string
          _lot: string
          _note: string
          _reason: string
          _received_at: string
          _rejected: number
          _schedule: string
          _spec: string
          _temperature: number
          _tz: string
        }
        Returns: string
      }
      record_meal_service: {
        Args: {
          _base_id: string
          _kind: string
          _offered: number
          _on: string
          _reason: string
          _school: string
          _served: number
          _slot: string
          _source: string
        }
        Returns: string
      }
      record_meal_stock_closing: {
        Args: {
          _competence: string
          _expected_version: number
          _reason: string
          _school: string
        }
        Returns: string
      }
      record_meal_stock_count: {
        Args: {
          _counted_on: string
          _expected_version: number
          _lines: Json
          _logical: string
          _reason: string
          _school: string
          _status: string
        }
        Returns: string
      }
      record_meal_stock_movement: {
        Args: {
          _base_id: string
          _class: string
          _contract: string
          _count: string
          _direction: number
          _expires: string
          _item: string
          _kind: string
          _literal: string
          _lot: string
          _note: string
          _on: string
          _quantity: number
          _reason: string
          _schedule: string
          _school: string
          _source_doc: string
          _tz: string
          _unit: string
        }
        Returns: string
      }
      record_meal_stock_transfer: {
        Args: {
          _expires: string
          _from_school: string
          _item: string
          _lot: string
          _note: string
          _on: string
          _quantity: number
          _reason: string
          _to_school: string
          _tz: string
          _unit: string
        }
        Returns: string
      }
      record_metric_comparability: {
        Args: {
          _base_id: string
          _metric_a: string
          _metric_b: string
          _reason: string
          _source: string
          _status: string
        }
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
      record_notification_rule: {
        Args: {
          _base: string
          _basis: string
          _cap: string
          _kind: string
          _logical: string
          _reason: string
          _retire: boolean
          _section: string
          _template: string
        }
        Returns: string
      }
      record_notification_template: {
        Args: {
          _base: string
          _body: string
          _external: string
          _key: string
          _mandatory: boolean
          _reason: string
          _retire: boolean
          _title: string
          _vars: string[]
        }
        Returns: string
      }
      record_operational_task_event: {
        Args: {
          _assignee: string
          _comment: string
          _expected_seq: number
          _idempotency_key: string
          _kind: string
          _status: string
          _task: string
        }
        Returns: number
      }
      record_own_password_change: { Args: never; Returns: undefined }
      record_performance_disclosure: {
        Args: {
          _base_id: string
          _kind: string
          _min: number
          _reason: string
          _source: string
        }
        Returns: string
      }
      record_performance_goal: {
        Args: {
          _base_id: string
          _comparator: string
          _kind: string
          _metric_version: string
          _reason: string
          _school: string
          _source: string
          _target: number
        }
        Returns: string
      }
      record_performance_metric: {
        Args: {
          _assessment: string
          _base_id: string
          _formula: Json
          _kind: string
          _label: string
          _population_key: string
          _reason: string
          _source: string
          _unit: string
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
      record_period_closing_act_v2: {
        Args: {
          _action: string
          _detail: string
          _effective_on: string
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
      record_professional_exercise: {
        Args: {
          _base: string
          _correction_reason: string
          _function: string
          _function_version: number
          _link_logical: string
          _logical: string
          _posting_logical: string
          _revoke: boolean
          _school: string
          _source: string
          _valid_from: string
          _valid_until: string
        }
        Returns: string
      }
      record_professional_qualification: {
        Args: {
          _base: string
          _correction_reason: string
          _logical: string
          _person: string
          _qualification: string
          _qualification_version: number
          _revoke: boolean
          _school: string
          _source: string
          _valid_from: string
          _valid_until: string
        }
        Returns: string
      }
      record_public_publication: {
        Args: {
          _body: string
          _expected_version: number
          _kind: string
          _reason: string
          _slug: string
          _state: string
          _summary: string
          _title: string
        }
        Returns: Json
      }
      record_school_communication_act: {
        Args: {
          _act: string
          _communication: string
          _expected_sequence: number
          _reason: string
        }
        Returns: number
      }
      record_school_communication_version: {
        Args: {
          _audience: string
          _body: string
          _class: string
          _communication: string
          _expected_version: number
          _reason: string
          _requires_ack: boolean
          _school: string
          _title: string
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
      record_school_infrastructure_attribute: {
        Args: {
          _attribute: string
          _catalog_values: string[]
          _label: string
          _source_field?: string
          _source_ref?: string
          _unit_label?: string
          _value_type: string
        }
        Returns: string
      }
      record_school_infrastructure_observation: {
        Args: {
          _attribute: string
          _school: string
          _source_hash: string
          _source_locator?: string
          _source_ref: string
          _valid_from: string
          _value: Json
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
      record_school_pedagogical_record: {
        Args: {
          _base_id: string
          _body: string
          _category_value: string
          _kind: string
          _occurred_on: string
          _reason: string
          _school: string
          _subject_id: string
          _subject_kind: string
          _visibility: string
        }
        Returns: string
      }
      record_school_pedagogical_record_v2: {
        Args: {
          _base_id: string
          _body: string
          _category_value: string
          _kind: string
          _occurred_on: string
          _period_id: string
          _reason: string
          _referral: string
          _responsible_person_id: string
          _return_on: string
          _school: string
          _status_value: string
          _subject_id: string
          _subject_kind: string
          _visibility: string
        }
        Returns: string
      }
      record_school_staff_presence: {
        Args: {
          _declared_on: string
          _expected_sequence: number
          _link: string
          _reason: string
          _school: string
          _status: string
          _year: string
        }
        Returns: string
      }
      record_school_supervision: {
        Args: {
          _base_id: string
          _kind: string
          _modality: string
          _occurred_on: string
          _reason: string
          _referral: string
          _responsible_label: string
          _return_on: string
          _school: string
          _school_visible: boolean
          _status_value: string
          _subject: string
        }
        Returns: string
      }
      record_school_transport_fact: {
        Args: {
          _expected_version: number
          _kind: string
          _label: string
          _logical: string
          _revoked: boolean
          _route: string
          _school: string
          _stop: string
          _student: string
          _valid_from: string
          _valid_until: string
        }
        Returns: string
      }
      record_student_card: {
        Args: {
          _class_label: string
          _expected_version: number
          _kind: string
          _public_id: string
          _reason: string
          _school: string
          _school_name: string
          _student: string
          _student_name: string
          _valid_until: string
          _year: string
        }
        Returns: string
      }
      record_student_document_pendency: {
        Args: {
          _description: string
          _due_on: string
          _enrollment: string
          _expected_version: number
          _note: string
          _pendency: string
          _status: string
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
      record_teacher_instrument_version: {
        Args: {
          _assignment_id: string
          _expected_head: string
          _instructions: string
          _instrument_id: string
          _items: Json
          _period_id: string
          _randomization: Json
          _results_instrument_id: string
          _status: string
          _title: string
        }
        Returns: string
      }
      record_teacher_instrument_version_v2: {
        Args: {
          _assignment_id: string
          _expected_head: string
          _instructions: string
          _instrument_id: string
          _items: Json
          _period_id: string
          _randomization: Json
          _reference_on: string
          _results_instrument_id: string
          _status: string
          _title: string
        }
        Returns: string
      }
      record_teacher_work_review: {
        Args: {
          _comment: string
          _event: string
          _expected_seq: number
          _kind: string
          _subject: string
          _version: string
        }
        Returns: number
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
      record_teaching_assignment_version_v2: {
        Args: {
          _assignment_id: string
          _change_kind: string
          _class_id: string
          _engagement_id: string
          _expected_head_id: string
          _functional_link_logical_id: string
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
      record_teaching_plan_attachment: {
        Args: {
          _label: string
          _object_path: string
          _plan_id: string
          _revoke: string
          _sha256: string
        }
        Returns: string
      }
      record_teaching_plan_version: {
        Args: {
          _assignment_id: string
          _blocks: Json
          _change_reason: string
          _copied_from: string
          _covers_from: string
          _covers_until: string
          _curricular_refs: Json
          _expected_head: string
          _level_value_id: string
          _plan_id: string
          _status: string
          _title: string
        }
        Returns: string
      }
      record_teaching_plan_version_v2: {
        Args: {
          _assignment_id: string
          _blocks: Json
          _change_reason: string
          _copied_from: string
          _covers_from: string
          _covers_until: string
          _curricular_refs: Json
          _expected_head: string
          _level_value_id: string
          _period_id: string
          _plan_id: string
          _status: string
          _target_date: string
          _title: string
        }
        Returns: string
      }
      record_teaching_substitution_version: {
        Args: {
          _assignment_id: string
          _change_kind: string
          _expected_head_id: string
          _functional_link_logical_id: string
          _reason: string
          _source_ref: string
          _substitute_engagement_id: string
          _substitution_id: string
          _valid_from: string
          _valid_until: string
          _withdrawn: boolean
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
      record_year_transition_decision: {
        Args: {
          _decision: string
          _declared_on: string
          _expected_sequence: number
          _from_year: string
          _reason: string
          _school: string
          _student: string
          _to_year: string
        }
        Returns: string
      }
      reference_actor: {
        Args: { _cap: string; _on: string }
        Returns: {
          engagement_id: string
          person_id: string
        }[]
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
      register_academic_standings_v2: {
        Args: {
          _class: string
          _cycle: string
          _effective_on: string
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
      register_assessment_results_v2: {
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
      register_capability_policy_draft_expected: {
        Args: { _expected_head: string; _logical: string; _rules: Json }
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
      register_inclusion_attachment: {
        Args: {
          _classification: string
          _media_type: string
          _purpose: string
          _record_logical: string
          _sha256: string
          _size: number
          _storage_path: string
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
      register_operational_task_priority: {
        Args: { _id: string; _label: string; _ordinal: number }
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
          _administrative_dependency?: string
          _base_version_id: string
          _classroom_count?: number
          _clear_administrative?: string[]
          _district: string
          _email?: string
          _hard_access?: boolean
          _inep: string
          _justification: string
          _location_kind: string
          _network_code: string
          _official_name: string
          _own_building?: boolean
          _partnership_public_authority?: string
          _phone?: string
          _private_school_category?: string
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
      register_student_for_school: {
        Args: {
          _cpf: string
          _display_name: string
          _inep: string
          _school: string
        }
        Returns: string
      }
      register_student_with_exact_identity: {
        Args: { _cpf: string; _display_name: string; _inep: string }
        Returns: string
      }
      register_workflow_definition: {
        Args: {
          _definition: Json
          _expected_version: number
          _key: string
          _scope: string
          _title: string
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
      return_statistical_map: {
        Args: { _expected_conference: string; _map: string; _reason: string }
        Returns: string
      }
      review_meal_content_staging: {
        Args: {
          _action: string
          _reason: string
          _staging: string
          _valid_from: string
        }
        Returns: number
      }
      revoke_curricular_reference_relation: {
        Args: { _effective_on: string; _reason: string; _relation: string }
        Returns: string
      }
      roster_readable_classes: { Args: never; Returns: string[] }
      s_active_enrollment: {
        Args: { _student: string; _year: string }
        Returns: {
          enrollment_id: string
          school_id: string
        }[]
      }
      s_current_person: { Args: never; Returns: string }
      s_enroll_core: {
        Args: {
          _act_ref: string
          _declared_on: string
          _school: string
          _student: string
          _year: string
        }
        Returns: string
      }
      s_lookup_guard: {
        Args: { _kind: string; _purpose: string; _school: string }
        Returns: undefined
      }
      s_year_open_for_operation: { Args: { _year: string }; Returns: boolean }
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
      school_capability_schools: {
        Args: { _capability: string }
        Returns: string[]
      }
      school_communication_history: {
        Args: { _communication: string }
        Returns: {
          detail: string
          entry_kind: string
          number: number
          reason: string
          recorded_at: string
        }[]
      }
      school_communications_at: {
        Args: { _school: string }
        Returns: {
          acknowledgements: number
          audience_kind: string
          author_capability: string
          body: string
          class_id: string
          communication_id: string
          last_sequence: number
          published_at: string
          published_version: number
          reads: number
          recorded_at: string
          requires_acknowledgement: boolean
          state: string
          title: string
          version: number
          version_id: string
        }[]
      }
      school_document_author: {
        Args: { _capability: string; _school: string }
        Returns: {
          engagement_id: string
          principal_id: string
        }[]
      }
      school_document_capabilities: { Args: never; Returns: string[] }
      school_document_composable_kinds: { Args: never; Returns: string[] }
      school_document_facts: {
        Args: { _on: string; _school: string; _student: string }
        Returns: Json
      }
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
      school_followup_grant: {
        Args: { _capability: string; _school: string }
        Returns: string
      }
      school_followup_grant_on: {
        Args: { _capability: string; _on: string; _school: string }
        Returns: string
      }
      school_infrastructure_attribute_core: {
        Args: {
          _attribute: string
          _author_person: string
          _author_user: string
          _catalog_values: string[]
          _engagement: string
          _label: string
          _op: string
          _source_field: string
          _source_ref: string
          _unit_label: string
          _value_type: string
        }
        Returns: string
      }
      school_infrastructure_observation_core: {
        Args: {
          _attribute: string
          _author_person: string
          _author_user: string
          _engagement: string
          _op: string
          _school: string
          _source_hash: string
          _source_locator: string
          _source_ref: string
          _valid_from: string
          _value: Json
        }
        Returns: string
      }
      school_pedagogical_records_at: {
        Args: {
          _known_at: string
          _logical_id: string
          _school: string
          _subject_id: string
          _subject_kind: string
        }
        Returns: {
          author_engagement: string
          author_person_id: string | null
          author_user_id: string
          body: string
          category_scheme_id: string
          category_value_id: string
          category_value_version: number
          event_kind: string
          id: string
          logical_id: string
          occurred_on: string
          period_id: string | null
          reason: string | null
          recorded_at: string
          referral: string | null
          responsible_person_id: string | null
          return_on: string | null
          school_id: string
          status_value_id: string | null
          status_value_version: number | null
          subject_id: string
          subject_kind: string
          supersedes_id: string | null
          version: number
          visibility: string
        }[]
        SetofOptions: {
          from: "*"
          to: "school_pedagogical_records"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      school_record_version_core: {
        Args: {
          _act_ref: string
          _active: boolean
          _address: string
          _administrative_dependency: string
          _author_person: string
          _author_user: string
          _base_version_id: string
          _classroom_count: number
          _clear_administrative: string[]
          _district: string
          _email: string
          _engagement: string
          _hard_access: boolean
          _inep: string
          _justification: string
          _location_kind: string
          _network_code: string
          _official_name: string
          _own_building: boolean
          _partnership_public_authority: string
          _phone: string
          _policy_id: string
          _policy_version: number
          _private_school_category: string
          _school: string
          _valid_from: string
        }
        Returns: string
      }
      school_supervision_records_at: {
        Args: { _known_at: string; _logical_id: string; _school: string }
        Returns: {
          event_kind: string
          id: string
          logical_id: string
          modality_value_id: string
          occurred_on: string
          own: boolean
          reason: string
          recorded_at: string
          referral: string
          responsible_label: string
          return_on: string
          school_id: string
          school_visible: boolean
          status_value_id: string
          subject: string
          version: number
        }[]
      }
      school_teaching_load_at: {
        Args: { _known_at: string; _on: string; _school_id: string }
        Returns: {
          assigned_block_minutes: number
          balance_reason: string
          balance_state: string
          block_count: number
          class_count: number
          conflict_block_count: number
          contractual_load_state: string
          engagement_id: string
          person_id: string
          result_kind: string
        }[]
      }
      school_teaching_schedule_at: {
        Args: { _known_at: string; _on: string; _school_id: string }
        Returns: {
          assignment_id: string
          block_id: string
          block_key: string
          block_minutes: number
          class_id: string
          class_name: string
          component_label: string
          conflict_with_block_ids: string[]
          ends_at: string
          engagement_id: string
          item_key: string
          matrix_version_id: string
          origin: string
          person_id: string
          result_kind: string
          starts_at: string
          substitution_id: string
          weekday: number
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
      sec_actor: {
        Args: never
        Returns: {
          kind: string
          person_id: string
          principal_id: string
        }[]
      }
      sec_allocate_core: {
        Args: {
          _class: string
          _enrollment: string
          _reason: string
          _valid_from: string
        }
        Returns: string
      }
      sec_class_capacity_on: {
        Args: { _class: string; _on: string }
        Returns: number
      }
      sec_class_occupancy_on: {
        Args: { _class: string; _on: string }
        Returns: number
      }
      secretariat_allocate_to_class: {
        Args: {
          _class: string
          _enrollment: string
          _reason: string
          _valid_from: string
        }
        Returns: string
      }
      secretariat_assignment_elements: {
        Args: { _class: string; _on: string }
        Returns: {
          item_key: string
          label: string
          matrix_version_id: string
        }[]
      }
      secretariat_class_vacancies_at: {
        Args: { _on: string; _school: string; _year: string }
        Returns: {
          available: number
          capacity: number
          class_id: string
          name: string
          occupancy: number
          shift_label: string
          vacancy_state: string
        }[]
      }
      secretariat_create_class: {
        Args: {
          _capacity: number
          _code: string
          _composition: Json
          _name: string
          _school: string
          _shift: Json
          _source_ref: string
          _valid_from: string
          _valid_until: string
          _year: string
        }
        Returns: Json
      }
      secretariat_create_class_with_journey: {
        Args: {
          _capacity: number
          _code: string
          _composition: Json
          _journey: Json
          _name: string
          _school: string
          _shift: Json
          _source_ref: string
          _valid_from: string
          _valid_until: string
          _year: string
        }
        Returns: Json
      }
      secretariat_end_class_episode: {
        Args: { _ended_on: string; _episode: string; _reason: string }
        Returns: string
      }
      secretariat_enrollment_book_at: {
        Args: { _known_at: string; _school: string; _year: string }
        Returns: {
          class_label: string
          end_reason: string
          ended_on: string
          enrollment_id: string
          entry_order: number
          institutional_number: string
          opened_on: string
          recorded_at: string
          situation: string
          student_name: string
        }[]
      }
      secretariat_overview_at: {
        Args: { _on: string; _school: string; _year: string }
        Returns: Json
      }
      secretariat_pending_at: {
        Args: { _on: string; _school: string; _year: string }
        Returns: {
          display_name: string
          enrollment_id: string
          issue: string
          student_id: string
        }[]
      }
      secretariat_reassign_class: {
        Args: {
          _effective_on: string
          _episode: string
          _new_class: string
          _reason: string
        }
        Returns: string
      }
      secretariat_record_exit: {
        Args: {
          _destination_school: string
          _effective_on: string
          _enrollment: string
          _movement_type: string
          _reason: string
          _type_version: number
        }
        Returns: string
      }
      secretariat_teaching_candidates: {
        Args: { _on: string; _school: string }
        Returns: {
          engagement_id: string
          functional_link_logical_id: string
          functional_registration: string
          person_name: string
          position_label: string
        }[]
      }
      sector_admin_coverage_issues: {
        Args: never
        Returns: {
          capability_id: string
        }[]
      }
      sector_school_visible: { Args: { _school: string }; Returns: boolean }
      sector_station_grants: {
        Args: { _on?: string }
        Returns: {
          capability_id: string
          engagement_id: string
          principal_id: string
          rules_version: number
          school_id: string
          scope_level: string
        }[]
      }
      set_notification_preference: {
        Args: { _kind: string; _opted_out: boolean }
        Returns: undefined
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
      sigem_search_all_tokens: {
        Args: { _k: string; _toks: string[] }
        Returns: boolean
      }
      sigem_search_norm: { Args: { _t: string }; Returns: string }
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
      stage_meal_content: {
        Args: {
          _context: string
          _kind: string
          _rows: Json
          _sha256: string
          _source: string
        }
        Returns: string
      }
      start_workflow: {
        Args: {
          _comment: string
          _definition: string
          _idempotency_key: string
          _school: string
          _subject_ref: string
        }
        Returns: string
      }
      student_card_chain: {
        Args: { _school: string }
        Returns: {
          academic_year: string
          class_label: string
          kind: string
          public_id: string
          reason: string
          recorded_at: string
          student_id: string
          student_name: string
          valid_until: string
          version: number
        }[]
      }
      student_card_grant: { Args: { _school: string }; Returns: string }
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
      student_document_pendencies: {
        Args: { _school: string }
        Returns: {
          description: string
          due_on: string
          enrollment_id: string
          is_current: boolean
          note: string
          pendency_id: string
          recorded_at: string
          status: string
          student_id: string
          version: number
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
      student_photo_current: {
        Args: { _school: string; _student: string }
        Returns: string
      }
      student_school_life: {
        Args: { _school: string; _student: string }
        Returns: {
          detail: Json
          kind: string
          label: string
          occurred_on: string
          recorded_at: string
          ref_id: string
          school_id: string
          superseded: boolean
        }[]
      }
      student_trajectory_at: {
        Args: {
          _as_of: string
          _domains?: string[]
          _known_at: string
          _period?: string
          _student: string
          _year?: string
        }
        Returns: Json
      }
      studio_can: { Args: { _what: string }; Returns: boolean }
      studio_emit: {
        Args: { _facts: Json; _school_id?: string; _version: string }
        Returns: {
          emission_id: string
          snapshot_sha256: string
          verification_code: string
        }[]
      }
      studio_fixture_cleanup: { Args: { _prefix: string }; Returns: number }
      studio_is_admin: { Args: never; Returns: boolean }
      studio_save_version: {
        Args: {
          _base_template_id?: string
          _blocks: Json
          _expected_version: number
          _page: Json
          _sector: string
          _template_id: string
          _title: string
        }
        Returns: string
      }
      studio_transition: {
        Args: { _kind: string; _note?: string; _version: string }
        Returns: string
      }
      studio_version_state: { Args: { _v: string }; Returns: string }
      studio_void_emission: {
        Args: {
          _emission: string
          _kind: string
          _reason: string
          _replaced_by?: string
        }
        Returns: undefined
      }
      teacher_diary_closed: {
        Args: { _assignment: string; _period: string }
        Returns: boolean
      }
      teacher_diary_state_at: {
        Args: { _assignment: string; _on?: string; _period: string }
        Returns: {
          council_minute_id: string
          direcao_approved_at: string
          orientacao_approved_at: string
          state: string
        }[]
      }
      teacher_work_review_queue: {
        Args: { _school: string }
        Returns: {
          result_kind: string
          seq: number
          subject_id: string
          subject_kind: string
          subject_version_id: string
          submitted_at: string
          title: string
        }[]
      }
      teacher_work_reviewer: { Args: { _school: string }; Returns: string }
      teacher_work_reviews_of: {
        Args: { _kind: string; _subject: string }
        Returns: {
          by_author: boolean
          comment: string
          event: string
          recorded_at: string
          seq: number
          subject_version_id: string
        }[]
      }
      teacher_work_subject: {
        Args: { _kind: string; _subject: string; _version: string }
        Returns: {
          author_user_id: string
          is_head: boolean
          school_id: string
          title: string
        }[]
      }
      teaches_class: { Args: { _class_id: string }; Returns: boolean }
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
      teaching_candidate_engagements: {
        Args: { _on: string; _person_id: string; _school_id: string }
        Returns: {
          engagement_id: string
          position_label: string
          valid_from: string
          valid_until: string
        }[]
      }
      teaching_plans_overview_at: {
        Args: { _on: string; _school: string }
        Returns: {
          assignment_id: string
          blocks: Json
          class_id: string
          covers_from: string
          covers_until: string
          curricular_refs: Json
          period_id: string
          plan_id: string
          plan_version_id: string
          recorded_at: string
          result_kind: string
          title: string
          version: number
        }[]
      }
      teaching_staff_fit: {
        Args: {
          _domain: string
          _engagement_id: string
          _from: string
          _functional_link: string
          _school: string
          _until: string
        }
        Returns: string
      }
      teaching_substitution_effective_versions: {
        Args: { _known_at: string }
        Returns: {
          effective_from: string
          effective_until: string
          substitution_id: string
          version_id: string
        }[]
      }
      teaching_substitutions_at: {
        Args: { _class_id: string; _known_at: string; _on: string }
        Returns: {
          assignment_id: string
          effective_from: string
          effective_until: string
          functional_link_logical_id: string
          reason: string
          recorded_at: string
          source_ref: string
          substitute_engagement_id: string
          substitute_person_id: string
          substitution_id: string
          titular_engagement_id: string
          version: number
          version_id: string
        }[]
      }
      technical_automation_enabled: { Args: never; Returns: boolean }
      technical_correct_educacenso_2026_temporal: {
        Args: { _operation_kind: string; _payload: Json; _source_hash: string }
        Returns: string
      }
      technical_cpf_hmac: { Args: { _cpf: string }; Returns: string }
      technical_cpf_valid: { Args: { _cpf: string }; Returns: boolean }
      technical_import_educacenso_2026_census_panel: {
        Args: { _operation_kind: string; _payload: Json; _source_hash: string }
        Returns: string
      }
      technical_import_educacenso_2026_census_receipts: {
        Args: { _operation_kind: string; _payload: Json; _source_hash: string }
        Returns: string
      }
      technical_import_educacenso_2026_classes: {
        Args: {
          _operation_kind: string
          _payload: Json
          _snapshot: string
          _source_hash: string
        }
        Returns: string
      }
      technical_import_educacenso_2026_infrastructure: {
        Args: {
          _operation_kind: string
          _payload: Json
          _snapshot: string
          _source_hash: string
        }
        Returns: string
      }
      technical_import_educacenso_2026_professional_schedules: {
        Args: {
          _operation_kind: string
          _payload: Json
          _snapshot: string
          _source_hash: string
        }
        Returns: string
      }
      technical_import_educacenso_2026_professionals: {
        Args: {
          _operation_kind: string
          _payload: Json
          _snapshot: string
          _source_hash: string
        }
        Returns: string
      }
      technical_import_educacenso_2026_schools: {
        Args: {
          _operation_kind: string
          _schools: Json
          _snapshot: string
          _source_hash: string
        }
        Returns: string
      }
      technical_import_educacenso_2026_students_enrollments: {
        Args: { _operation_kind: string; _payload: Json; _source_hash: string }
        Returns: string
      }
      temporal_field_unknown: {
        Args: { _field: string; _id: string; _table: string }
        Returns: boolean
      }
      verify_school_document: { Args: { _code: string }; Returns: Json }
      verify_student_card: {
        Args: { _public_id: string; _version: number }
        Returns: {
          academic_year: string
          class_label: string
          public_id: string
          school_name: string
          status: string
          student_name: string
        }[]
      }
      verify_studio_document: { Args: { _code: string }; Returns: Json }
      workflow_can_read: {
        Args: { _definition: string; _opened_by: string; _school: string }
        Returns: boolean
      }
      workflow_definition_issue: { Args: { _d: Json }; Returns: string }
      workflow_has_capability: {
        Args: { _cap: string; _school: string }
        Returns: boolean
      }
      year_preparation_summary: {
        Args: { _from_year: string; _school: string; _to_year: string }
        Returns: Json
      }
      year_transition_candidates: {
        Args: { _from_year: string; _school: string; _to_year: string }
        Returns: {
          decision: string
          decision_sequence: number
          display_name: string
          resulting_enrollment_id: string
          student_id: string
        }[]
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
