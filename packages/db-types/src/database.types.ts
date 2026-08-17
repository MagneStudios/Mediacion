export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      acuerdos: {
        Row: {
          caso_id: string;
          contenido: Json;
          created_at: string;
          documento_url: string | null;
          docusign_envelope_id: string | null;
          estado: Database["public"]["Enums"]["estado_acuerdo"];
          fecha: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          caso_id: string;
          contenido: Json;
          created_at?: string;
          documento_url?: string | null;
          docusign_envelope_id?: string | null;
          estado?: Database["public"]["Enums"]["estado_acuerdo"];
          fecha?: string | null;
          id?: string;
          updated_at?: string;
        };
        Update: {
          caso_id?: string;
          contenido?: Json;
          created_at?: string;
          documento_url?: string | null;
          docusign_envelope_id?: string | null;
          estado?: Database["public"]["Enums"]["estado_acuerdo"];
          fecha?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "acuerdos_caso_id_fkey";
            columns: ["caso_id"];
            isOneToOne: true;
            referencedRelation: "casos";
            referencedColumns: ["id"];
          },
        ];
      };
      auditoria: {
        Row: {
          accion: string;
          created_at: string;
          detalle: Json | null;
          entidad: string;
          entidad_id: string | null;
          id: string;
          usuario_id: string | null;
        };
        Insert: {
          accion: string;
          created_at?: string;
          detalle?: Json | null;
          entidad: string;
          entidad_id?: string | null;
          id?: string;
          usuario_id?: string | null;
        };
        Update: {
          accion?: string;
          created_at?: string;
          detalle?: Json | null;
          entidad?: string;
          entidad_id?: string | null;
          id?: string;
          usuario_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "auditoria_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
      avisos_version_legal: {
        Row: {
          created_at: string;
          enviado_at: string | null;
          id: string;
          notificado_at: string;
          tipo: string;
          usuario_id: string;
          version: string;
        };
        Insert: {
          created_at?: string;
          enviado_at?: string | null;
          id?: string;
          notificado_at?: string;
          tipo: string;
          usuario_id: string;
          version: string;
        };
        Update: {
          created_at?: string;
          enviado_at?: string | null;
          id?: string;
          notificado_at?: string;
          tipo?: string;
          usuario_id?: string;
          version?: string;
        };
        Relationships: [];
      };
      carpetas: {
        Row: {
          created_at: string;
          estudio_id: string;
          id: string;
          nombre: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          estudio_id: string;
          id?: string;
          nombre: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          estudio_id?: string;
          id?: string;
          nombre?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "carpetas_estudio_id_fkey";
            columns: ["estudio_id"];
            isOneToOne: false;
            referencedRelation: "estudios";
            referencedColumns: ["id"];
          },
        ];
      };
      caso_partes: {
        Row: {
          caso_id: string;
          created_at: string;
          estado_invitacion: Database["public"]["Enums"]["estado_invitacion"];
          fecha_union: string | null;
          id: string;
          rol_en_caso: Database["public"]["Enums"]["rol_en_caso"];
          updated_at: string;
          usuario_id: string;
        };
        Insert: {
          caso_id: string;
          created_at?: string;
          estado_invitacion?: Database["public"]["Enums"]["estado_invitacion"];
          fecha_union?: string | null;
          id?: string;
          rol_en_caso: Database["public"]["Enums"]["rol_en_caso"];
          updated_at?: string;
          usuario_id: string;
        };
        Update: {
          caso_id?: string;
          created_at?: string;
          estado_invitacion?: Database["public"]["Enums"]["estado_invitacion"];
          fecha_union?: string | null;
          id?: string;
          rol_en_caso?: Database["public"]["Enums"]["rol_en_caso"];
          updated_at?: string;
          usuario_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "caso_partes_caso_id_fkey";
            columns: ["caso_id"];
            isOneToOne: false;
            referencedRelation: "casos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "caso_partes_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
      casos: {
        Row: {
          carpeta_id: string | null;
          creador_id: string;
          codigo: string | null;
          created_at: string;
          descripcion: string | null;
          estado: Database["public"]["Enums"]["estado_caso"];
          estudio_id: string | null;
          id: string;
          metodo: Database["public"]["Enums"]["metodo_caso"];
          nombre: string;
          plazo: string | null;
          ronda_actual: number;
          sla_tipo: string | null;
          updated_at: string;
        };
        Insert: {
          carpeta_id?: string | null;
          creador_id: string;
          codigo?: string | null;
          created_at?: string;
          descripcion?: string | null;
          estado?: Database["public"]["Enums"]["estado_caso"];
          estudio_id?: string | null;
          id?: string;
          metodo: Database["public"]["Enums"]["metodo_caso"];
          nombre: string;
          plazo?: string | null;
          ronda_actual?: number;
          sla_tipo?: string | null;
          updated_at?: string;
        };
        Update: {
          carpeta_id?: string | null;
          creador_id?: string;
          codigo?: string | null;
          created_at?: string;
          descripcion?: string | null;
          estado?: Database["public"]["Enums"]["estado_caso"];
          estudio_id?: string | null;
          id?: string;
          metodo?: Database["public"]["Enums"]["metodo_caso"];
          nombre?: string;
          plazo?: string | null;
          ronda_actual?: number;
          sla_tipo?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "casos_carpeta_id_fkey";
            columns: ["carpeta_id"];
            isOneToOne: false;
            referencedRelation: "carpetas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "casos_creador_id_fkey";
            columns: ["creador_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "casos_estudio_id_fkey";
            columns: ["estudio_id"];
            isOneToOne: false;
            referencedRelation: "estudios";
            referencedColumns: ["id"];
          },
        ];
      };
      configuracion: {
        Row: {
          clave: string;
          created_at: string;
          descripcion: string | null;
          id: string;
          updated_at: string;
          valor: Json;
        };
        Insert: {
          clave: string;
          created_at?: string;
          descripcion?: string | null;
          id?: string;
          updated_at?: string;
          valor: Json;
        };
        Update: {
          clave?: string;
          created_at?: string;
          descripcion?: string | null;
          id?: string;
          updated_at?: string;
          valor?: Json;
        };
        Relationships: [];
      };
      estudios: {
        Row: {
          activo: boolean;
          created_at: string;
          id: string;
          marca_config: Json | null;
          nombre: string;
          plan_id: string | null;
          updated_at: string;
        };
        Insert: {
          activo?: boolean;
          created_at?: string;
          id?: string;
          marca_config?: Json | null;
          nombre: string;
          plan_id?: string | null;
          updated_at?: string;
        };
        Update: {
          activo?: boolean;
          created_at?: string;
          id?: string;
          marca_config?: Json | null;
          nombre?: string;
          plan_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "estudios_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "planes";
            referencedColumns: ["id"];
          },
        ];
      };
      envios_email: {
        Row: {
          created_at: string;
          id: string;
          intentos: number;
          notificacion_id: string;
          ultimo_error: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          intentos?: number;
          notificacion_id: string;
          ultimo_error?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          intentos?: number;
          notificacion_id?: string;
          ultimo_error?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "envios_email_notificacion_id_fkey";
            columns: ["notificacion_id"];
            isOneToOne: false;
            referencedRelation: "notificaciones";
            referencedColumns: ["id"];
          },
        ];
      };
      facturas: {
        Row: {
          cae: string | null;
          created_at: string;
          estado: string;
          id: string;
          impuestos: string | null;
          iva: string | null;
          neto: string | null;
          numero: string | null;
          pago_id: string;
          total: string;
          url_pdf: string | null;
        };
        Insert: {
          cae?: string | null;
          created_at?: string;
          estado?: string;
          id?: string;
          impuestos?: string | null;
          iva?: string | null;
          neto?: string | null;
          numero?: string | null;
          pago_id: string;
          total: string;
          url_pdf?: string | null;
        };
        Update: {
          cae?: string | null;
          created_at?: string;
          estado?: string;
          id?: string;
          impuestos?: string | null;
          iva?: string | null;
          neto?: string | null;
          numero?: string | null;
          pago_id?: string;
          total?: string;
          url_pdf?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "facturas_pago_id_fkey";
            columns: ["pago_id"];
            isOneToOne: false;
            referencedRelation: "pagos";
            referencedColumns: ["id"];
          },
        ];
      };
      firmas: {
        Row: {
          acuerdo_id: string;
          created_at: string;
          docusign_status: string;
          fecha_firma: string | null;
          id: string;
          usuario_id: string;
        };
        Insert: {
          acuerdo_id: string;
          created_at?: string;
          docusign_status?: string;
          fecha_firma?: string | null;
          id?: string;
          usuario_id: string;
        };
        Update: {
          acuerdo_id?: string;
          created_at?: string;
          docusign_status?: string;
          fecha_firma?: string | null;
          id?: string;
          usuario_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "firmas_acuerdo_id_fkey";
            columns: ["acuerdo_id"];
            isOneToOne: false;
            referencedRelation: "acuerdos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "firmas_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
      incumplimientos: {
        Row: {
          acuerdo_id: string;
          created_at: string;
          descripcion: string;
          fecha: string;
          id: string;
          reportante_id: string;
        };
        Insert: {
          acuerdo_id: string;
          created_at?: string;
          descripcion: string;
          fecha?: string;
          id?: string;
          reportante_id: string;
        };
        Update: {
          acuerdo_id?: string;
          created_at?: string;
          descripcion?: string;
          fecha?: string;
          id?: string;
          reportante_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "incumplimientos_acuerdo_id_fkey";
            columns: ["acuerdo_id"];
            isOneToOne: false;
            referencedRelation: "acuerdos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "incumplimientos_reportante_id_fkey";
            columns: ["reportante_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
      inversores: {
        Row: {
          capital_disponible: string | null;
          created_at: string;
          email: string;
          experiencia: string | null;
          fecha: string;
          id: string;
          nombre: string;
        };
        Insert: {
          capital_disponible?: string | null;
          created_at?: string;
          email: string;
          experiencia?: string | null;
          fecha?: string;
          id?: string;
          nombre: string;
        };
        Update: {
          capital_disponible?: string | null;
          created_at?: string;
          email?: string;
          experiencia?: string | null;
          fecha?: string;
          id?: string;
          nombre?: string;
        };
        Relationships: [];
      };
      invitaciones: {
        Row: {
          caso_id: string;
          created_at: string;
          email_destino: string | null;
          estado: Database["public"]["Enums"]["estado_invitacion"];
          fecha_envio: string | null;
          id: string;
          pago_a_cargo: string | null;
          tipo: Database["public"]["Enums"]["tipo_invitacion"];
          token: string | null;
          updated_at: string;
        };
        Insert: {
          caso_id: string;
          created_at?: string;
          email_destino?: string | null;
          estado?: Database["public"]["Enums"]["estado_invitacion"];
          fecha_envio?: string | null;
          id?: string;
          pago_a_cargo?: string | null;
          tipo: Database["public"]["Enums"]["tipo_invitacion"];
          token?: string | null;
          updated_at?: string;
        };
        Update: {
          caso_id?: string;
          created_at?: string;
          email_destino?: string | null;
          estado?: Database["public"]["Enums"]["estado_invitacion"];
          fecha_envio?: string | null;
          id?: string;
          pago_a_cargo?: string | null;
          tipo?: Database["public"]["Enums"]["tipo_invitacion"];
          token?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invitaciones_caso_id_fkey";
            columns: ["caso_id"];
            isOneToOne: false;
            referencedRelation: "casos";
            referencedColumns: ["id"];
          },
        ];
      };
      items: {
        Row: {
          caso_id: string;
          categoria: Database["public"]["Enums"]["categoria_item"];
          condiciones_cesion: string | null;
          created_at: string;
          descripcion: string | null;
          id: string;
          nombre: string;
          parte_id: string;
          privado: boolean;
          puede_ceder: boolean;
          updated_at: string;
          valor_max: string | null;
          valor_min: string | null;
        };
        Insert: {
          caso_id: string;
          categoria: Database["public"]["Enums"]["categoria_item"];
          condiciones_cesion?: string | null;
          created_at?: string;
          descripcion?: string | null;
          id?: string;
          nombre: string;
          parte_id: string;
          privado?: boolean;
          puede_ceder?: boolean;
          updated_at?: string;
          valor_max?: string | null;
          valor_min?: string | null;
        };
        Update: {
          caso_id?: string;
          categoria?: Database["public"]["Enums"]["categoria_item"];
          condiciones_cesion?: string | null;
          created_at?: string;
          descripcion?: string | null;
          id?: string;
          nombre?: string;
          parte_id?: string;
          privado?: boolean;
          puede_ceder?: boolean;
          updated_at?: string;
          valor_max?: string | null;
          valor_min?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "items_caso_id_fkey";
            columns: ["caso_id"];
            isOneToOne: false;
            referencedRelation: "casos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "items_parte_id_fkey";
            columns: ["parte_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
      legal_documents: {
        Row: {
          contenido: string;
          created_at: string;
          id: string;
          is_substantial: boolean;
          resumen_cambios: string | null;
          tipo: string;
          updated_at: string;
          valid_from: string;
          valid_to: string | null;
          version: string;
        };
        Insert: {
          contenido: string;
          created_at?: string;
          id?: string;
          is_substantial?: boolean;
          resumen_cambios?: string | null;
          tipo: string;
          updated_at?: string;
          valid_from?: string;
          valid_to?: string | null;
          version: string;
        };
        Update: {
          contenido?: string;
          created_at?: string;
          id?: string;
          is_substantial?: boolean;
          resumen_cambios?: string | null;
          tipo?: string;
          updated_at?: string;
          valid_from?: string;
          valid_to?: string | null;
          version?: string;
        };
        Relationships: [];
      };
      mediaciones: {
        Row: {
          caso_id: string;
          created_at: string;
          estado: Database["public"]["Enums"]["estado_mediacion"];
          fecha_aceptacion: string | null;
          fecha_solicitud: string;
          id: string;
          mediador_id: string;
          ronda: number;
          updated_at: string;
        };
        Insert: {
          caso_id: string;
          created_at?: string;
          estado?: Database["public"]["Enums"]["estado_mediacion"];
          fecha_aceptacion?: string | null;
          fecha_solicitud?: string;
          id?: string;
          mediador_id: string;
          ronda: number;
          updated_at?: string;
        };
        Update: {
          caso_id?: string;
          created_at?: string;
          estado?: Database["public"]["Enums"]["estado_mediacion"];
          fecha_aceptacion?: string | null;
          fecha_solicitud?: string;
          id?: string;
          mediador_id?: string;
          ronda?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mediaciones_caso_id_fkey";
            columns: ["caso_id"];
            isOneToOne: false;
            referencedRelation: "casos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mediaciones_mediador_id_fkey";
            columns: ["mediador_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
      notificaciones: {
        Row: {
          canal: Database["public"]["Enums"]["canal_notificacion"];
          caso_id: string | null;
          created_at: string;
          estado: Database["public"]["Enums"]["estado_notificacion"];
          evento: string;
          fecha: string | null;
          id: string;
          leido_at: string | null;
          usuario_id: string;
        };
        Insert: {
          canal: Database["public"]["Enums"]["canal_notificacion"];
          caso_id?: string | null;
          created_at?: string;
          estado?: Database["public"]["Enums"]["estado_notificacion"];
          evento: string;
          fecha?: string | null;
          id?: string;
          leido_at?: string | null;
          usuario_id: string;
        };
        Update: {
          canal?: Database["public"]["Enums"]["canal_notificacion"];
          caso_id?: string | null;
          created_at?: string;
          estado?: Database["public"]["Enums"]["estado_notificacion"];
          evento?: string;
          fecha?: string | null;
          id?: string;
          leido_at?: string | null;
          usuario_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notificaciones_caso_id_fkey";
            columns: ["caso_id"];
            isOneToOne: false;
            referencedRelation: "casos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notificaciones_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
      pagos: {
        Row: {
          created_at: string;
          estado: Database["public"]["Enums"]["estado_pago"];
          fecha: string | null;
          id: string;
          metodo: string | null;
          monto: number;
          mp_payment_id: string | null;
          raw_webhook: Json | null;
          suscripcion_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          estado?: Database["public"]["Enums"]["estado_pago"];
          fecha?: string | null;
          id?: string;
          metodo?: string | null;
          monto: number;
          mp_payment_id?: string | null;
          raw_webhook?: Json | null;
          suscripcion_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          estado?: Database["public"]["Enums"]["estado_pago"];
          fecha?: string | null;
          id?: string;
          metodo?: string | null;
          monto?: number;
          mp_payment_id?: string | null;
          raw_webhook?: Json | null;
          suscripcion_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pagos_suscripcion_id_fkey";
            columns: ["suscripcion_id"];
            isOneToOne: false;
            referencedRelation: "suscripciones";
            referencedColumns: ["id"];
          },
        ];
      };
      planes: {
        Row: {
          created_at: string;
          id: string;
          limite_carpetas: number;
          limite_casos: number | null;
          limite_iteraciones_ia: number;
          nombre: string;
          precio: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          limite_carpetas: number;
          limite_casos?: number | null;
          limite_iteraciones_ia: number;
          nombre: string;
          precio: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          limite_carpetas?: number;
          limite_casos?: number | null;
          limite_iteraciones_ia?: number;
          nombre?: string;
          precio?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      propuestas: {
        Row: {
          caso_id: string;
          contenido: Json;
          created_at: string;
          estado: Database["public"]["Enums"]["estado_propuesta"];
          fecha: string;
          fundamentacion: string | null;
          id: string;
          modelo_ia: string | null;
          ronda_id: string;
          updated_at: string;
        };
        Insert: {
          caso_id: string;
          contenido: Json;
          created_at?: string;
          estado?: Database["public"]["Enums"]["estado_propuesta"];
          fecha?: string;
          fundamentacion?: string | null;
          id?: string;
          modelo_ia?: string | null;
          ronda_id: string;
          updated_at?: string;
        };
        Update: {
          caso_id?: string;
          contenido?: Json;
          created_at?: string;
          estado?: Database["public"]["Enums"]["estado_propuesta"];
          fecha?: string;
          fundamentacion?: string | null;
          id?: string;
          modelo_ia?: string | null;
          ronda_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "propuestas_caso_id_fkey";
            columns: ["caso_id"];
            isOneToOne: false;
            referencedRelation: "casos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "propuestas_ronda_id_fkey";
            columns: ["ronda_id"];
            isOneToOne: false;
            referencedRelation: "rondas";
            referencedColumns: ["id"];
          },
        ];
      };
      respuestas_propuesta: {
        Row: {
          created_at: string;
          decision: Database["public"]["Enums"]["decision_propuesta"];
          fecha: string;
          id: string;
          parte_id: string;
          propuesta_id: string;
        };
        Insert: {
          created_at?: string;
          decision: Database["public"]["Enums"]["decision_propuesta"];
          fecha?: string;
          id?: string;
          parte_id: string;
          propuesta_id: string;
        };
        Update: {
          created_at?: string;
          decision?: Database["public"]["Enums"]["decision_propuesta"];
          fecha?: string;
          id?: string;
          parte_id?: string;
          propuesta_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "respuestas_propuesta_parte_id_fkey";
            columns: ["parte_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "respuestas_propuesta_propuesta_id_fkey";
            columns: ["propuesta_id"];
            isOneToOne: false;
            referencedRelation: "propuestas";
            referencedColumns: ["id"];
          },
        ];
      };
      rate_limit_counters: {
        Row: {
          clave: string;
          hits: number;
          ventana_inicio: string;
        };
        Insert: {
          clave: string;
          hits?: number;
          ventana_inicio: string;
        };
        Update: {
          clave?: string;
          hits?: number;
          ventana_inicio?: string;
        };
        Relationships: [];
      };
      rondas: {
        Row: {
          caso_id: string;
          created_at: string;
          estado: Database["public"]["Enums"]["estado_ronda"];
          fecha_fin: string | null;
          fecha_inicio: string;
          id: string;
          numero: number;
          updated_at: string;
        };
        Insert: {
          caso_id: string;
          created_at?: string;
          estado?: Database["public"]["Enums"]["estado_ronda"];
          fecha_fin?: string | null;
          fecha_inicio?: string;
          id?: string;
          numero: number;
          updated_at?: string;
        };
        Update: {
          caso_id?: string;
          created_at?: string;
          estado?: Database["public"]["Enums"]["estado_ronda"];
          fecha_fin?: string | null;
          fecha_inicio?: string;
          id?: string;
          numero?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rondas_caso_id_fkey";
            columns: ["caso_id"];
            isOneToOne: false;
            referencedRelation: "casos";
            referencedColumns: ["id"];
          },
        ];
      };
      solicitudes_arrepentimiento: {
        Row: {
          codigo: string | null;
          created_at: string;
          detalle: string;
          email: string;
          estado: Database["public"]["Enums"]["estado_arrepentimiento"];
          id: string;
          nombre: string;
          received_at: string;
          updated_at: string;
          usuario_id: string | null;
        };
        Insert: {
          codigo?: string | null;
          created_at?: string;
          detalle: string;
          email: string;
          estado?: Database["public"]["Enums"]["estado_arrepentimiento"];
          id?: string;
          nombre: string;
          received_at?: string;
          updated_at?: string;
          usuario_id?: string | null;
        };
        Update: {
          codigo?: string | null;
          created_at?: string;
          detalle?: string;
          email?: string;
          estado?: Database["public"]["Enums"]["estado_arrepentimiento"];
          id?: string;
          nombre?: string;
          received_at?: string;
          updated_at?: string;
          usuario_id?: string | null;
        };
        Relationships: [];
      };
      solicitudes_contacto: {
        Row: {
          codigo: string | null;
          created_at: string;
          email: string;
          estado: Database["public"]["Enums"]["estado_arrepentimiento"];
          id: string;
          mensaje: string;
          nombre: string;
          received_at: string;
          updated_at: string;
          usuario_id: string | null;
        };
        Insert: {
          codigo?: string | null;
          created_at?: string;
          email: string;
          estado?: Database["public"]["Enums"]["estado_arrepentimiento"];
          id?: string;
          mensaje: string;
          nombre: string;
          received_at?: string;
          updated_at?: string;
          usuario_id?: string | null;
        };
        Update: {
          codigo?: string | null;
          created_at?: string;
          email?: string;
          estado?: Database["public"]["Enums"]["estado_arrepentimiento"];
          id?: string;
          mensaje?: string;
          nombre?: string;
          received_at?: string;
          updated_at?: string;
          usuario_id?: string | null;
        };
        Relationships: [];
      };
      suscripciones: {
        Row: {
          created_at: string;
          estado: Database["public"]["Enums"]["estado_suscripcion"];
          estudio_id: string | null;
          fecha_fin: string | null;
          fecha_inicio: string | null;
          id: string;
          plan_id: string;
          updated_at: string;
          usuario_id: string | null;
        };
        Insert: {
          created_at?: string;
          estado?: Database["public"]["Enums"]["estado_suscripcion"];
          estudio_id?: string | null;
          fecha_fin?: string | null;
          fecha_inicio?: string | null;
          id?: string;
          plan_id: string;
          updated_at?: string;
          usuario_id?: string | null;
        };
        Update: {
          created_at?: string;
          estado?: Database["public"]["Enums"]["estado_suscripcion"];
          estudio_id?: string | null;
          fecha_fin?: string | null;
          fecha_inicio?: string | null;
          id?: string;
          plan_id?: string;
          updated_at?: string;
          usuario_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "suscripciones_estudio_id_fkey";
            columns: ["estudio_id"];
            isOneToOne: false;
            referencedRelation: "estudios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "suscripciones_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "planes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "suscripciones_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
      tareas: {
        Row: {
          acuerdo_id: string;
          caso_id: string;
          created_at: string;
          descripcion: string;
          estado: Database["public"]["Enums"]["estado_tarea"];
          fecha_evento: string | null;
          id: string;
          tipo: Database["public"]["Enums"]["tipo_tarea"];
          updated_at: string;
        };
        Insert: {
          acuerdo_id: string;
          caso_id: string;
          created_at?: string;
          descripcion: string;
          estado?: Database["public"]["Enums"]["estado_tarea"];
          fecha_evento?: string | null;
          id?: string;
          tipo: Database["public"]["Enums"]["tipo_tarea"];
          updated_at?: string;
        };
        Update: {
          acuerdo_id?: string;
          caso_id?: string;
          created_at?: string;
          descripcion?: string;
          estado?: Database["public"]["Enums"]["estado_tarea"];
          fecha_evento?: string | null;
          id?: string;
          tipo?: Database["public"]["Enums"]["tipo_tarea"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tareas_acuerdo_id_fkey";
            columns: ["acuerdo_id"];
            isOneToOne: false;
            referencedRelation: "acuerdos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tareas_caso_id_fkey";
            columns: ["caso_id"];
            isOneToOne: false;
            referencedRelation: "casos";
            referencedColumns: ["id"];
          },
        ];
      };
      user_agreements: {
        Row: {
          accepted: boolean;
          accepted_at: string;
          created_at: string;
          document_type: string;
          document_version: string;
          id: string;
          ip: string;
          user_agent: string;
          user_id: string;
        };
        Insert: {
          accepted: boolean;
          accepted_at?: string;
          created_at?: string;
          document_type: string;
          document_version: string;
          id?: string;
          ip: string;
          user_agent: string;
          user_id: string;
        };
        Update: {
          accepted?: boolean;
          accepted_at?: string;
          created_at?: string;
          document_type?: string;
          document_version?: string;
          id?: string;
          ip?: string;
          user_agent?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      usuarios: {
        Row: {
          activo: boolean;
          apellido: string;
          consentimiento_envelope_id: string | null;
          consentimiento_fecha: string | null;
          created_at: string;
          depuracion_programada_at: string | null;
          documento: string | null;
          desactivacion_solicitada_at: string | null;
          email: string;
          estudio_id: string | null;
          fecha_baja: string | null;
          id: string;
          idioma: string | null;
          nombre: string;
          rol: Database["public"]["Enums"]["rol_usuario"];
          numero_matricula: string | null;
          matricula_url: string | null;
          preferencias_notificacion: Json;
          telefono: string | null;
          updated_at: string;
          verif_biometrica:
            | Database["public"]["Enums"]["verif_biometrica"]
            | null;
        };
        Insert: {
          activo?: boolean;
          apellido: string;
          consentimiento_envelope_id?: string | null;
          consentimiento_fecha?: string | null;
          created_at?: string;
          depuracion_programada_at?: string | null;
          documento?: string | null;
          desactivacion_solicitada_at?: string | null;
          email: string;
          estudio_id?: string | null;
          fecha_baja?: string | null;
          id: string;
          idioma?: string | null;
          nombre: string;
          rol: Database["public"]["Enums"]["rol_usuario"];
          numero_matricula?: string | null;
          matricula_url?: string | null;
          preferencias_notificacion?: Json;
          telefono?: string | null;
          updated_at?: string;
          verif_biometrica?:
            | Database["public"]["Enums"]["verif_biometrica"]
            | null;
        };
        Update: {
          activo?: boolean;
          apellido?: string;
          consentimiento_envelope_id?: string | null;
          consentimiento_fecha?: string | null;
          created_at?: string;
          depuracion_programada_at?: string | null;
          documento?: string | null;
          desactivacion_solicitada_at?: string | null;
          email?: string;
          estudio_id?: string | null;
          fecha_baja?: string | null;
          id?: string;
          idioma?: string | null;
          nombre?: string;
          rol?: Database["public"]["Enums"]["rol_usuario"];
          numero_matricula?: string | null;
          matricula_url?: string | null;
          preferencias_notificacion?: Json;
          telefono?: string | null;
          updated_at?: string;
          verif_biometrica?:
            | Database["public"]["Enums"]["verif_biometrica"]
            | null;
        };
        Relationships: [
          {
            foreignKeyName: "usuarios_estudio_id_fkey";
            columns: ["estudio_id"];
            isOneToOne: false;
            referencedRelation: "estudios";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_accepted_current: {
        Args: { p_user_id: string; p_document_type: string };
        Returns: boolean;
      };
      is_admin: { Args: never; Returns: boolean };
      is_estudio: { Args: never; Returns: boolean };
      is_mediator_of_case: { Args: { case_uuid: string }; Returns: boolean };
      is_own_subscription: { Args: { sub_uuid: string }; Returns: boolean };
      is_owner_estudio_of_case: {
        Args: { case_uuid: string };
        Returns: boolean;
      };
      is_part_of_case: { Args: { case_uuid: string }; Returns: boolean };
    };
    Enums: {
      canal_notificacion: "email" | "push";
      categoria_item:
        | "cuidado_ninos"
        | "cronogramas"
        | "bienes"
        | "economico"
        | "personalizado";
      decision_propuesta: "acepta" | "rechaza";
      estado_acuerdo: "borrador" | "enviado_a_firma" | "firmado" | "con_aviso";
      estado_arrepentimiento:
        | "recibida"
        | "en_proceso"
        | "resuelta"
        | "rechazada";
      estado_caso:
        | "nuevo"
        | "activo"
        | "en_negociacion"
        | "acordado"
        | "cerrado"
        | "terminado"
        | "vencido";
      estado_invitacion: "pendiente" | "aceptada" | "rechazada" | "expirada";
      estado_mediacion:
        | "solicitada"
        | "aceptada"
        | "rechazada"
        | "activa"
        | "finalizada";
      estado_notificacion: "pendiente" | "enviada" | "fallida";
      estado_pago: "pendiente" | "aprobado" | "rechazado";
      estado_propuesta: "pendiente" | "aceptada" | "rechazada";
      estado_ronda: "activa" | "completada";
      estado_suscripcion: "activa" | "cancelada" | "vencida" | "pendiente_pago";
      estado_tarea: "pendiente" | "en_progreso" | "completada";
      metodo_caso: "negociacion" | "conciliacion" | "mediacion";
      rol_en_caso: "parte_a" | "parte_b" | "mediador";
      rol_usuario: "admin" | "parte" | "mediador" | "estudio";
      tipo_invitacion: "link" | "codigo" | "email";
      tipo_tarea: "tarea" | "evento_calendario";
      verif_biometrica: "pendiente" | "aprobada" | "rechazada";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      canal_notificacion: ["email", "push"],
      categoria_item: [
        "cuidado_ninos",
        "cronogramas",
        "bienes",
        "economico",
        "personalizado",
      ],
      decision_propuesta: ["acepta", "rechaza"],
      estado_acuerdo: ["borrador", "enviado_a_firma", "firmado", "con_aviso"],
      estado_arrepentimiento: [
        "recibida",
        "en_proceso",
        "resuelta",
        "rechazada",
      ],
      estado_caso: [
        "nuevo",
        "activo",
        "en_negociacion",
        "acordado",
        "cerrado",
        "terminado",
        "vencido",
        "expirado",
      ],
      estado_invitacion: ["pendiente", "aceptada", "rechazada", "expirada"],
      estado_mediacion: [
        "solicitada",
        "aceptada",
        "rechazada",
        "activa",
        "finalizada",
      ],
      estado_notificacion: ["pendiente", "enviada", "fallida"],
      estado_pago: ["pendiente", "aprobado", "rechazado"],
      estado_propuesta: ["pendiente", "aceptada", "rechazada"],
      estado_ronda: ["activa", "completada"],
      estado_suscripcion: ["activa", "cancelada", "vencida", "pendiente_pago"],
      estado_tarea: ["pendiente", "en_progreso", "completada"],
      metodo_caso: ["negociacion", "conciliacion", "mediacion"],
      rol_en_caso: ["parte_a", "parte_b", "mediador"],
      rol_usuario: ["admin", "parte", "mediador", "estudio"],
      tipo_invitacion: ["link", "codigo", "email"],
      tipo_tarea: ["tarea", "evento_calendario"],
      verif_biometrica: ["pendiente", "aprobada", "rechazada"],
    },
  },
} as const;
