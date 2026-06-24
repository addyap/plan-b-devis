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
      business_profile: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          ape_code: string | null
          bic: string | null
          brand_color: string | null
          city: string | null
          country: string | null
          created_at: string
          decennale_insurer: string | null
          default_footer_note: string | null
          default_payment_terms: string | null
          default_validity_days: number
          iban: string | null
          id: string
          insurance_geographic_cover: string | null
          late_penalty_terms: string | null
          legal_form: string | null
          legal_name: string | null
          logo_url: string | null
          postcode: string | null
          rc_pro_insurer: string | null
          rc_pro_policy: string | null
          rcs_or_rm: string | null
          sender_email: string | null
          siret: string | null
          trading_name: string | null
          updated_at: string
          vat_number: string | null
          vat_rate: number
          vat_status: Database["public"]["Enums"]["vat_status"]
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          ape_code?: string | null
          bic?: string | null
          brand_color?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          decennale_insurer?: string | null
          default_footer_note?: string | null
          default_payment_terms?: string | null
          default_validity_days?: number
          iban?: string | null
          id?: string
          insurance_geographic_cover?: string | null
          late_penalty_terms?: string | null
          legal_form?: string | null
          legal_name?: string | null
          logo_url?: string | null
          postcode?: string | null
          rc_pro_insurer?: string | null
          rc_pro_policy?: string | null
          rcs_or_rm?: string | null
          sender_email?: string | null
          siret?: string | null
          trading_name?: string | null
          updated_at?: string
          vat_number?: string | null
          vat_rate?: number
          vat_status?: Database["public"]["Enums"]["vat_status"]
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          ape_code?: string | null
          bic?: string | null
          brand_color?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          decennale_insurer?: string | null
          default_footer_note?: string | null
          default_payment_terms?: string | null
          default_validity_days?: number
          iban?: string | null
          id?: string
          insurance_geographic_cover?: string | null
          late_penalty_terms?: string | null
          legal_form?: string | null
          legal_name?: string | null
          logo_url?: string | null
          postcode?: string | null
          rc_pro_insurer?: string | null
          rc_pro_policy?: string | null
          rcs_or_rm?: string | null
          sender_email?: string | null
          siret?: string | null
          trading_name?: string | null
          updated_at?: string
          vat_number?: string | null
          vat_rate?: number
          vat_status?: Database["public"]["Enums"]["vat_status"]
        }
        Relationships: []
      }
      clients: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          client_type: string
          contact_name: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          postcode: string | null
          siret: string | null
          vat_number: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          client_type?: string
          contact_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          postcode?: string | null
          siret?: string | null
          vat_number?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          client_type?: string
          contact_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          postcode?: string | null
          siret?: string | null
          vat_number?: string | null
        }
        Relationships: []
      }
      devis: {
        Row: {
          client_id: string | null
          conditions_notes: string | null
          created_at: string
          deposit_amount: number | null
          deposit_type: string
          deposit_value: number
          devis_number: string
          global_discount_type: string
          global_discount_value: number
          id: string
          issue_date: string
          language: Database["public"]["Enums"]["devis_language"]
          last_email_error: string | null
          legal_mentions: string[]
          mission_phases: string[]
          notes: string | null
          operation_type: string | null
          payment_methods: string[]
          payment_schedule: Json
          payment_terms_preset: string | null
          project_description: string | null
          project_duration: string | null
          project_name: string | null
          project_start: string | null
          sent_at: string | null
          share_expires_at: string | null
          share_token: string
          signature_client_name: string | null
          signature_date: string | null
          site_address_line1: string | null
          site_address_line2: string | null
          site_city: string | null
          site_country: string | null
          site_postcode: string | null
          status: Database["public"]["Enums"]["devis_status"]
          subtotal_ht: number
          surface_m2: number | null
          total_ttc: number
          updated_at: string
          validity_until: string
          vat_amount: number
          works_budget_ht: number | null
        }
        Insert: {
          client_id?: string | null
          conditions_notes?: string | null
          created_at?: string
          deposit_amount?: number | null
          deposit_type?: string
          deposit_value?: number
          devis_number: string
          global_discount_type?: string
          global_discount_value?: number
          id?: string
          issue_date?: string
          language?: Database["public"]["Enums"]["devis_language"]
          last_email_error?: string | null
          legal_mentions?: string[]
          mission_phases?: string[]
          notes?: string | null
          operation_type?: string | null
          payment_methods?: string[]
          payment_schedule?: Json
          payment_terms_preset?: string | null
          project_description?: string | null
          project_duration?: string | null
          project_name?: string | null
          project_start?: string | null
          sent_at?: string | null
          share_expires_at?: string | null
          share_token?: string
          signature_client_name?: string | null
          signature_date?: string | null
          site_address_line1?: string | null
          site_address_line2?: string | null
          site_city?: string | null
          site_country?: string | null
          site_postcode?: string | null
          status?: Database["public"]["Enums"]["devis_status"]
          subtotal_ht?: number
          surface_m2?: number | null
          total_ttc?: number
          updated_at?: string
          validity_until: string
          vat_amount?: number
          works_budget_ht?: number | null
        }
        Update: {
          client_id?: string | null
          conditions_notes?: string | null
          created_at?: string
          deposit_amount?: number | null
          deposit_type?: string
          deposit_value?: number
          devis_number?: string
          global_discount_type?: string
          global_discount_value?: number
          id?: string
          issue_date?: string
          language?: Database["public"]["Enums"]["devis_language"]
          last_email_error?: string | null
          legal_mentions?: string[]
          mission_phases?: string[]
          notes?: string | null
          operation_type?: string | null
          payment_methods?: string[]
          payment_schedule?: Json
          payment_terms_preset?: string | null
          project_description?: string | null
          project_duration?: string | null
          project_name?: string | null
          project_start?: string | null
          sent_at?: string | null
          share_expires_at?: string | null
          share_token?: string
          signature_client_name?: string | null
          signature_date?: string | null
          site_address_line1?: string | null
          site_address_line2?: string | null
          site_city?: string | null
          site_country?: string | null
          site_postcode?: string | null
          status?: Database["public"]["Enums"]["devis_status"]
          subtotal_ht?: number
          surface_m2?: number | null
          total_ttc?: number
          updated_at?: string
          validity_until?: string
          vat_amount?: number
          works_budget_ht?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "devis_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      devis_lines: {
        Row: {
          description: string
          details: string | null
          devis_id: string
          discount_type: string
          discount_value: number
          id: string
          line_total_ht: number
          line_type: string
          mission_code: string | null
          percent_of_budget: number | null
          pricing_mode: string
          quantity: number
          sort_order: number
          unit: string | null
          unit_price_ht: number
          vat_rate: number
        }
        Insert: {
          description: string
          details?: string | null
          devis_id: string
          discount_type?: string
          discount_value?: number
          id?: string
          line_total_ht?: number
          line_type?: string
          mission_code?: string | null
          percent_of_budget?: number | null
          pricing_mode?: string
          quantity?: number
          sort_order?: number
          unit?: string | null
          unit_price_ht?: number
          vat_rate?: number
        }
        Update: {
          description?: string
          details?: string | null
          devis_id?: string
          discount_type?: string
          discount_value?: number
          id?: string
          line_total_ht?: number
          line_type?: string
          mission_code?: string | null
          percent_of_budget?: number | null
          pricing_mode?: string
          quantity?: number
          sort_order?: number
          unit?: string | null
          unit_price_ht?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "devis_lines_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
        ]
      }
      facture_lines: {
        Row: {
          description: string
          facture_id: string
          id: string
          line_total_ht: number
          quantity: number
          sort_order: number
          unit: string | null
          unit_price_ht: number
        }
        Insert: {
          description: string
          facture_id: string
          id?: string
          line_total_ht?: number
          quantity?: number
          sort_order?: number
          unit?: string | null
          unit_price_ht?: number
        }
        Update: {
          description?: string
          facture_id?: string
          id?: string
          line_total_ht?: number
          quantity?: number
          sort_order?: number
          unit?: string | null
          unit_price_ht?: number
        }
        Relationships: [
          {
            foreignKeyName: "facture_lines_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "factures"
            referencedColumns: ["id"]
          },
        ]
      }
      factures: {
        Row: {
          client_id: string | null
          created_at: string
          deposit_amount: number | null
          devis_id: string | null
          due_date: string
          facture_number: string
          id: string
          issue_date: string
          language: string
          last_email_error: string | null
          notes: string | null
          project_description: string | null
          project_duration: string | null
          project_start: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["facture_status"]
          subtotal_ht: number
          total_ttc: number
          updated_at: string
          vat_amount: number
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          deposit_amount?: number | null
          devis_id?: string | null
          due_date: string
          facture_number: string
          id?: string
          issue_date?: string
          language?: string
          last_email_error?: string | null
          notes?: string | null
          project_description?: string | null
          project_duration?: string | null
          project_start?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["facture_status"]
          subtotal_ht?: number
          total_ttc?: number
          updated_at?: string
          vat_amount?: number
        }
        Update: {
          client_id?: string | null
          created_at?: string
          deposit_amount?: number | null
          devis_id?: string | null
          due_date?: string
          facture_number?: string
          id?: string
          issue_date?: string
          language?: string
          last_email_error?: string | null
          notes?: string | null
          project_description?: string | null
          project_duration?: string | null
          project_start?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["facture_status"]
          subtotal_ht?: number
          total_ttc?: number
          updated_at?: string
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "factures_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
        ]
      }
      service_presets: {
        Row: {
          default_rate: number | null
          default_unit: string | null
          description: string | null
          id: string
          label_en: string
          label_fr: string
          sort_order: number | null
        }
        Insert: {
          default_rate?: number | null
          default_unit?: string | null
          description?: string | null
          id?: string
          label_en: string
          label_fr: string
          sort_order?: number | null
        }
        Update: {
          default_rate?: number | null
          default_unit?: string | null
          description?: string | null
          id?: string
          label_en?: string
          label_fr?: string
          sort_order?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_public_devis: { Args: { p_token: string }; Returns: Json }
      next_devis_number: { Args: never; Returns: string }
      next_facture_number: { Args: never; Returns: string }
      rotate_devis_share_token: { Args: { p_id: string }; Returns: string }
    }
    Enums: {
      devis_language: "en" | "fr"
      devis_status: "draft" | "sent" | "accepted" | "declined" | "expired"
      facture_status: "draft" | "sent" | "paid" | "overdue" | "cancelled"
      vat_status: "franchise_293b" | "tva_registered"
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
    Enums: {
      devis_language: ["en", "fr"],
      devis_status: ["draft", "sent", "accepted", "declined", "expired"],
      facture_status: ["draft", "sent", "paid", "overdue", "cancelled"],
      vat_status: ["franchise_293b", "tva_registered"],
    },
  },
} as const
