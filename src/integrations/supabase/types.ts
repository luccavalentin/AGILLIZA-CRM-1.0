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
      cliente_documentos: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          categoria: Database["public"]["Enums"]["doc_categoria"]
          cliente_id: string
          created_at: string
          enviado_por: string | null
          expira_em: string | null
          id: string
          mime_type: string | null
          nome_arquivo: string
          status: Database["public"]["Enums"]["doc_status"]
          storage_path: string
          tamanho_bytes: number | null
          tipo_documento: string
          updated_at: string
          versao: number
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          categoria?: Database["public"]["Enums"]["doc_categoria"]
          cliente_id: string
          created_at?: string
          enviado_por?: string | null
          expira_em?: string | null
          id?: string
          mime_type?: string | null
          nome_arquivo: string
          status?: Database["public"]["Enums"]["doc_status"]
          storage_path: string
          tamanho_bytes?: number | null
          tipo_documento: string
          updated_at?: string
          versao?: number
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          categoria?: Database["public"]["Enums"]["doc_categoria"]
          cliente_id?: string
          created_at?: string
          enviado_por?: string | null
          expira_em?: string | null
          id?: string
          mime_type?: string | null
          nome_arquivo?: string
          status?: Database["public"]["Enums"]["doc_status"]
          storage_path?: string
          tamanho_bytes?: number | null
          tipo_documento?: string
          updated_at?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "cliente_documentos_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_documentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_documentos_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_enderecos: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          cliente_id: string
          complemento: string | null
          created_at: string
          id: string
          logradouro: string | null
          numero: string | null
          principal: boolean
          uf: string | null
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cliente_id: string
          complemento?: string | null
          created_at?: string
          id?: string
          logradouro?: string | null
          numero?: string | null
          principal?: boolean
          uf?: string | null
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cliente_id?: string
          complemento?: string | null
          created_at?: string
          id?: string
          logradouro?: string | null
          numero?: string | null
          principal?: boolean
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_enderecos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_historico: {
        Row: {
          ator_id: string | null
          cliente_id: string
          created_at: string
          descricao: string
          id: string
          metadata: Json | null
          tipo: string
        }
        Insert: {
          ator_id?: string | null
          cliente_id: string
          created_at?: string
          descricao: string
          id?: string
          metadata?: Json | null
          tipo: string
        }
        Update: {
          ator_id?: string | null
          cliente_id?: string
          created_at?: string
          descricao?: string
          id?: string
          metadata?: Json | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_historico_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_imoveis: {
        Row: {
          cidade: string | null
          cliente_id: string
          created_at: string
          id: string
          logradouro: string | null
          tipo: string | null
          uf: string | null
          updated_at: string
          uso: string | null
          valor: number | null
        }
        Insert: {
          cidade?: string | null
          cliente_id: string
          created_at?: string
          id?: string
          logradouro?: string | null
          tipo?: string | null
          uf?: string | null
          updated_at?: string
          uso?: string | null
          valor?: number | null
        }
        Update: {
          cidade?: string | null
          cliente_id?: string
          created_at?: string
          id?: string
          logradouro?: string | null
          tipo?: string | null
          uf?: string | null
          updated_at?: string
          uso?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_imoveis_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_interacoes: {
        Row: {
          canal: Database["public"]["Enums"]["interacao_canal"]
          cliente_id: string
          created_at: string
          id: string
          observacao: string | null
          ocorrido_em: string
          responsavel_id: string | null
          resultado: string | null
        }
        Insert: {
          canal: Database["public"]["Enums"]["interacao_canal"]
          cliente_id: string
          created_at?: string
          id?: string
          observacao?: string | null
          ocorrido_em?: string
          responsavel_id?: string | null
          resultado?: string | null
        }
        Update: {
          canal?: Database["public"]["Enums"]["interacao_canal"]
          cliente_id?: string
          created_at?: string
          id?: string
          observacao?: string | null
          ocorrido_em?: string
          responsavel_id?: string | null
          resultado?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_interacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_interacoes_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_pipeline: {
        Row: {
          cliente_id: string
          stage_id: string
          ultima_atualizacao_em: string
        }
        Insert: {
          cliente_id: string
          stage_id: string
          ultima_atualizacao_em?: string
        }
        Update: {
          cliente_id?: string
          stage_id?: string
          ultima_atualizacao_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_pipeline_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: true
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_pipeline_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_pipeline_historico: {
        Row: {
          acao: string | null
          ator_id: string | null
          cliente_id: string
          created_at: string
          enviar_ao_cliente: boolean
          id: string
          mensagem_cliente: string | null
          observacao: string | null
          stage_id: string
        }
        Insert: {
          acao?: string | null
          ator_id?: string | null
          cliente_id: string
          created_at?: string
          enviar_ao_cliente?: boolean
          id?: string
          mensagem_cliente?: string | null
          observacao?: string | null
          stage_id: string
        }
        Update: {
          acao?: string | null
          ator_id?: string | null
          cliente_id?: string
          created_at?: string
          enviar_ao_cliente?: boolean
          id?: string
          mensagem_cliente?: string | null
          observacao?: string | null
          stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_pipeline_historico_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_pipeline_historico_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_portal_acessos: {
        Row: {
          ativo: boolean
          cliente_id: string
          data_referencia: string | null
          documento_hash: string
          habilitado_em: string
          habilitado_por: string | null
          id: string
          revogado_em: string | null
          revogado_por: string | null
          tipo_pessoa: Database["public"]["Enums"]["tipo_pessoa"]
        }
        Insert: {
          ativo?: boolean
          cliente_id: string
          data_referencia?: string | null
          documento_hash: string
          habilitado_em?: string
          habilitado_por?: string | null
          id?: string
          revogado_em?: string | null
          revogado_por?: string | null
          tipo_pessoa: Database["public"]["Enums"]["tipo_pessoa"]
        }
        Update: {
          ativo?: boolean
          cliente_id?: string
          data_referencia?: string | null
          documento_hash?: string
          habilitado_em?: string
          habilitado_por?: string | null
          id?: string
          revogado_em?: string | null
          revogado_por?: string | null
          tipo_pessoa?: Database["public"]["Enums"]["tipo_pessoa"]
        }
        Relationships: [
          {
            foreignKeyName: "cliente_portal_acessos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: true
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          ativo: boolean
          correspondente_id: string
          created_at: string
          criador_id: string | null
          data_nascimento: string | null
          documento: string
          documento_secundario: string | null
          email: string | null
          estado_civil:
            | Database["public"]["Enums"]["cliente_estado_civil"]
            | null
          foto_url: string | null
          id: string
          mae: string | null
          nome: string
          numero_cliente: string
          origem: Database["public"]["Enums"]["cliente_origem"]
          portal_acesso_ativo: boolean
          regime_casamento:
            | Database["public"]["Enums"]["regime_casamento"]
            | null
          renda_total_declarada: number | null
          responsavel_id: string | null
          telefone_celular: string | null
          tipo_pessoa: Database["public"]["Enums"]["tipo_pessoa"]
          uf_interesse: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          correspondente_id: string
          created_at?: string
          criador_id?: string | null
          data_nascimento?: string | null
          documento: string
          documento_secundario?: string | null
          email?: string | null
          estado_civil?:
            | Database["public"]["Enums"]["cliente_estado_civil"]
            | null
          foto_url?: string | null
          id?: string
          mae?: string | null
          nome: string
          numero_cliente: string
          origem?: Database["public"]["Enums"]["cliente_origem"]
          portal_acesso_ativo?: boolean
          regime_casamento?:
            | Database["public"]["Enums"]["regime_casamento"]
            | null
          renda_total_declarada?: number | null
          responsavel_id?: string | null
          telefone_celular?: string | null
          tipo_pessoa?: Database["public"]["Enums"]["tipo_pessoa"]
          uf_interesse?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          correspondente_id?: string
          created_at?: string
          criador_id?: string | null
          data_nascimento?: string | null
          documento?: string
          documento_secundario?: string | null
          email?: string | null
          estado_civil?:
            | Database["public"]["Enums"]["cliente_estado_civil"]
            | null
          foto_url?: string | null
          id?: string
          mae?: string | null
          nome?: string
          numero_cliente?: string
          origem?: Database["public"]["Enums"]["cliente_origem"]
          portal_acesso_ativo?: boolean
          regime_casamento?:
            | Database["public"]["Enums"]["regime_casamento"]
            | null
          renda_total_declarada?: number | null
          responsavel_id?: string | null
          telefone_celular?: string | null
          tipo_pessoa?: Database["public"]["Enums"]["tipo_pessoa"]
          uf_interesse?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_criador_id_fkey"
            columns: ["criador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          corpo: string | null
          correspondente_id: string | null
          created_at: string
          id: string
          lida: boolean
          link: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          corpo?: string | null
          correspondente_id?: string | null
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          tipo?: string
          titulo: string
          user_id: string
        }
        Update: {
          corpo?: string | null
          correspondente_id?: string | null
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          tipo?: string
          titulo?: string
          user_id?: string
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
      pipeline_stages: {
        Row: {
          codigo: string
          created_at: string
          id: string
          mensagem_cliente: string
          nome: string
          ordem: number
        }
        Insert: {
          codigo: string
          created_at?: string
          id?: string
          mensagem_cliente: string
          nome: string
          ordem: number
        }
        Update: {
          codigo?: string
          created_at?: string
          id?: string
          mensagem_cliente?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
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
      cliente_pipeline_avancar_para: {
        Args: {
          _acao?: string
          _cliente_id: string
          _codigo_destino: string
          _obs?: string
        }
        Returns: undefined
      }
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
      usuario_tem_acesso_cliente: {
        Args: { _cliente_id: string; _user_id: string }
        Returns: boolean
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
      cliente_estado_civil:
        | "solteiro"
        | "casado"
        | "uniao_estavel"
        | "divorciado"
        | "viuvo"
      cliente_origem: "direto" | "parceiro" | "indicacao" | "importacao"
      doc_categoria: "comprador" | "conjuge" | "vendedor" | "imovel" | "outros"
      doc_status:
        | "pendente"
        | "recebido"
        | "aprovado"
        | "reprovado"
        | "expirado"
      escopo_dados: "todos" | "equipe" | "proprios"
      interacao_canal:
        | "ligacao"
        | "whatsapp"
        | "email"
        | "reuniao"
        | "presencial"
        | "followup"
        | "outro"
      regime_casamento:
        | "comunhao_parcial"
        | "comunhao_universal"
        | "separacao_total"
        | "participacao_final"
        | "nao_aplicavel"
      simulacao_banco_status: "aguardando" | "simulada" | "erro" | "expirada"
      simulacao_status:
        | "rascunho"
        | "enviando"
        | "simulada"
        | "parcialmente_simulada"
        | "erro_banco"
        | "expirada"
        | "cancelada"
        | "promovida"
      simulacao_tipo: "simplificada" | "completa"
      tipo_pessoa: "PF" | "PJ"
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
      cliente_estado_civil: [
        "solteiro",
        "casado",
        "uniao_estavel",
        "divorciado",
        "viuvo",
      ],
      cliente_origem: ["direto", "parceiro", "indicacao", "importacao"],
      doc_categoria: ["comprador", "conjuge", "vendedor", "imovel", "outros"],
      doc_status: ["pendente", "recebido", "aprovado", "reprovado", "expirado"],
      escopo_dados: ["todos", "equipe", "proprios"],
      interacao_canal: [
        "ligacao",
        "whatsapp",
        "email",
        "reuniao",
        "presencial",
        "followup",
        "outro",
      ],
      regime_casamento: [
        "comunhao_parcial",
        "comunhao_universal",
        "separacao_total",
        "participacao_final",
        "nao_aplicavel",
      ],
      simulacao_banco_status: ["aguardando", "simulada", "erro", "expirada"],
      simulacao_status: [
        "rascunho",
        "enviando",
        "simulada",
        "parcialmente_simulada",
        "erro_banco",
        "expirada",
        "cancelada",
        "promovida",
      ],
      simulacao_tipo: ["simplificada", "completa"],
      tipo_pessoa: ["PF", "PJ"],
    },
  },
} as const
