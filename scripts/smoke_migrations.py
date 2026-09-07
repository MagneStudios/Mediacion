"""
smoke_migrations.py — Verifica que las migraciones se aplican correctamente.
Uso: python scripts/smoke_migrations.py
Requiere: psycopg2-binary
Conexión: lee DATABASE_URL o usa defaults de Supabase local.

Verifica:
1. Todas las tablas existen
2. Todas las funciones helper existen
3. Triggers de updated_at instalados
4. Triggers de auditoría instalados
5. RLS habilitado en tablas sensibles
6. Seeds de catálogo (planes, configuracion)
7. Enum types creados
"""

import os
import sys

import psycopg2

DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:57002/postgres",
)

EXPECTED_TABLES = [
    "planes", "configuracion", "inversores", "estudios", "usuarios",
    "carpetas", "suscripciones", "pagos", "casos", "caso_partes",
    "invitaciones", "items", "rondas", "propuestas", "respuestas_propuesta",
    "mediaciones", "acuerdos", "firmas", "tareas", "incumplimientos",
    "notificaciones", "auditoria", "facturas", "envios_email",
    "legal_documents", "user_agreements", "solicitudes_arrepentimiento",
    "avisos_version_legal", "solicitudes_contacto", "rate_limit_counters",
    "usage_counters", "lawyer_requests", "payment_events",
    "negociaciones",
]

EXPECTED_FUNCTIONS = [
    "update_updated_at_column",
    "handle_new_user",
    "validate_caso_estado_transition",
    "validate_propuesta_estado_transition",
    "audit_trigger_func",
    "is_part_of_case",
    "is_mediator_of_case",
    "is_admin",
    "is_estudio",
    "is_owner_estudio_of_case",
    "is_own_subscription",
    "has_accepted_current",
    "consume_quota",
    "custom_access_token",
    "caso_ambas_partes_suscripciones_activas",
    "trg_casos_gate_suscripciones_fn",
]

EXPECTED_ENUMS = [
    "rol_usuario", "verif_biometrica", "metodo_caso", "estado_caso",
    "rol_en_caso", "estado_invitacion", "tipo_invitacion", "categoria_item",
    "estado_ronda", "estado_propuesta", "decision_propuesta",
    "estado_mediacion", "estado_acuerdo", "tipo_tarea", "estado_tarea",
    "estado_suscripcion", "estado_pago", "canal_notificacion",
    "estado_notificacion", "estado_arrepentimiento",
    "estado_solicitud_abogado", "materia_acuerdo", "estado_negociacion",
]

RLS_TABLES = [
    "usuarios", "estudios", "carpetas", "suscripciones", "pagos",
    "casos", "caso_partes", "invitaciones", "items", "rondas",
    "propuestas", "respuestas_propuesta", "mediaciones", "acuerdos",
    "firmas", "tareas", "incumplimientos", "notificaciones",
    "configuracion", "auditoria", "planes", "inversores",
    "facturas", "envios_email",
    "legal_documents", "user_agreements", "solicitudes_arrepentimiento",
    "avisos_version_legal", "solicitudes_contacto", "rate_limit_counters",
    "usage_counters", "lawyer_requests", "payment_events",
    "negociaciones",
]

RESULTS = []


def check(name, cur, sql, expected, description=""):
    cur.execute(sql)
    row = cur.fetchone()
    actual = row[0] if row else None
    passed = actual == expected
    status = "PASS" if passed else "FAIL"
    RESULTS.append({"name": name, "status": status, "expected": expected, "actual": actual})
    print(f"  [{status}] {name}" + (f" ({description})" if description else ""))
    return passed


def main():
    print(f"Connecting to {DB_URL.split('@')[1]}...")
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = True
    cur = conn.cursor()

    try:
        # 1. Tables
        print()
        print("=== Tables ===")
        cur.execute("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name
        """)
        existing_tables = {row[0] for row in cur.fetchall()}
        missing_tables = [t for t in EXPECTED_TABLES if t not in existing_tables]
        check("All expected tables exist", cur,
              f"SELECT {len(EXPECTED_TABLES)} = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE')",
              True, f"{len(EXPECTED_TABLES)} expected, {len(existing_tables)} found")
        if missing_tables:
            print(f"    Missing: {', '.join(missing_tables)}")

        # 2. Functions
        print()
        print("=== Functions ===")
        cur.execute("""
            SELECT routine_name FROM information_schema.routines
            WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
        """)
        existing_funcs = {row[0] for row in cur.fetchall()}
        for fn in EXPECTED_FUNCTIONS:
            found = fn in existing_funcs
            status = "PASS" if found else "FAIL"
            RESULTS.append({"name": f"function:{fn}", "status": status, "expected": True, "actual": found})
            print(f"  [{status}] Function '{fn}'")

        # 3. Enum types
        print()
        print("=== Enum Types ===")
        cur.execute("""
            SELECT typname FROM pg_type
            WHERE typcategory = 'E' AND typnamespace = 'public'::regnamespace
            ORDER BY typname
        """)
        existing_enums = {row[0] for row in cur.fetchall()}
        for enum in EXPECTED_ENUMS:
            found = enum in existing_enums
            status = "PASS" if found else "FAIL"
            RESULTS.append({"name": f"enum:{enum}", "status": status, "expected": True, "actual": found})
            print(f"  [{status}] Enum '{enum}'")

        # 4. RLS enabled
        print()
        print("=== RLS ===")
        cur.execute("""
            SELECT tablename FROM pg_tables
            WHERE schemaname = 'public'
            AND tablename IN (SELECT unnest(ARRAY[%s]))
        """, (",".join(RLS_TABLES),))
        # Alternative: check via pg_tables with rowsecurity
        cur.execute("""
            SELECT tablename, rowsecurity FROM pg_tables
            WHERE schemaname = 'public'
        """)
        rls_status = {row[0]: row[1] for row in cur.fetchall()}
        for table in RLS_TABLES:
            enabled = rls_status.get(table, False)
            status = "PASS" if enabled else "FAIL"
            RESULTS.append({"name": f"rls:{table}", "status": status, "expected": True, "actual": enabled})
            print(f"  [{status}] RLS on '{table}'")

        # 5. Catalog seeds
        print()
        print("=== Catalog Seeds ===")
        check("Planes seeded", cur, "SELECT COUNT(*) FROM planes", 6, "6 plans expected")
        check("Configuracion seeded", cur, "SELECT COUNT(*) FROM configuracion", 7, "7 config entries expected")
        check("Legal documents seeded", cur, "SELECT COUNT(*) FROM legal_documents", 2, "terms + privacy v1.0 expected")

        # 6. updated_at triggers count
        print()
        print("=== Triggers ===")
        cur.execute("""
            SELECT COUNT(*) FROM information_schema.triggers
            WHERE trigger_schema = 'public'
            AND trigger_name = 'set_updated_at'
        """)
        check("updated_at triggers installed", cur,
              "SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema='public' AND trigger_name='set_updated_at'",
              22, "22 tables have set_updated_at")

        check("Audit triggers installed", cur,
              "SELECT COUNT(DISTINCT trigger_name) FROM information_schema.triggers WHERE trigger_schema='public' AND trigger_name LIKE 'audit_%'",
              12, "12 audit trigger names")

        check("Propuesta state machine trigger installed", cur,
              "SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema='public' AND trigger_name='trigger_validate_propuesta_estado'",
              1, "propuesta estado trigger")

        # 6b. C-01 gate de suscripciones: enum value + trigger
        print()
        print("=== C-01 Gate Suscripciones ===")
        check("estado_caso.pendiente_suscripciones exists", cur,
              "SELECT NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid "
              "WHERE t.typname = 'estado_caso' AND e.enumlabel = 'pendiente_suscripciones') = false",
              True, "ADD VALUE 'pendiente_suscripciones' aplicado")
        check("gate trigger installed", cur,
              "SELECT COUNT(DISTINCT trigger_name) FROM information_schema.triggers WHERE trigger_schema='public' AND trigger_name='trg_casos_gate_suscripciones'",
              1, "trigger de gate de suscripciones sobre casos")

        # 6c. Parte 5 — versionado de acuerdos: 4 columnas + índice
        print()
        print("=== Parte 5: versionado de acuerdos ===")
        check("acuerdos.version exists", cur,
              "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='acuerdos' AND column_name='version'",
              1, "ADD COLUMN version (Parte 5)")
        check("acuerdos.supersedes_agreement_id exists", cur,
              "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='acuerdos' AND column_name='supersedes_agreement_id'",
              1, "ADD COLUMN supersedes_agreement_id (Parte 5)")
        check("acuerdos.vigente exists", cur,
              "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='acuerdos' AND column_name='vigente'",
              1, "ADD COLUMN vigente (Parte 5)")
        check("acuerdos.valid_from exists", cur,
              "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='acuerdos' AND column_name='valid_from'",
              1, "ADD COLUMN valid_from (Parte 5)")
        check("idx_acuerdos_negociacion_vigente exists", cur,
              "SELECT COUNT(*) FROM pg_indexes WHERE schemaname='public' AND indexname='idx_acuerdos_negociacion_vigente'",
              1, "CREATE INDEX (negociacion_id, vigente)")

        # 7. UNIQUE constraints
        print()
        print("=== UNIQUE Constraints ===")
        cur.execute("""
            SELECT conname FROM pg_constraint
            WHERE connamespace = 'public'::regnamespace
            AND contype = 'u'
            ORDER BY conname
        """)
        existing_uniques = {row[0] for row in cur.fetchall()}
        expected_uniques = [
            "caso_partes_caso_usuario_unique",
            "negociaciones_caso_materia_unique",
            "respuestas_propuesta_unique",
            "rondas_negociacion_numero_unique",
            "propuestas_negociacion_ronda_unique",
        ]
        for uq in expected_uniques:
            found = uq in existing_uniques
            status = "PASS" if found else "FAIL"
            RESULTS.append({"name": f"unique:{uq}", "status": status, "expected": True, "actual": found})
            print(f"  [{status}] UNIQUE constraint '{uq}'")

        # --- Summary ---
        print()
        passed = sum(1 for r in RESULTS if r["status"] == "PASS")
        failed = sum(1 for r in RESULTS if r["status"] == "FAIL")
        total = len(RESULTS)
        print(f"=== RESULTS: {passed}/{total} passed, {failed} failed ===")
        sys.exit(1 if failed else 0)

    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
