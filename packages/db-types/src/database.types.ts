export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      planes: {
        Row: {
          id: string;
          nombre: string;
          limite_carpetas: number;
          limite_casos: number;
          limite_iteraciones_ia: number;
          precio: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          limite_carpetas: number;
          limite_casos: number;
          limite_iteraciones_ia: number;
          precio: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          limite_carpetas?: number;
          limite_casos?: number;
          limite_iteraciones_ia?: number;
          precio?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      configuracion: {
        Row: {
          id: string;
          clave: string;
          valor: Json;
          descripcion: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          clave: string;
          valor: Json;
          descripcion?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          clave?: string;
          valor?: Json;
          descripcion?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      inversores: {
        Row: {
          id: string;
          nombre: string;
          email: string;
          capital_disponible: string | null;
          experiencia: string | null;
          fecha: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          email: string;
          capital_disponible?: string | null;
          experiencia?: string | null;
          fecha?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          email?: string;
          capital_disponible?: string | null;
          experiencia?: string | null;
          fecha?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      estudios: {
        Row: {
          id: string;
          nombre: string;
          plan_id: string | null;
          marca_config: Json | null;
          activo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          plan_id?: string | null;
          marca_config?: Json | null;
          activo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          plan_id?: string | null;
          marca_config?: Json | null;
          activo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      usuarios: {
        Row: {
          id: string;
          rol: Database["public"]["Enums"]["rol_usuario"];
          nombre: string;
          apellido: string;
          email: string;
          documento: string | null;
          telefono: string | null;
          idioma: string | null;
          verif_biometrica:
            | Database["public"]["Enums"]["verif_biometrica"]
            | null;
          estudio_id: string | null;
          activo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          rol: Database["public"]["Enums"]["rol_usuario"];
          nombre: string;
          apellido: string;
          email: string;
          documento?: string | null;
          telefono?: string | null;
          idioma?: string | null;
          verif_biometrica?:
            | Database["public"]["Enums"]["verif_biometrica"]
            | null;
          estudio_id?: string | null;
          activo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          rol?: Database["public"]["Enums"]["rol_usuario"];
          nombre?: string;
          apellido?: string;
          email?: string;
          documento?: string | null;
          telefono?: string | null;
          idioma?: string | null;
          verif_biometrica?:
            | Database["public"]["Enums"]["verif_biometrica"]
            | null;
          estudio_id?: string | null;
          activo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      carpetas: {
        Row: {
          id: string;
          estudio_id: string;
          nombre: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          estudio_id: string;
          nombre: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          estudio_id?: string;
          nombre?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      suscripciones: {
        Row: {
          id: string;
          usuario_id: string | null;
          estudio_id: string | null;
          plan_id: string;
          estado: Database["public"]["Enums"]["estado_suscripcion"];
          fecha_inicio: string | null;
          fecha_fin: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          usuario_id?: string | null;
          estudio_id?: string | null;
          plan_id: string;
          estado?: Database["public"]["Enums"]["estado_suscripcion"];
          fecha_inicio?: string | null;
          fecha_fin?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          usuario_id?: string | null;
          estudio_id?: string | null;
          plan_id?: string;
          estado?: Database["public"]["Enums"]["estado_suscripcion"];
          fecha_inicio?: string | null;
          fecha_fin?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pagos: {
        Row: {
          id: string;
          suscripcion_id: string;
          mp_payment_id: string | null;
          estado: Database["public"]["Enums"]["estado_pago"];
          monto: number;
          metodo: string | null;
          fecha: string | null;
          raw_webhook: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          suscripcion_id: string;
          mp_payment_id?: string | null;
          estado?: Database["public"]["Enums"]["estado_pago"];
          monto: number;
          metodo?: string | null;
          fecha?: string | null;
          raw_webhook?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          suscripcion_id?: string;
          mp_payment_id?: string | null;
          estado?: Database["public"]["Enums"]["estado_pago"];
          monto?: number;
          metodo?: string | null;
          fecha?: string | null;
          raw_webhook?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      casos: {
        Row: {
          id: string;
          creador_id: string;
          estudio_id: string | null;
          carpeta_id: string | null;
          nombre: string;
          descripcion: string | null;
          metodo: Database["public"]["Enums"]["metodo_caso"];
          estado: Database["public"]["Enums"]["estado_caso"];
          ronda_actual: number;
          sla_tipo: string | null;
          plazo: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          creador_id: string;
          estudio_id?: string | null;
          carpeta_id?: string | null;
          nombre: string;
          descripcion?: string | null;
          metodo: Database["public"]["Enums"]["metodo_caso"];
          estado?: Database["public"]["Enums"]["estado_caso"];
          ronda_actual?: number;
          sla_tipo?: string | null;
          plazo?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          creador_id?: string;
          estudio_id?: string | null;
          carpeta_id?: string | null;
          nombre?: string;
          descripcion?: string | null;
          metodo?: Database["public"]["Enums"]["metodo_caso"];
          estado?: Database["public"]["Enums"]["estado_caso"];
          ronda_actual?: number;
          sla_tipo?: string | null;
          plazo?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      caso_partes: {
        Row: {
          id: string;
          caso_id: string;
          usuario_id: string;
          rol_en_caso: Database["public"]["Enums"]["rol_en_caso"];
          estado_invitacion: Database["public"]["Enums"]["estado_invitacion"];
          fecha_union: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          caso_id: string;
          usuario_id: string;
          rol_en_caso: Database["public"]["Enums"]["rol_en_caso"];
          estado_invitacion?: Database["public"]["Enums"]["estado_invitacion"];
          fecha_union?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          caso_id?: string;
          usuario_id?: string;
          rol_en_caso?: Database["public"]["Enums"]["rol_en_caso"];
          estado_invitacion?: Database["public"]["Enums"]["estado_invitacion"];
          fecha_union?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      invitaciones: {
        Row: {
          id: string;
          caso_id: string;
          tipo: Database["public"]["Enums"]["tipo_invitacion"];
          token: string | null;
          email_destino: string | null;
          estado: Database["public"]["Enums"]["estado_invitacion"];
          fecha_envio: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          caso_id: string;
          tipo: Database["public"]["Enums"]["tipo_invitacion"];
          token?: string | null;
          email_destino?: string | null;
          estado?: Database["public"]["Enums"]["estado_invitacion"];
          fecha_envio?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          caso_id?: string;
          tipo?: Database["public"]["Enums"]["tipo_invitacion"];
          token?: string | null;
          email_destino?: string | null;
          estado?: Database["public"]["Enums"]["estado_invitacion"];
          fecha_envio?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      items: {
        Row: {
          id: string;
          caso_id: string;
          parte_id: string;
          categoria: Database["public"]["Enums"]["categoria_item"];
          nombre: string;
          descripcion: string | null;
          valor_min: string | null;
          valor_max: string | null;
          puede_ceder: boolean;
          condiciones_cesion: string | null;
          privado: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          caso_id: string;
          parte_id: string;
          categoria: Database["public"]["Enums"]["categoria_item"];
          nombre: string;
          descripcion?: string | null;
          valor_min?: string | null;
          valor_max?: string | null;
          puede_ceder?: boolean;
          condiciones_cesion?: string | null;
          privado?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          caso_id?: string;
          parte_id?: string;
          categoria?: Database["public"]["Enums"]["categoria_item"];
          nombre?: string;
          descripcion?: string | null;
          valor_min?: string | null;
          valor_max?: string | null;
          puede_ceder?: boolean;
          condiciones_cesion?: string | null;
          privado?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      rondas: {
        Row: {
          id: string;
          caso_id: string;
          numero: number;
          estado: Database["public"]["Enums"]["estado_ronda"];
          fecha_inicio: string;
          fecha_fin: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          caso_id: string;
          numero: number;
          estado?: Database["public"]["Enums"]["estado_ronda"];
          fecha_inicio?: string;
          fecha_fin?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          caso_id?: string;
          numero?: number;
          estado?: Database["public"]["Enums"]["estado_ronda"];
          fecha_inicio?: string;
          fecha_fin?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      propuestas: {
        Row: {
          id: string;
          caso_id: string;
          ronda_id: string;
          contenido: Json;
          fundamentacion: string | null;
          estado: Database["public"]["Enums"]["estado_propuesta"];
          modelo_ia: string | null;
          fecha: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          caso_id: string;
          ronda_id: string;
          contenido: Json;
          fundamentacion?: string | null;
          estado?: Database["public"]["Enums"]["estado_propuesta"];
          modelo_ia?: string | null;
          fecha?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          caso_id?: string;
          ronda_id?: string;
          contenido?: Json;
          fundamentacion?: string | null;
          estado?: Database["public"]["Enums"]["estado_propuesta"];
          modelo_ia?: string | null;
          fecha?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      respuestas_propuesta: {
        Row: {
          id: string;
          propuesta_id: string;
          parte_id: string;
          decision: Database["public"]["Enums"]["decision_propuesta"];
          fecha: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          propuesta_id: string;
          parte_id: string;
          decision: Database["public"]["Enums"]["decision_propuesta"];
          fecha?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          propuesta_id?: string;
          parte_id?: string;
          decision?: Database["public"]["Enums"]["decision_propuesta"];
          fecha?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      mediaciones: {
        Row: {
          id: string;
          caso_id: string;
          mediador_id: string;
          estado: Database["public"]["Enums"]["estado_mediacion"];
          ronda: number;
          fecha_solicitud: string;
          fecha_aceptacion: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          caso_id: string;
          mediador_id: string;
          estado?: Database["public"]["Enums"]["estado_mediacion"];
          ronda: number;
          fecha_solicitud?: string;
          fecha_aceptacion?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          caso_id?: string;
          mediador_id?: string;
          estado?: Database["public"]["Enums"]["estado_mediacion"];
          ronda?: number;
          fecha_solicitud?: string;
          fecha_aceptacion?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      acuerdos: {
        Row: {
          id: string;
          caso_id: string;
          contenido: Json;
          documento_url: string | null;
          docusign_envelope_id: string | null;
          estado: Database["public"]["Enums"]["estado_acuerdo"];
          fecha: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          caso_id: string;
          contenido: Json;
          documento_url?: string | null;
          docusign_envelope_id?: string | null;
          estado?: Database["public"]["Enums"]["estado_acuerdo"];
          fecha?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          caso_id?: string;
          contenido?: Json;
          documento_url?: string | null;
          docusign_envelope_id?: string | null;
          estado?: Database["public"]["Enums"]["estado_acuerdo"];
          fecha?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      firmas: {
        Row: {
          id: string;
          acuerdo_id: string;
          usuario_id: string;
          docusign_status: string;
          fecha_firma: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          acuerdo_id: string;
          usuario_id: string;
          docusign_status?: string;
          fecha_firma?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          acuerdo_id?: string;
          usuario_id?: string;
          docusign_status?: string;
          fecha_firma?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      tareas: {
        Row: {
          id: string;
          acuerdo_id: string;
          caso_id: string;
          tipo: Database["public"]["Enums"]["tipo_tarea"];
          descripcion: string;
          fecha_evento: string | null;
          estado: Database["public"]["Enums"]["estado_tarea"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          acuerdo_id: string;
          caso_id: string;
          tipo: Database["public"]["Enums"]["tipo_tarea"];
          descripcion: string;
          fecha_evento?: string | null;
          estado?: Database["public"]["Enums"]["estado_tarea"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          acuerdo_id?: string;
          caso_id?: string;
          tipo?: Database["public"]["Enums"]["tipo_tarea"];
          descripcion?: string;
          fecha_evento?: string | null;
          estado?: Database["public"]["Enums"]["estado_tarea"];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      incumplimientos: {
        Row: {
          id: string;
          acuerdo_id: string;
          reportante_id: string;
          descripcion: string;
          fecha: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          acuerdo_id: string;
          reportante_id: string;
          descripcion: string;
          fecha?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          acuerdo_id?: string;
          reportante_id?: string;
          descripcion?: string;
          fecha?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      notificaciones: {
        Row: {
          id: string;
          usuario_id: string;
          caso_id: string | null;
          canal: Database["public"]["Enums"]["canal_notificacion"];
          evento: string;
          estado: string;
          fecha: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          usuario_id: string;
          caso_id?: string | null;
          canal: Database["public"]["Enums"]["canal_notificacion"];
          evento: string;
          estado?: string;
          fecha?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          usuario_id?: string;
          caso_id?: string | null;
          canal?: Database["public"]["Enums"]["canal_notificacion"];
          evento?: string;
          estado?: string;
          fecha?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      auditoria: {
        Row: {
          id: string;
          usuario_id: string | null;
          accion: string;
          entidad: string;
          entidad_id: string | null;
          detalle: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          usuario_id?: string | null;
          accion: string;
          entidad: string;
          entidad_id?: string | null;
          detalle?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          usuario_id?: string | null;
          accion?: string;
          entidad?: string;
          entidad_id?: string | null;
          detalle?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      rol_usuario: "admin" | "parte" | "mediador" | "estudio";
      verif_biometrica: "pendiente" | "aprobada" | "rechazada";
      metodo_caso: "negociacion" | "conciliacion" | "mediacion";
      estado_caso:
        | "nuevo"
        | "activo"
        | "en_negociacion"
        | "acordado"
        | "cerrado"
        | "terminado"
        | "vencido";
      rol_en_caso: "parte_a" | "parte_b" | "mediador";
      estado_invitacion: "pendiente" | "aceptada" | "rechazada" | "expirada";
      tipo_invitacion: "link" | "codigo" | "email";
      categoria_item:
        | "cuidado_ninos"
        | "cronogramas"
        | "bienes"
        | "economico"
        | "personalizado";
      estado_ronda: "activa" | "completada";
      estado_propuesta: "pendiente" | "aceptada" | "rechazada";
      decision_propuesta: "acepta" | "rechaza";
      estado_mediacion:
        | "solicitada"
        | "aceptada"
        | "rechazada"
        | "activa"
        | "finalizada";
      estado_acuerdo: "borrador" | "enviado_a_firma" | "firmado" | "con_aviso";
      tipo_tarea: "tarea" | "evento_calendario";
      estado_tarea: "pendiente" | "en_progreso" | "completada";
      estado_suscripcion: "activa" | "cancelada" | "vencida" | "pendiente_pago";
      estado_pago: "pendiente" | "aprobado" | "rechazado";
      canal_notificacion: "email" | "push";
    };
    CompositeTypes: Record<string, never>;
  };
};
