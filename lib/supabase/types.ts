/**
 * Supabase generated types (audit #79).
 *
 * 생성: mcp__supabase__generate_typescript_types (재생성 2026-06).
 * 점검 fix: source_waitlist·webhook_events·payment_refund_queue·points_refunded·
 * refund_order_points 등 신규 스키마 반영 — 라우트의 as-unknown 캐스팅 의존 축소.
 */

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
      account_deletions: {
        Row: {
          deleted_at: string
          email_hash: string | null
          id: string
          open_order_count: number | null
          purged_at: string | null
          reason: string | null
          user_id: string | null
        }
        Insert: {
          deleted_at?: string
          email_hash?: string | null
          id?: string
          open_order_count?: number | null
          purged_at?: string | null
          reason?: string | null
          user_id?: string | null
        }
        Update: {
          deleted_at?: string
          email_hash?: string | null
          id?: string
          open_order_count?: number | null
          purged_at?: string | null
          reason?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      activity_logs: {
        Row: {
          activity_type: string
          amount: number | null
          created_at: string
          dog_id: string
          duration_min: number | null
          id: string
          note: string | null
          occurred_at: string
          unit: string | null
          user_id: string
        }
        Insert: {
          activity_type: string
          amount?: number | null
          created_at?: string
          dog_id: string
          duration_min?: number | null
          id?: string
          note?: string | null
          occurred_at?: string
          unit?: string | null
          user_id: string
        }
        Update: {
          activity_type?: string
          amount?: number | null
          created_at?: string
          dog_id?: string
          duration_min?: number | null
          id?: string
          note?: string | null
          occurred_at?: string
          unit?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
        ]
      }
      addresses: {
        Row: {
          address: string
          address_detail: string | null
          created_at: string
          id: string
          is_default: boolean
          label: string | null
          phone: string
          recipient_name: string
          updated_at: string
          user_id: string
          zip: string
        }
        Insert: {
          address: string
          address_detail?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          phone: string
          recipient_name: string
          updated_at?: string
          user_id: string
          zip: string
        }
        Update: {
          address?: string
          address_detail?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          phone?: string
          recipient_name?: string
          updated_at?: string
          user_id?: string
          zip?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          diff: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          diff?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          diff?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      algorithm_breed_predispose: {
        Row: {
          breed_key: string
          breed_keywords: string[]
          cautions: string[]
          citations: string[]
          enabled: boolean
          korean_label: string
          predispose_conditions: string[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          breed_key: string
          breed_keywords: string[]
          cautions?: string[]
          citations?: string[]
          enabled?: boolean
          korean_label: string
          predispose_conditions?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          breed_key?: string
          breed_keywords?: string[]
          cautions?: string[]
          citations?: string[]
          enabled?: boolean
          korean_label?: string
          predispose_conditions?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      algorithm_chronic_severity: {
        Row: {
          condition: string
          default_severity: string
          fat_factor: number
          korean_label: string
          notes: string | null
          protein_factor: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          condition: string
          default_severity: string
          fat_factor?: number
          korean_label: string
          notes?: string | null
          protein_factor?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          condition?: string
          default_severity?: string
          fat_factor?: number
          korean_label?: string
          notes?: string | null
          protein_factor?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      algorithm_food_lines: {
        Row: {
          benefit_override: string | null
          calcium_pct_dm: number | null
          fat_pct_dm: number
          kcal_per_100g: number
          line: string
          omega3_pct_dm: number | null
          omega6_pct_dm: number | null
          phosphorus_pct_dm: number | null
          protein_pct_dm: number
          sodium_pct_dm: number | null
          subtitle_override: string | null
          updated_at: string
          updated_by: string | null
          vitamin_d_iu_per_100g_dm: number | null
        }
        Insert: {
          benefit_override?: string | null
          calcium_pct_dm?: number | null
          fat_pct_dm: number
          kcal_per_100g: number
          line: string
          omega3_pct_dm?: number | null
          omega6_pct_dm?: number | null
          phosphorus_pct_dm?: number | null
          protein_pct_dm: number
          sodium_pct_dm?: number | null
          subtitle_override?: string | null
          updated_at?: string
          updated_by?: string | null
          vitamin_d_iu_per_100g_dm?: number | null
        }
        Update: {
          benefit_override?: string | null
          calcium_pct_dm?: number | null
          fat_pct_dm?: number
          kcal_per_100g?: number
          line?: string
          omega3_pct_dm?: number | null
          omega6_pct_dm?: number | null
          phosphorus_pct_dm?: number | null
          protein_pct_dm?: number
          sodium_pct_dm?: number | null
          subtitle_override?: string | null
          updated_at?: string
          updated_by?: string | null
          vitamin_d_iu_per_100g_dm?: number | null
        }
        Relationships: []
      }
      algorithm_meta_weights: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          source: string
          version: string
          weights: Json
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          source?: string
          version: string
          weights: Json
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          source?: string
          version?: string
          weights?: Json
        }
        Relationships: []
      }
      analyses: {
        Row: {
          bcs_label: string | null
          bcs_score: number | null
          ca_p_ratio: number | null
          carb_g: number | null
          carb_pct: number | null
          commentary: string | null
          created_at: string | null
          dog_id: string
          factor: number | null
          fat_g: number | null
          fat_pct: number | null
          feed_g: number | null
          fiber_g: number | null
          fiber_pct: number | null
          guideline_version: string | null
          id: string
          mer: number | null
          micronutrients: Json | null
          next_review_date: string | null
          protein_g: number | null
          protein_pct: number | null
          rer: number | null
          risk_flags: string[] | null
          stage: string | null
          structured_analysis: Json | null
          supplements: string[] | null
          survey_id: string
          user_id: string
          vet_consult_recommended: boolean
        }
        Insert: {
          bcs_label?: string | null
          bcs_score?: number | null
          ca_p_ratio?: number | null
          carb_g?: number | null
          carb_pct?: number | null
          commentary?: string | null
          created_at?: string | null
          dog_id: string
          factor?: number | null
          fat_g?: number | null
          fat_pct?: number | null
          feed_g?: number | null
          fiber_g?: number | null
          fiber_pct?: number | null
          guideline_version?: string | null
          id?: string
          mer?: number | null
          micronutrients?: Json | null
          next_review_date?: string | null
          protein_g?: number | null
          protein_pct?: number | null
          rer?: number | null
          risk_flags?: string[] | null
          stage?: string | null
          structured_analysis?: Json | null
          supplements?: string[] | null
          survey_id: string
          user_id: string
          vet_consult_recommended?: boolean
        }
        Update: {
          bcs_label?: string | null
          bcs_score?: number | null
          ca_p_ratio?: number | null
          carb_g?: number | null
          carb_pct?: number | null
          commentary?: string | null
          created_at?: string | null
          dog_id?: string
          factor?: number | null
          fat_g?: number | null
          fat_pct?: number | null
          feed_g?: number | null
          fiber_g?: number | null
          fiber_pct?: number | null
          guideline_version?: string | null
          id?: string
          mer?: number | null
          micronutrients?: Json | null
          next_review_date?: string | null
          protein_g?: number | null
          protein_pct?: number | null
          rer?: number | null
          risk_flags?: string[] | null
          stage?: string | null
          structured_analysis?: Json | null
          supplements?: string[] | null
          survey_id?: string
          user_id?: string
          vet_consult_recommended?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "analyses_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analyses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analyses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      anthropic_usage: {
        Row: {
          calls: number
          day: string
          input_tokens: number
          output_tokens: number
          route: string
          updated_at: string
        }
        Insert: {
          calls?: number
          day?: string
          input_tokens?: number
          output_tokens?: number
          route: string
          updated_at?: string
        }
        Update: {
          calls?: number
          day?: string
          input_tokens?: number
          output_tokens?: number
          route?: string
          updated_at?: string
        }
        Relationships: []
      }
      birthday_coupon_log: {
        Row: {
          coupon_code: string
          issued_at: string
          user_id: string
          year: number
        }
        Insert: {
          coupon_code: string
          issued_at?: string
          user_id: string
          year: number
        }
        Update: {
          coupon_code?: string
          issued_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      blog_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          category_id: string | null
          content: string
          cover_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          is_published: boolean
          published_at: string | null
          slug: string
          title: string
          updated_at: string
          views: number
        }
        Insert: {
          category_id?: string | null
          content: string
          cover_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          is_published?: boolean
          published_at?: string | null
          slug: string
          title: string
          updated_at?: string
          views?: number
        }
        Update: {
          category_id?: string | null
          content?: string
          cover_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          is_published?: boolean
          published_at?: string | null
          slug?: string
          title?: string
          updated_at?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "blog_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_messages: {
        Row: {
          content: string
          created_at: string
          dog_id: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          dog_id?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          dog_id?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      consent_log: {
        Row: {
          channel: string
          granted: boolean
          granted_at: string
          id: string
          ip: unknown
          policy_version: string | null
          source: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          channel: string
          granted: boolean
          granted_at?: string
          id?: string
          ip?: unknown
          policy_version?: string | null
          source?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          channel?: string
          granted?: boolean
          granted_at?: string
          id?: string
          ip?: unknown
          policy_version?: string | null
          source?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      coupon_redemptions: {
        Row: {
          coupon_id: string
          id: string
          order_id: string | null
          redeemed_at: string
          user_id: string
        }
        Insert: {
          coupon_id: string
          id?: string
          order_id?: string | null
          redeemed_at?: string
          user_id: string
        }
        Update: {
          coupon_id?: string
          id?: string
          order_id?: string | null
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          audience_type: string
          code: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_discount: number | null
          min_order_amount: number
          name: string
          per_user_limit: number | null
          starts_at: string | null
          usage_limit: number | null
          used_count: number
        }
        Insert: {
          audience_type?: string
          code: string
          created_at?: string
          description?: string | null
          discount_type: string
          discount_value: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_discount?: number | null
          min_order_amount?: number
          name: string
          per_user_limit?: number | null
          starts_at?: string | null
          usage_limit?: number | null
          used_count?: number
        }
        Update: {
          audience_type?: string
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_discount?: number | null
          min_order_amount?: number
          name?: string
          per_user_limit?: number | null
          starts_at?: string | null
          usage_limit?: number | null
          used_count?: number
        }
        Relationships: []
      }
      cron_health: {
        Row: {
          duration_ms: number | null
          error_message: string | null
          executed_at: string
          id: string
          path: string
          result_summary: Json | null
          status: string
        }
        Insert: {
          duration_ms?: number | null
          error_message?: string | null
          executed_at?: string
          id?: string
          path: string
          result_summary?: Json | null
          status: string
        }
        Update: {
          duration_ms?: number | null
          error_message?: string | null
          executed_at?: string
          id?: string
          path?: string
          result_summary?: Json | null
          status?: string
        }
        Relationships: []
      }
      cs_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          sender: string
          sender_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender: string
          sender_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender?: string
          sender_id?: string
          user_id?: string
        }
        Relationships: []
      }
      dog_checkins: {
        Row: {
          appetite_score: number | null
          checkpoint: string
          coat_score: number | null
          created_at: string
          cycle_number: number
          dog_id: string
          free_text: string | null
          id: string
          overall_satisfaction: number | null
          photo_urls: string[] | null
          responded_at: string
          stool_score: number | null
          user_id: string
        }
        Insert: {
          appetite_score?: number | null
          checkpoint: string
          coat_score?: number | null
          created_at?: string
          cycle_number: number
          dog_id: string
          free_text?: string | null
          id?: string
          overall_satisfaction?: number | null
          photo_urls?: string[] | null
          responded_at?: string
          stool_score?: number | null
          user_id: string
        }
        Update: {
          appetite_score?: number | null
          checkpoint?: string
          coat_score?: number | null
          created_at?: string
          cycle_number?: number
          dog_id?: string
          free_text?: string | null
          id?: string
          overall_satisfaction?: number | null
          photo_urls?: string[] | null
          responded_at?: string
          stool_score?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dog_checkins_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
        ]
      }
      dog_connections: {
        Row: {
          accepted_at: string | null
          context: string | null
          created_at: string
          id: string
          receiver_dog_id: string
          receiver_user_id: string
          requester_dog_id: string
          requester_user_id: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          context?: string | null
          created_at?: string
          id?: string
          receiver_dog_id: string
          receiver_user_id: string
          requester_dog_id: string
          requester_user_id: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          context?: string | null
          created_at?: string
          id?: string
          receiver_dog_id?: string
          receiver_user_id?: string
          requester_dog_id?: string
          requester_user_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "dog_connections_receiver_dog_id_fkey"
            columns: ["receiver_dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dog_connections_requester_dog_id_fkey"
            columns: ["requester_dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
        ]
      }
      dog_diary: {
        Row: {
          created_at: string
          dog_id: string
          id: string
          mood: number | null
          note: string | null
          photo_urls: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          dog_id: string
          id?: string
          mood?: number | null
          note?: string | null
          photo_urls?: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          dog_id?: string
          id?: string
          mood?: number | null
          note?: string | null
          photo_urls?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dog_diary_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
        ]
      }
      dog_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          dog_id: string
          id: string
          memo: string | null
          user_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          date: string
          dog_id: string
          id?: string
          memo?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          dog_id?: string
          id?: string
          memo?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dog_expenses_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
        ]
      }
      dog_formulas: {
        Row: {
          algorithm_version: string
          applied_from: string | null
          applied_until: string | null
          approval_status: string
          approved_at: string | null
          created_at: string
          cycle_number: number
          daily_grams: number
          daily_kcal: number
          dog_id: string
          formula: Json
          id: string
          proposed_at: string | null
          reasoning: Json
          transition_strategy: string
          updated_at: string
          user_adjusted: boolean
          user_id: string
        }
        Insert: {
          algorithm_version: string
          applied_from?: string | null
          applied_until?: string | null
          approval_status?: string
          approved_at?: string | null
          created_at?: string
          cycle_number: number
          daily_grams: number
          daily_kcal: number
          dog_id: string
          formula: Json
          id?: string
          proposed_at?: string | null
          reasoning?: Json
          transition_strategy: string
          updated_at?: string
          user_adjusted?: boolean
          user_id: string
        }
        Update: {
          algorithm_version?: string
          applied_from?: string | null
          applied_until?: string | null
          approval_status?: string
          approved_at?: string | null
          created_at?: string
          cycle_number?: number
          daily_grams?: number
          daily_kcal?: number
          dog_id?: string
          formula?: Json
          id?: string
          proposed_at?: string | null
          reasoning?: Json
          transition_strategy?: string
          updated_at?: string
          user_adjusted?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dog_formulas_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
        ]
      }
      dog_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          declined_at: string | null
          dog_id: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          declined_at?: string | null
          dog_id: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          declined_at?: string | null
          dog_id?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "dog_invitations_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
        ]
      }
      dog_medications: {
        Row: {
          created_at: string
          dog_id: string
          dose: string | null
          enabled: boolean
          id: string
          name: string
          note: string | null
          schedule: string
          time: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dog_id: string
          dose?: string | null
          enabled?: boolean
          id?: string
          name: string
          note?: string | null
          schedule: string
          time?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dog_id?: string
          dose?: string | null
          enabled?: boolean
          id?: string
          name?: string
          note?: string | null
          schedule?: string
          time?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dog_medications_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
        ]
      }
      dog_members: {
        Row: {
          accepted_at: string
          created_at: string
          dog_id: string
          id: string
          invited_by: string | null
          role: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          created_at?: string
          dog_id: string
          id?: string
          invited_by?: string | null
          role?: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          created_at?: string
          dog_id?: string
          id?: string
          invited_by?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dog_members_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
        ]
      }
      dog_progress_photos: {
        Row: {
          created_at: string
          dog_id: string
          id: string
          note: string | null
          photo_url: string
          taken_at: string
          user_id: string
          view: string | null
        }
        Insert: {
          created_at?: string
          dog_id: string
          id?: string
          note?: string | null
          photo_url: string
          taken_at?: string
          user_id: string
          view?: string | null
        }
        Update: {
          created_at?: string
          dog_id?: string
          id?: string
          note?: string | null
          photo_url?: string
          taken_at?: string
          user_id?: string
          view?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dog_progress_photos_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
        ]
      }
      dog_reminders: {
        Row: {
          created_at: string
          dog_id: string
          enabled: boolean
          id: string
          last_done_date: string | null
          next_date: string
          notes: string | null
          recur_interval_days: number | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dog_id: string
          enabled?: boolean
          id?: string
          last_done_date?: string | null
          next_date: string
          notes?: string | null
          recur_interval_days?: number | null
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dog_id?: string
          enabled?: boolean
          id?: string
          last_done_date?: string | null
          next_date?: string
          notes?: string | null
          recur_interval_days?: number | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dog_reminders_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
        ]
      }
      dog_sensitivity_snapshots: {
        Row: {
          baseline_state: Json
          created_at: string
          dog_id: string
          id: string
          results: Json
          snapshot_at: string
          top_delta: number
          top_variable: string
          user_id: string
        }
        Insert: {
          baseline_state: Json
          created_at?: string
          dog_id: string
          id?: string
          results: Json
          snapshot_at?: string
          top_delta: number
          top_variable: string
          user_id: string
        }
        Update: {
          baseline_state?: Json
          created_at?: string
          dog_id?: string
          id?: string
          results?: Json
          snapshot_at?: string
          top_delta?: number
          top_variable?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dog_sensitivity_snapshots_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
        ]
      }
      dog_vaccinations: {
        Row: {
          created_at: string
          date: string
          dog_id: string
          id: string
          next_date: string | null
          note: string | null
          updated_at: string
          user_id: string
          vaccine: string
        }
        Insert: {
          created_at?: string
          date: string
          dog_id: string
          id?: string
          next_date?: string | null
          note?: string | null
          updated_at?: string
          user_id: string
          vaccine: string
        }
        Update: {
          created_at?: string
          date?: string
          dog_id?: string
          id?: string
          next_date?: string | null
          note?: string | null
          updated_at?: string
          user_id?: string
          vaccine?: string
        }
        Relationships: [
          {
            foreignKeyName: "dog_vaccinations_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
        ]
      }
      dogs: {
        Row: {
          accuracy_user_boost: number
          activity_level: string | null
          activity_method: string
          activity_period: string | null
          age_unit: string | null
          age_value: number | null
          allergies: string[] | null
          allergies_source: string | null
          birth_date: string | null
          body_condition: string | null
          breed: string | null
          breed_size: string | null
          created_at: string | null
          feed_method: string
          food_type: string | null
          gender: string | null
          health_concerns: string[] | null
          human_food_given: boolean | null
          id: string
          name: string
          neutered: boolean | null
          photo_url: string | null
          prescription_diet: string | null
          snack_freq: string | null
          taste: string | null
          treat_frequency: string | null
          treat_types: string[] | null
          updated_at: string | null
          user_id: string
          user_method_lock: Json
          walk_intensity: string | null
          weight: number | null
          weight_measured_at: string | null
          weight_measured_by: string | null
          weight_method: string
        }
        Insert: {
          accuracy_user_boost?: number
          activity_level?: string | null
          activity_method?: string
          activity_period?: string | null
          age_unit?: string | null
          age_value?: number | null
          allergies?: string[] | null
          allergies_source?: string | null
          birth_date?: string | null
          body_condition?: string | null
          breed?: string | null
          breed_size?: string | null
          created_at?: string | null
          feed_method?: string
          food_type?: string | null
          gender?: string | null
          health_concerns?: string[] | null
          human_food_given?: boolean | null
          id?: string
          name: string
          neutered?: boolean | null
          photo_url?: string | null
          prescription_diet?: string | null
          snack_freq?: string | null
          taste?: string | null
          treat_frequency?: string | null
          treat_types?: string[] | null
          updated_at?: string | null
          user_id: string
          user_method_lock?: Json
          walk_intensity?: string | null
          weight?: number | null
          weight_measured_at?: string | null
          weight_measured_by?: string | null
          weight_method?: string
        }
        Update: {
          accuracy_user_boost?: number
          activity_level?: string | null
          activity_method?: string
          activity_period?: string | null
          age_unit?: string | null
          age_value?: number | null
          allergies?: string[] | null
          allergies_source?: string | null
          birth_date?: string | null
          body_condition?: string | null
          breed?: string | null
          breed_size?: string | null
          created_at?: string | null
          feed_method?: string
          food_type?: string | null
          gender?: string | null
          health_concerns?: string[] | null
          human_food_given?: boolean | null
          id?: string
          name?: string
          neutered?: boolean | null
          photo_url?: string | null
          prescription_diet?: string | null
          snack_freq?: string | null
          taste?: string | null
          treat_frequency?: string | null
          treat_types?: string[] | null
          updated_at?: string | null
          user_id?: string
          user_method_lock?: Json
          walk_intensity?: string | null
          weight?: number | null
          weight_measured_at?: string | null
          weight_measured_by?: string | null
          weight_method?: string
        }
        Relationships: [
          {
            foreignKeyName: "dogs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_suppressions: {
        Row: {
          created_at: string
          email: string
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          reason?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          coupon_code: string | null
          created_at: string
          cta_secondary: Json | null
          cta_variant: string
          detail_lede: string
          en_title: string
          ends_at: string
          highlight: string
          id: string
          image_alt: string | null
          image_url: string | null
          is_active: boolean
          kicker: string
          kind: string
          ko_subtitle: string
          palette: string
          perks: Json
          slug: string
          sort_priority: number
          starts_at: string
          status_label: string
          tagline: string
          terms: Json
          updated_at: string
        }
        Insert: {
          coupon_code?: string | null
          created_at?: string
          cta_secondary?: Json | null
          cta_variant?: string
          detail_lede?: string
          en_title: string
          ends_at: string
          highlight: string
          id?: string
          image_alt?: string | null
          image_url?: string | null
          is_active?: boolean
          kicker: string
          kind?: string
          ko_subtitle: string
          palette?: string
          perks?: Json
          slug: string
          sort_priority?: number
          starts_at: string
          status_label?: string
          tagline: string
          terms?: Json
          updated_at?: string
        }
        Update: {
          coupon_code?: string | null
          created_at?: string
          cta_secondary?: Json | null
          cta_variant?: string
          detail_lede?: string
          en_title?: string
          ends_at?: string
          highlight?: string
          id?: string
          image_alt?: string | null
          image_url?: string | null
          is_active?: boolean
          kicker?: string
          kind?: string
          ko_subtitle?: string
          palette?: string
          perks?: Json
          slug?: string
          sort_priority?: number
          starts_at?: string
          status_label?: string
          tagline?: string
          terms?: Json
          updated_at?: string
        }
        Relationships: []
      }
      faqs: {
        Row: {
          answer: string
          category: string
          created_at: string
          id: string
          is_published: boolean
          question: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          answer: string
          category: string
          created_at?: string
          id?: string
          is_published?: boolean
          question: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          answer?: string
          category?: string
          created_at?: string
          id?: string
          is_published?: boolean
          question?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      feeding_outcomes: {
        Row: {
          bcs_score: number | null
          bristol_score: number | null
          cohort_id: string
          comment: string | null
          created_at: string
          dog_id: string
          id: string
          order_id: string | null
          palatability: string | null
          photo_url: string | null
          rating_stars: number | null
          reason_category: string | null
          reason_detail: string | null
          sku_code: string | null
          source: string
          subscription_id: string | null
          user_id: string
          week_no: number | null
          weight_kg: number | null
        }
        Insert: {
          bcs_score?: number | null
          bristol_score?: number | null
          cohort_id?: string
          comment?: string | null
          created_at?: string
          dog_id: string
          id?: string
          order_id?: string | null
          palatability?: string | null
          photo_url?: string | null
          rating_stars?: number | null
          reason_category?: string | null
          reason_detail?: string | null
          sku_code?: string | null
          source: string
          subscription_id?: string | null
          user_id: string
          week_no?: number | null
          weight_kg?: number | null
        }
        Update: {
          bcs_score?: number | null
          bristol_score?: number | null
          cohort_id?: string
          comment?: string | null
          created_at?: string
          dog_id?: string
          id?: string
          order_id?: string | null
          palatability?: string | null
          photo_url?: string | null
          rating_stars?: number | null
          reason_category?: string | null
          reason_detail?: string | null
          sku_code?: string | null
          source?: string
          subscription_id?: string | null
          user_id?: string
          week_no?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "feeding_outcomes_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feeding_outcomes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feeding_outcomes_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      health_logs: {
        Row: {
          activity_level: string | null
          appetite: string | null
          created_at: string
          dog_id: string
          id: string
          logged_at: string
          mood: string | null
          note: string | null
          poop_count: number | null
          poop_quality: string | null
          user_id: string
        }
        Insert: {
          activity_level?: string | null
          appetite?: string | null
          created_at?: string
          dog_id: string
          id?: string
          logged_at?: string
          mood?: string | null
          note?: string | null
          poop_count?: number | null
          poop_quality?: string | null
          user_id: string
        }
        Update: {
          activity_level?: string | null
          appetite?: string | null
          created_at?: string
          dog_id?: string
          id?: string
          logged_at?: string
          mood?: string | null
          note?: string | null
          poop_count?: number | null
          poop_quality?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_logs_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
        ]
      }
      inactive_coupon_log: {
        Row: {
          coupon_code: string
          sent_at: string
          user_id: string
          year_month: string
        }
        Insert: {
          coupon_code: string
          sent_at?: string
          user_id: string
          year_month: string
        }
        Update: {
          coupon_code?: string
          sent_at?: string
          user_id?: string
          year_month?: string
        }
        Relationships: []
      }
      manual_coupon_grants: {
        Row: {
          coupon_id: string
          granted_at: string
          granted_by: string | null
          user_id: string
        }
        Insert: {
          coupon_id: string
          granted_at?: string
          granted_by?: string | null
          user_id: string
        }
        Update: {
          coupon_id?: string
          granted_at?: string
          granted_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_coupon_grants_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_records: {
        Row: {
          attached_image_url: string | null
          created_at: string
          diagnosis: string[]
          dog_id: string
          id: string
          medications: Json
          ocr_confidence: number | null
          source: string
          user_id: string
          vet_notes: string | null
          visit_date: string | null
          weight_kg: number | null
        }
        Insert: {
          attached_image_url?: string | null
          created_at?: string
          diagnosis?: string[]
          dog_id: string
          id?: string
          medications?: Json
          ocr_confidence?: number | null
          source?: string
          user_id: string
          vet_notes?: string | null
          visit_date?: string | null
          weight_kg?: number | null
        }
        Update: {
          attached_image_url?: string | null
          created_at?: string
          diagnosis?: string[]
          dog_id?: string
          id?: string
          medications?: Json
          ocr_confidence?: number | null
          source?: string
          user_id?: string
          vet_notes?: string | null
          visit_date?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_records_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_learning_events: {
        Row: {
          arm_id: string
          context: string
          created_at: string
          id: string
          meta: Json | null
          reward: number
          user_id: string | null
        }
        Insert: {
          arm_id: string
          context: string
          created_at?: string
          id?: string
          meta?: Json | null
          reward: number
          user_id?: string | null
        }
        Update: {
          arm_id?: string
          context?: string
          created_at?: string
          id?: string
          meta?: Json | null
          reward?: number
          user_id?: string | null
        }
        Relationships: []
      }
      native_push_tokens: {
        Row: {
          app_version: string | null
          created_at: string
          device_id: string | null
          id: string
          os_version: string | null
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          os_version?: string | null
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          app_version?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          os_version?: string | null
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          confirm_token: string | null
          confirmed_at: string | null
          created_at: string
          email: string
          id: string
          last_sent_at: string | null
          source: string | null
          status: string
          unsubscribe_token: string
          unsubscribed_at: string | null
          user_id: string | null
        }
        Insert: {
          confirm_token?: string | null
          confirmed_at?: string | null
          created_at?: string
          email: string
          id?: string
          last_sent_at?: string | null
          source?: string | null
          status?: string
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          user_id?: string | null
        }
        Update: {
          confirm_token?: string | null
          confirmed_at?: string | null
          created_at?: string
          email?: string
          id?: string
          last_sent_at?: string | null
          source?: string | null
          status?: string
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          cancelled_at: string | null
          created_at: string
          id: string
          line_total: number
          order_id: string
          product_id: string
          product_image_url: string | null
          product_name: string
          quantity: number
          refunded_amount: number
          unit_price: number
          variant_id: string | null
          variant_name: string | null
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          id?: string
          line_total: number
          order_id: string
          product_id: string
          product_image_url?: string | null
          product_name: string
          quantity: number
          refunded_amount?: number
          unit_price: number
          variant_id?: string | null
          variant_name?: string | null
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          id?: string
          line_total?: number
          order_id?: string
          product_id?: string
          product_image_url?: string | null
          product_name?: string
          quantity?: number
          refunded_amount?: number
          unit_price?: number
          variant_id?: string | null
          variant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string
          address_detail: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          carrier: string | null
          cash_receipt_number: string | null
          cash_receipt_type: string | null
          coupon_code: string | null
          created_at: string
          delivered_at: string | null
          delivery_memo: string | null
          discount_amount: number
          id: string
          order_number: string
          order_status: string
          paid_at: string | null
          payment_key: string | null
          payment_method: string | null
          payment_status: string
          points_earned: number
          points_refunded: number
          points_used: number
          receipt_url: string | null
          recipient_name: string
          recipient_phone: string
          refunded_amount: number
          shipped_at: string | null
          shipping_fee: number
          subscription_id: string | null
          subtotal: number
          total_amount: number
          tracking_number: string | null
          updated_at: string
          user_id: string
          virtual_account_bank: string | null
          virtual_account_due_date: string | null
          virtual_account_holder: string | null
          virtual_account_number: string | null
          zip: string
        }
        Insert: {
          address: string
          address_detail?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          carrier?: string | null
          cash_receipt_number?: string | null
          cash_receipt_type?: string | null
          coupon_code?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_memo?: string | null
          discount_amount?: number
          id?: string
          order_number: string
          order_status?: string
          paid_at?: string | null
          payment_key?: string | null
          payment_method?: string | null
          payment_status?: string
          points_earned?: number
          points_refunded?: number
          points_used?: number
          receipt_url?: string | null
          recipient_name: string
          recipient_phone: string
          refunded_amount?: number
          shipped_at?: string | null
          shipping_fee?: number
          subscription_id?: string | null
          subtotal: number
          total_amount: number
          tracking_number?: string | null
          updated_at?: string
          user_id: string
          virtual_account_bank?: string | null
          virtual_account_due_date?: string | null
          virtual_account_holder?: string | null
          virtual_account_number?: string | null
          zip: string
        }
        Update: {
          address?: string
          address_detail?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          carrier?: string | null
          cash_receipt_number?: string | null
          cash_receipt_type?: string | null
          coupon_code?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_memo?: string | null
          discount_amount?: number
          id?: string
          order_number?: string
          order_status?: string
          paid_at?: string | null
          payment_key?: string | null
          payment_method?: string | null
          payment_status?: string
          points_earned?: number
          points_refunded?: number
          points_used?: number
          receipt_url?: string | null
          recipient_name?: string
          recipient_phone?: string
          refunded_amount?: number
          shipped_at?: string | null
          shipping_fee?: number
          subscription_id?: string | null
          subtotal?: number
          total_amount?: number
          tracking_number?: string | null
          updated_at?: string
          user_id?: string
          virtual_account_bank?: string | null
          virtual_account_due_date?: string | null
          virtual_account_holder?: string | null
          virtual_account_number?: string | null
          zip?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          body: string
          cert: string | null
          created_at: string
          id: string
          image_url: string | null
          ingredient: string
          is_published: boolean
          name: string
          region: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          body: string
          cert?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          ingredient: string
          is_published?: boolean
          name: string
          region: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          body?: string
          cert?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          ingredient?: string
          is_published?: boolean
          name?: string
          region?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      payment_events: {
        Row: {
          actor_user_id: string | null
          amount: number
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          new_status: string | null
          order_id: string
          payment_key: string | null
          prev_status: string | null
          source: string
        }
        Insert: {
          actor_user_id?: string | null
          amount: number
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          new_status?: string | null
          order_id: string
          payment_key?: string | null
          prev_status?: string | null
          source: string
        }
        Update: {
          actor_user_id?: string | null
          amount?: number
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          new_status?: string | null
          order_id?: string
          payment_key?: string | null
          prev_status?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_refund_queue: {
        Row: {
          amount: number
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          next_retry_at: string
          order_id: string
          payment_key: string
          reason: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          next_retry_at?: string
          order_id: string
          payment_key: string
          reason: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          next_retry_at?: string
          order_id?: string
          payment_key?: string
          reason?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_refund_queue_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_request_tokens: {
        Row: {
          applied_at: string | null
          created_at: string
          created_by: string
          dog_id: string
          expires_at: string
          id: string
          revoked_at: string | null
          token: string
          uploaded_at: string | null
          uploaded_photo_url: string | null
        }
        Insert: {
          applied_at?: string | null
          created_at?: string
          created_by: string
          dog_id: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          token: string
          uploaded_at?: string | null
          uploaded_photo_url?: string | null
        }
        Update: {
          applied_at?: string | null
          created_at?: string
          created_by?: string
          dog_id?: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          token?: string
          uploaded_at?: string | null
          uploaded_photo_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "photo_request_tokens_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
        ]
      }
      point_ledger: {
        Row: {
          balance_after: number
          created_at: string
          delta: number
          id: string
          reason: string
          reference_id: string | null
          reference_type: string | null
          user_id: string
        }
        Insert: {
          balance_after: number
          created_at?: string
          delta: number
          id?: string
          reason: string
          reference_id?: string | null
          reference_type?: string | null
          user_id: string
        }
        Update: {
          balance_after?: number
          created_at?: string
          delta?: number
          id?: string
          reason?: string
          reference_id?: string | null
          reference_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      product_qna: {
        Row: {
          answer: string | null
          answered_at: string | null
          answered_by: string | null
          created_at: string
          id: string
          is_private: boolean
          product_id: string
          question: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          answered_by?: string | null
          created_at?: string
          id?: string
          is_private?: boolean
          product_id: string
          question: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          answered_by?: string | null
          created_at?: string
          id?: string
          is_private?: boolean
          product_id?: string
          question?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_qna_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          allergens: string[] | null
          category: string | null
          certifications: string[] | null
          country_of_packaging: string | null
          created_at: string | null
          description: string | null
          feeding_guide: string | null
          gallery_urls: string[]
          id: string
          image_url: string | null
          ingredients: string | null
          is_active: boolean | null
          is_subscribable: boolean | null
          manufacture_date_policy: string | null
          manufacturer: string | null
          manufacturer_address: string | null
          meta_description: string | null
          name: string
          net_weight_g: number | null
          nutrition_facts: Json | null
          origin: string | null
          pet_food_class: string | null
          price: number
          sale_price: number | null
          sales_count: number
          shelf_life_days: number | null
          short_description: string | null
          sku: string | null
          slug: string
          sort_order: number | null
          stock: number | null
          storage_method: string | null
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          allergens?: string[] | null
          category?: string | null
          certifications?: string[] | null
          country_of_packaging?: string | null
          created_at?: string | null
          description?: string | null
          feeding_guide?: string | null
          gallery_urls?: string[]
          id?: string
          image_url?: string | null
          ingredients?: string | null
          is_active?: boolean | null
          is_subscribable?: boolean | null
          manufacture_date_policy?: string | null
          manufacturer?: string | null
          manufacturer_address?: string | null
          meta_description?: string | null
          name: string
          net_weight_g?: number | null
          nutrition_facts?: Json | null
          origin?: string | null
          pet_food_class?: string | null
          price: number
          sale_price?: number | null
          sales_count?: number
          shelf_life_days?: number | null
          short_description?: string | null
          sku?: string | null
          slug: string
          sort_order?: number | null
          stock?: number | null
          storage_method?: string | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          allergens?: string[] | null
          category?: string | null
          certifications?: string[] | null
          country_of_packaging?: string | null
          created_at?: string | null
          description?: string | null
          feeding_guide?: string | null
          gallery_urls?: string[]
          id?: string
          image_url?: string | null
          ingredients?: string | null
          is_active?: boolean | null
          is_subscribable?: boolean | null
          manufacture_date_policy?: string | null
          manufacturer?: string | null
          manufacturer_address?: string | null
          meta_description?: string | null
          name?: string
          net_weight_g?: number | null
          nutrition_facts?: Json | null
          origin?: string | null
          pet_food_class?: string | null
          price?: number
          sale_price?: number | null
          sales_count?: number
          shelf_life_days?: number | null
          short_description?: string | null
          sku?: string | null
          slug?: string
          sort_order?: number | null
          stock?: number | null
          storage_method?: string | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          address_detail: string | null
          agree_email: boolean | null
          agree_email_at: string | null
          agree_sms: boolean | null
          agree_sms_at: string | null
          birth_day: number | null
          birth_month: number | null
          birth_year: number | null
          consent_level: number
          consent_max_rewarded_level: number
          created_at: string | null
          cumulative_spend: number
          deleted_at: string | null
          email: string | null
          id: string
          marketing_policy_version: string | null
          name: string | null
          notifications_last_seen_at: string | null
          onboarded_at: string | null
          phone: string | null
          role: string | null
          stamp_count: number
          tier: string
          tier_updated_at: string | null
          updated_at: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          address_detail?: string | null
          agree_email?: boolean | null
          agree_email_at?: string | null
          agree_sms?: boolean | null
          agree_sms_at?: string | null
          birth_day?: number | null
          birth_month?: number | null
          birth_year?: number | null
          consent_level?: number
          consent_max_rewarded_level?: number
          created_at?: string | null
          cumulative_spend?: number
          deleted_at?: string | null
          email?: string | null
          id: string
          marketing_policy_version?: string | null
          name?: string | null
          notifications_last_seen_at?: string | null
          onboarded_at?: string | null
          phone?: string | null
          role?: string | null
          stamp_count?: number
          tier?: string
          tier_updated_at?: string | null
          updated_at?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          address_detail?: string | null
          agree_email?: boolean | null
          agree_email_at?: string | null
          agree_sms?: boolean | null
          agree_sms_at?: string | null
          birth_day?: number | null
          birth_month?: number | null
          birth_year?: number | null
          consent_level?: number
          consent_max_rewarded_level?: number
          created_at?: string | null
          cumulative_spend?: number
          deleted_at?: string | null
          email?: string | null
          id?: string
          marketing_policy_version?: string | null
          name?: string | null
          notifications_last_seen_at?: string | null
          onboarded_at?: string | null
          phone?: string | null
          role?: string | null
          stamp_count?: number
          tier?: string
          tier_updated_at?: string | null
          updated_at?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      push_campaigns: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          failed_count: number
          id: string
          recipient_count: number
          segment: string
          sent_count: number
          title: string
          url: string | null
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          failed_count?: number
          id?: string
          recipient_count?: number
          segment: string
          sent_count?: number
          title: string
          url?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          failed_count?: number
          id?: string
          recipient_count?: number
          segment?: string
          sent_count?: number
          title?: string
          url?: string | null
        }
        Relationships: []
      }
      promotion_claims: {
        Row: {
          claimed_at: string
          id: string
          promotion_id: string
          redeemed_at: string | null
          redeemed_order_id: string | null
          user_id: string
        }
        Insert: {
          claimed_at?: string
          id?: string
          promotion_id: string
          redeemed_at?: string | null
          redeemed_order_id?: string | null
          user_id: string
        }
        Update: {
          claimed_at?: string
          id?: string
          promotion_id?: string
          redeemed_at?: string | null
          redeemed_order_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      promotions: {
        Row: {
          active: boolean
          code: string
          created_at: string
          discount_rate: number
          ends_at: string
          id: string
          max_signups: number | null
          name: string
          starts_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          discount_rate: number
          ends_at: string
          id?: string
          max_signups?: number | null
          name: string
          starts_at: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          discount_rate?: number
          ends_at?: string
          id?: string
          max_signups?: number | null
          name?: string
          starts_at?: string
        }
        Relationships: []
      }
      push_log: {
        Row: {
          body: string
          category: string | null
          id: string
          nudge: boolean
          metadata: Json | null
          read_at: string | null
          sent_at: string
          sent_count: number
          title: string
          url: string | null
          user_id: string
        }
        Insert: {
          body: string
          category?: string | null
          id?: string
          nudge?: boolean
          metadata?: Json | null
          read_at?: string | null
          sent_at?: string
          sent_count?: number
          title: string
          url?: string | null
          user_id: string
        }
        Update: {
          body?: string
          category?: string | null
          id?: string
          nudge?: boolean
          metadata?: Json | null
          read_at?: string | null
          sent_at?: string
          sent_count?: number
          title?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      push_preferences: {
        Row: {
          notify_health: boolean
          notify_marketing: boolean
          notify_order: boolean
          quiet_hours_end: number | null
          quiet_hours_start: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          notify_health?: boolean
          notify_marketing?: boolean
          notify_order?: boolean
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          notify_health?: boolean
          notify_marketing?: boolean
          notify_order?: boolean
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rate_limit_counters: {
        Row: {
          bucket: string
          count: number
          key: string
          updated_at: string
          window_start_ms: number
        }
        Insert: {
          bucket: string
          count?: number
          key: string
          updated_at?: string
          window_start_ms: number
        }
        Update: {
          bucket?: string
          count?: number
          key?: string
          updated_at?: string
          window_start_ms?: number
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_milestone_rewards: {
        Row: {
          granted_at: string
          id: string
          milestone: number
          reward_type: string
          reward_value: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          id?: string
          milestone: number
          reward_type: string
          reward_value: string
          user_id: string
        }
        Update: {
          granted_at?: string
          id?: string
          milestone?: number
          reward_type?: string
          reward_value?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_redemptions: {
        Row: {
          id: string
          redeemed_at: string
          referee_id: string
          referrer_id: string
        }
        Insert: {
          id?: string
          redeemed_at?: string
          referee_id: string
          referrer_id: string
        }
        Update: {
          id?: string
          redeemed_at?: string
          referee_id?: string
          referrer_id?: string
        }
        Relationships: []
      }
      refunds: {
        Row: {
          amount: number
          id: string
          is_partial: boolean
          order_id: string
          order_item_ids: string[] | null
          reason: string | null
          refunded_at: string
          refunded_by: string | null
          status: string
          toss_transaction_key: string | null
          user_id: string
        }
        Insert: {
          amount: number
          id?: string
          is_partial?: boolean
          order_id: string
          order_item_ids?: string[] | null
          reason?: string | null
          refunded_at?: string
          refunded_by?: string | null
          status?: string
          toss_transaction_key?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          id?: string
          is_partial?: boolean
          order_id?: string
          order_item_ids?: string[] | null
          reason?: string | null
          refunded_at?: string
          refunded_by?: string | null
          status?: string
          toss_transaction_key?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      source_waitlist: {
        Row: {
          concern: string
          created_at: string
          dog_id: string | null
          id: string
          notified_at: string | null
          user_id: string
        }
        Insert: {
          concern: string
          created_at?: string
          dog_id?: string | null
          id?: string
          notified_at?: string | null
          user_id: string
        }
        Update: {
          concern?: string
          created_at?: string
          dog_id?: string | null
          id?: string
          notified_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_waitlist_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_charges: {
        Row: {
          amount: number
          attempted_at: string
          completed_at: string | null
          error_code: string | null
          error_message: string | null
          id: string
          order_id: string | null
          payment_key: string | null
          scheduled_for: string
          status: string
          subscription_id: string
          user_id: string
        }
        Insert: {
          amount: number
          attempted_at?: string
          completed_at?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          order_id?: string | null
          payment_key?: string | null
          scheduled_for: string
          status: string
          subscription_id: string
          user_id: string
        }
        Update: {
          amount?: number
          attempted_at?: string
          completed_at?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          order_id?: string | null
          payment_key?: string | null
          scheduled_for?: string
          status?: string
          subscription_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_charges_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          product_image_url: string | null
          product_name: string
          quantity: number
          subscription_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          product_image_url?: string | null
          product_name: string
          quantity: number
          subscription_id: string
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          product_image_url?: string | null
          product_name?: string
          quantity?: number
          subscription_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "subscription_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_items_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      stamps: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          order_id: string | null
          stamped_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          order_id?: string | null
          stamped_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          order_id?: string | null
          stamped_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          address: string
          address_detail: string | null
          billing_card_brand: string | null
          billing_card_last4: string | null
          billing_customer_key: string | null
          billing_key: string | null
          cancelled_at: string | null
          coverage_weeks: number
          created_at: string
          fresh_ratio: number | null
          delivery_memo: string | null
          dog_id: string | null
          failed_charge_count: number
          id: string
          interval_weeks: number
          last_charged_at: string | null
          last_delivery_date: string | null
          last_failed_charge_at: string | null
          last_failed_charge_code: string | null
          last_failed_charge_reason: string | null
          mix_ratio: number | null
          next_delivery_date: string | null
          next_retry_at: string | null
          recipient_name: string
          recipient_phone: string
          reminder_days_before: number
          reminder_enabled: boolean
          requires_billing_key_renewal: boolean
          shipping_fee: number
          sku_size_g: number | null
          status: string
          subtotal: number
          total_amount: number
          total_deliveries: number
          updated_at: string
          user_id: string
          zip: string
        }
        Insert: {
          address: string
          address_detail?: string | null
          billing_card_brand?: string | null
          billing_card_last4?: string | null
          billing_customer_key?: string | null
          billing_key?: string | null
          cancelled_at?: string | null
          coverage_weeks?: number
          fresh_ratio?: number | null
          created_at?: string
          delivery_memo?: string | null
          dog_id?: string | null
          failed_charge_count?: number
          id?: string
          interval_weeks: number
          last_charged_at?: string | null
          last_delivery_date?: string | null
          last_failed_charge_at?: string | null
          last_failed_charge_code?: string | null
          last_failed_charge_reason?: string | null
          mix_ratio?: number | null
          next_delivery_date: string | null
          next_retry_at?: string | null
          recipient_name: string
          recipient_phone: string
          reminder_days_before?: number
          reminder_enabled?: boolean
          requires_billing_key_renewal?: boolean
          shipping_fee?: number
          sku_size_g?: number | null
          status?: string
          subtotal: number
          total_amount: number
          total_deliveries?: number
          updated_at?: string
          user_id: string
          zip: string
        }
        Update: {
          address?: string
          address_detail?: string | null
          billing_card_brand?: string | null
          billing_card_last4?: string | null
          billing_customer_key?: string | null
          billing_key?: string | null
          cancelled_at?: string | null
          coverage_weeks?: number
          fresh_ratio?: number | null
          created_at?: string
          delivery_memo?: string | null
          dog_id?: string | null
          failed_charge_count?: number
          id?: string
          interval_weeks?: number
          last_charged_at?: string | null
          last_delivery_date?: string | null
          last_failed_charge_at?: string | null
          last_failed_charge_code?: string | null
          last_failed_charge_reason?: string | null
          mix_ratio?: number | null
          next_delivery_date?: string | null
          next_retry_at?: string | null
          recipient_name?: string
          recipient_phone?: string
          reminder_days_before?: number
          reminder_enabled?: boolean
          requires_billing_key_renewal?: boolean
          shipping_fee?: number
          sku_size_g?: number | null
          status?: string
          subtotal?: number
          total_amount?: number
          total_deliveries?: number
          updated_at?: string
          user_id?: string
          zip?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
        ]
      }
      surveys: {
        Row: {
          answers: Json
          appetite: string | null
          bristol_stool_score: number | null
          budget_tier: string | null
          care_goal: string | null
          chronic_conditions: string[] | null
          coat_condition: string | null
          created_at: string | null
          current_diet_satisfaction: number | null
          current_food_brand: string | null
          current_medications: string[] | null
          daily_walk_minutes: number | null
          dog_id: string
          expected_adult_weight_kg: number | null
          gi_sensitivity: string | null
          home_cooking_experience: string | null
          id: string
          indoor_activity: string | null
          iris_stage: number | null
          litter_size: number | null
          mcs_score: number | null
          preferred_proteins: string[] | null
          pregnancy_status: string | null
          pregnancy_week: number | null
          user_id: string
          weight_trend_6mo: string | null
        }
        Insert: {
          answers: Json
          appetite?: string | null
          bristol_stool_score?: number | null
          budget_tier?: string | null
          care_goal?: string | null
          chronic_conditions?: string[] | null
          coat_condition?: string | null
          created_at?: string | null
          current_diet_satisfaction?: number | null
          current_food_brand?: string | null
          current_medications?: string[] | null
          daily_walk_minutes?: number | null
          dog_id: string
          expected_adult_weight_kg?: number | null
          gi_sensitivity?: string | null
          home_cooking_experience?: string | null
          id?: string
          indoor_activity?: string | null
          iris_stage?: number | null
          litter_size?: number | null
          mcs_score?: number | null
          preferred_proteins?: string[] | null
          pregnancy_status?: string | null
          pregnancy_week?: number | null
          user_id: string
          weight_trend_6mo?: string | null
        }
        Update: {
          answers?: Json
          appetite?: string | null
          bristol_stool_score?: number | null
          budget_tier?: string | null
          care_goal?: string | null
          chronic_conditions?: string[] | null
          coat_condition?: string | null
          created_at?: string | null
          current_diet_satisfaction?: number | null
          current_food_brand?: string | null
          current_medications?: string[] | null
          daily_walk_minutes?: number | null
          dog_id?: string
          expected_adult_weight_kg?: number | null
          gi_sensitivity?: string | null
          home_cooking_experience?: string | null
          id?: string
          indoor_activity?: string | null
          iris_stage?: number | null
          litter_size?: number | null
          mcs_score?: number | null
          preferred_proteins?: string[] | null
          pregnancy_status?: string | null
          pregnancy_week?: number | null
          user_id?: string
          weight_trend_6mo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "surveys_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_integrations: {
        Row: {
          access_token: string | null
          created_at: string
          expires_at: string | null
          external_user_id: string | null
          id: string
          last_synced_at: string | null
          provider: string
          refresh_token: string | null
          scope: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          expires_at?: string | null
          external_user_id?: string | null
          id?: string
          last_synced_at?: string | null
          provider: string
          refresh_token?: string | null
          scope?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          expires_at?: string | null
          external_user_id?: string | null
          id?: string
          last_synced_at?: string | null
          provider?: string
          refresh_token?: string | null
          scope?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vet_share_tokens: {
        Row: {
          accessed_count: number
          created_at: string
          created_by: string
          dog_id: string
          expires_at: string
          id: string
          last_accessed_at: string | null
          revoked_at: string | null
          token: string
        }
        Insert: {
          accessed_count?: number
          created_at?: string
          created_by: string
          dog_id: string
          expires_at?: string
          id?: string
          last_accessed_at?: string | null
          revoked_at?: string | null
          token: string
        }
        Update: {
          accessed_count?: number
          created_at?: string
          created_by?: string
          dog_id?: string
          expires_at?: string
          id?: string
          last_accessed_at?: string | null
          revoked_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "vet_share_tokens_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
        ]
      }
      vip_coupon_log: {
        Row: {
          coupon_code: string
          sent_at: string
          tier: string
          user_id: string
          year_month: string
        }
        Insert: {
          coupon_code: string
          sent_at?: string
          tier: string
          user_id: string
          year_month: string
        }
        Update: {
          coupon_code?: string
          sent_at?: string
          tier?: string
          user_id?: string
          year_month?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          created_at: string
          event_key: string
          id: string
          order_id: string | null
          payment_key: string | null
          provider: string
          status: string | null
        }
        Insert: {
          created_at?: string
          event_key: string
          id?: string
          order_id?: string | null
          payment_key?: string | null
          provider?: string
          status?: string | null
        }
        Update: {
          created_at?: string
          event_key?: string
          id?: string
          order_id?: string | null
          payment_key?: string | null
          provider?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      weight_logs: {
        Row: {
          created_at: string
          dog_id: string
          id: string
          measured_at: string
          note: string | null
          user_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          dog_id: string
          id?: string
          measured_at?: string
          note?: string | null
          user_id: string
          weight: number
        }
        Update: {
          created_at?: string
          dog_id?: string
          id?: string
          measured_at?: string
          note?: string | null
          user_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "weight_logs_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      arm_stats: {
        Row: {
          arm_id: string | null
          context: string | null
          last_used_at: string | null
          mean_reward: number | null
          total_reward: number | null
          trials: number | null
        }
        Relationships: []
      }
      dog_invitations_public: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          declined_at: string | null
          dog_id: string | null
          email: string | null
          expires_at: string | null
          id: string | null
          invited_by: string | null
          role: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          declined_at?: string | null
          dog_id?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string | null
          invited_by?: string | null
          role?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          declined_at?: string | null
          dog_id?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string | null
          invited_by?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dog_invitations_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_dog_invitation: {
        Args: { p_token: string }
        Returns: {
          dog_id: string
          message: string
          ok: boolean
        }[]
      }
      apply_point_delta: {
        Args: {
          p_delta: number
          p_reason: string
          p_reference_id: string
          p_reference_type: string
          p_user_id: string
        }
        Returns: {
          balance_after: number
          message: string
          ok: boolean
        }[]
      }
      avg_daily_feed_grams: {
        Args: { p_user_id: string; p_window_days?: number }
        Returns: number
      }
      cohort_ltv_weekly: {
        Args: { weeks_back?: number }
        Returns: {
          cohort_size: number
          cohort_week: string
          ltv_d30: number
          ltv_d7: number
          ltv_d90: number
          ltv_total: number
        }[]
      }
      dashboard_user_snapshot: { Args: { p_user_id: string }; Returns: Json }
      feed_intake_history: {
        Args: { p_user_id: string }
        Returns: {
          paid_date: string
          product_count: number
          total_grams: number
        }[]
      }
      fetch_photo_request: { Args: { p_token: string }; Returns: Json }
      fetch_vet_share: { Args: { p_token: string }; Returns: Json }
      fn_compute_tier: { Args: { spend: number }; Returns: string }
      get_or_create_my_referral_code: { Args: never; Returns: string }
      has_dog_access: { Args: { p_dog_id: string }; Returns: boolean }
      has_dog_role: {
        Args: { p_dog_id: string; p_min_role: string }
        Returns: boolean
      }
      incr_anthropic_usage: {
        Args: {
          p_calls?: number
          p_input_tokens?: number
          p_output_tokens?: number
          p_route: string
        }
        Returns: undefined
      }
      incr_rate_limit_counter: {
        Args: { p_bucket: string; p_key: string; p_window_start_ms: number }
        Returns: number
      }
      increment_blog_view: { Args: { post_slug: string }; Returns: undefined }
      is_admin: { Args: never; Returns: boolean }
      issue_referral_milestones: { Args: never; Returns: Json }
      lookup_invitation_by_token: {
        Args: { p_token: string }
        Returns: {
          accepted_at: string
          created_at: string
          declined_at: string
          dog_id: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: string
        }[]
      }
      record_reward_event: {
        Args: {
          p_arm_id: string
          p_context: string
          p_meta?: Json
          p_reward: number
          p_user_id?: string
        }
        Returns: string
      }
      redeem_coupon: {
        Args: { p_coupon_id: string; p_order_id: string; p_user_id: string }
        Returns: {
          message: string
          ok: boolean
        }[]
      }
      redeem_referral_code: { Args: { input_code: string }; Returns: Json }
      refund_order_points: {
        Args: {
          p_order_id: string
          p_reason: string
          p_reference_id: string
          p_request: number
          p_user_id: string
        }
        Returns: number
      }
      reserve_order_stock: { Args: { items: Json }; Returns: Json }
      restore_stock: {
        Args: { p_product_id: string; p_qty: number }
        Returns: number
      }
      revoke_coupon_redemption: {
        Args: { p_coupon_code: string }
        Returns: {
          message: string
          ok: boolean
        }[]
      }
      set_consent_level: { Args: { p_level: number }; Returns: Json }
      set_marketing_consent: {
        Args: {
          p_channel: string
          p_granted: boolean
          p_policy_version?: string
          p_source?: string
        }
        Returns: undefined
      }
      sha256_hex: { Args: { input: string }; Returns: string }
      submit_photo_request: {
        Args: { p_photo_url: string; p_token: string }
        Returns: Json
      }
      sum_anthropic_calls_today: { Args: never; Returns: number }
      sweep_rate_limit_counters: { Args: never; Returns: number }
      upsert_cart_item: {
        Args: {
          p_max_qty?: number
          p_product_id: string
          p_quantity: number
          p_user_id: string
          p_variant_id: string
        }
        Returns: {
          id: string
          quantity: number
          was_existing: boolean
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
