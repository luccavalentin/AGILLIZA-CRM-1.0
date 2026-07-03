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
      access_levels: {
        Row: {
          ativo: boolean
          correspondente_id: string | null
          created_at: string
          descricao: string | null
          id: string
          is_padrao: boolean
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          correspondente_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          is_padrao?: boolean
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          correspondente_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          is_padrao?: boolean
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_audit_logs: {
        Row: {
          acao: string
          correspondente_id: string | null
          created_at: string
          entidade: string | null
          entidade_id: string | null
          id: string
          ip: string | null
          payload_anterior: Json | null
          payload_novo: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          acao: string
          correspondente_id?: string | null
          created_at?: string
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          ip?: string | null
          payload_anterior?: Json | null
          payload_novo?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          acao?: string
          correspondente_id?: string | null
          created_at?: string
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          ip?: string | null
          payload_anterior?: Json | null
          payload_novo?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      permissions: {
        Row: {
          acao: string
          created_at: string
          escopo_dados: Database["public"]["Enums"]["escopo_dados"]
          id: string
          modulo: string
          nivel_acesso_id: string
          permitido: boolean
          updated_at: string
        }
        Insert: {
          acao: string
          created_at?: string
          escopo_dados?: Database["public"]["Enums"]["escopo_dados"]
          id?: string
          modulo: string
          nivel_acesso_id: string
          permitido?: boolean
          updated_at?: string
        }
        Update: {
          acao?: string
          created_at?: string
          escopo_dados?: Database["public"]["Enums"]["escopo_dados"]
          id?: string
          modulo?: string
          nivel_acesso_id?: string
          permitido?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "permissions_nivel_acesso_id_fkey"
            columns: ["nivel_acesso_id"]
            isOneToOne: false
            referencedRelation: "access_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          acesso_tipo: Database["public"]["Enums"]["acesso_tipo"]
          ativo: boolean
          bloqueado_em: string | null
          consentimento_lgpd_em: string | null
          correspondente_id: string | null
          created_at: string
          email: string | null
          foto_url: string | null
          id: string
          nivel_acesso_id: string | null
          nome: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          acesso_tipo?: Database["public"]["Enums"]["acesso_tipo"]
          ativo?: boolean
          bloqueado_em?: string | null
          consentimento_lgpd_em?: string | null
          correspondente_id?: string | null
          created_at?: string
          email?: string | null
          foto_url?: string | null
          id: string
          nivel_acesso_id?: string | null
          nome?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          acesso_tipo?: Database["public"]["Enums"]["acesso_tipo"]
          ativo?: boolean
          bloqueado_em?: string | null
          consentimento_lgpd_em?: string | null
          correspondente_id?: string | null
          created_at?: string
          email?: string | null
          foto_url?: string | null
          id?: string
          nivel_acesso_id?: string | null
          nome?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_nivel_acesso_id_fkey"
            columns: ["nivel_acesso_id"]
            isOneToOne: false
            referencedRelation: "access_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      correspondente_do_usuario: { Args: { _user_id: string }; Returns: string }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_correspondente: { Args: { _user_id: string }; Returns: boolean }
      is_interno: { Args: { _user_id: string }; Returns: boolean }
      mask_pii_jsonb: { Args: { _data: Json }; Returns: Json }
      pode_gerenciar_pessoas: { Args: { _user_id: string }; Returns: boolean }
      usuario_escopo_dados: {
        Args: { _modulo: string; _user_id: string }
        Returns: Database["public"]["Enums"]["escopo_dados"]
      }
      usuario_tem_permissao: {
        Args: { _acao: string; _modulo: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      acesso_tipo: "sistema" | "portal_parceiro"
      app_role:
        | "admin"
        | "correspondente"
        | "gestor"
        | "comercial"
        | "analista"
        | "imobiliaria"
        | "corretor"
        | "cliente"
      escopo_dados: "todos" | "equipe" | "proprios"
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
      acesso_tipo: ["sistema", "portal_parceiro"],
      app_role: [
        "admin",
        "correspondente",
        "gestor",
        "comercial",
        "analista",
        "imobiliaria",
        "corretor",
        "cliente",
      ],
      escopo_dados: ["todos", "equipe", "proprios"],
    },
  },
} as const
