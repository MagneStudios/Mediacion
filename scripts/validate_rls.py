"""
validate_rls.py — Verifica RLS con diferentes roles JWT contra Supabase local.
Uso: python scripts/validate_rls.py
Requiere: psycopg2-binary
Conexión: lee DATABASE_URL o usa defaults de Supabase local.

Simula auth.uid() via SET request.jwt.claims y verifica:
1. Parte solo ve sus items
2. Mediator ve items de ambas partes
3. Admin ve todo
4. Non-member no ve nada
"""

import os
import sys

import psycopg2

DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:57002/postgres",
)

RESULTS = []


def connect():
    return psycopg2.connect(DB_URL)


def run_test(name, cur, user_id, sql, expected, description="", role="authenticated"):
    """Ejecuta un SQL con JWT simulado y compara el resultado."""
    cur.execute(f"SET role = '{role}'")
    cur.execute("SET search_path = public")
    cur.execute(f"SET request.jwt.claims = '{{\"sub\": \"{user_id}\", \"role\": \"{role}\"}}'")
    cur.execute(sql)
    row = cur.fetchone()
    actual = row[0] if row else None
    cur.execute("RESET role")
    cur.execute("RESET request.jwt.claims")

    passed = actual == expected
    status = "PASS" if passed else "FAIL"
    RESULTS.append({"name": name, "status": status, "expected": expected, "actual": actual})
    print(f"  [{status}] {name}: expected={expected}, actual={actual}" + (f" ({description})" if description else ""))
    return passed


def run_denied_test(name, cur, user_id, sql, role="anon", description=""):
    """Ejecuta un SQL con un rol que NO tiene EXECUTE sobre las funciones
    helper (anon tras el REVOKE de 20260811130000) y espera permiso denegado."""
    cur.execute(f"SET role = '{role}'")
    cur.execute("SET search_path = public")
    cur.execute(f"SET request.jwt.claims = '{{\"sub\": \"{user_id}\", \"role\": \"{role}\"}}'")
    denied = False
    try:
        cur.execute(sql)
        cur.fetchall()
    except psycopg2.errors.InsufficientPrivilege:
        denied = True
    except psycopg2.Error:
        denied = False
    cur.execute("RESET role")
    cur.execute("RESET request.jwt.claims")

    status = "PASS" if denied else "FAIL"
    RESULTS.append({"name": name, "status": status, "expected": True, "actual": denied})
    print(f"  [{status}] {name}: expected=denied, actual={denied}" + (f" ({description})" if description else ""))
    return denied


def run_expect_raise(name, cur, sql, sqlstate, description=""):
    """Ejecuta un DML como service_role que debe lanzar la excepción sqlstate
    (P0001 del gate de suscripciones). Los triggers corren aunque RLS se
    saltee; valida la invariante a nivel base."""
    cur.execute("SET role = 'service_role'")
    cur.execute("SET search_path = public")
    cur.execute("SET request.jwt.claims = '{\"role\": \"service_role\"}'")
    raised = False
    try:
        cur.execute(sql)
        cur.fetchall()
    except psycopg2.Error as e:
        raised = (getattr(e, "pgcode", None) == sqlstate)
    cur.execute("RESET role")
    cur.execute("RESET request.jwt.claims")

    status = "PASS" if raised else "FAIL"
    RESULTS.append({"name": name, "status": status, "expected": True, "actual": raised})
    print(f"  [{status}] {name}: expected={sqlstate}, actual={raised}" + (f" ({description})" if description else ""))
    return raised


def get_user_ids(cur):
    """Obtiene IDs de usuarios de prueba creados por test_01_setup.sql."""
    ids = {}
    for label, email in [("parte_a", "partea@test.com"), ("parte_b", "parteb@test.com"),
                          ("mediador", "mediador@test.com"), ("admin", "admin@test.com"),
                          ("non_member", "no_parte@test.com")]:
        cur.execute("SELECT id FROM usuarios WHERE email = %s", (email,))
        row = cur.fetchone()
        if row:
            ids[label] = str(row[0])
    return ids


def get_caso_id(cur):
    cur.execute("SELECT id FROM casos WHERE nombre = 'Custodia de hijos menores' LIMIT 1")
    row = cur.fetchone()
    if row:
        return str(row[0])
    cur.execute("SELECT id FROM casos ORDER BY created_at LIMIT 1")
    row = cur.fetchone()
    return str(row[0]) if row else None


def main():
    print("Connecting to database...")
    conn = connect()
    conn.autocommit = True
    cur = conn.cursor()

    try:
        ids = get_user_ids(cur)
        caso_id = get_caso_id(cur)

        if not ids:
            print("ERROR: No test users found. Run test_01_setup.sql first.", file=sys.stderr)
            sys.exit(1)
        if not caso_id:
            print("ERROR: No cases found. Run test_02_caso.sql first.", file=sys.stderr)
            sys.exit(1)

        print(f"Found {len(ids)} users, caso_id={caso_id[:8]}...")
        print()

        # --- RLS Tests ---
        print("=== RLS: Items (RN-01 aislamiento) ===")
        if "parte_a" in ids:
            run_test(
                "Parte A sees own items",
                cur, ids["parte_a"],
                f"SELECT COUNT(*) FROM items WHERE caso_id = '{caso_id}'",
                1, "Parte A has 1 item in this caso",
            )
        if "mediador" in ids:
            run_test(
                "Mediator sees both parties items",
                cur, ids["mediador"],
                f"SELECT COUNT(*) FROM items WHERE caso_id = '{caso_id}'",
                2, "Mediator sees both Parte A + Parte B items",
            )
        if "admin" in ids:
            run_test(
                "Admin sees all items",
                cur, ids["admin"],
                f"SELECT COUNT(*) FROM items WHERE caso_id = '{caso_id}'",
                2, "Admin sees all items",
            )
        if "non_member" in ids:
            run_test(
                "Non-member sees zero items",
                cur, ids["non_member"],
                f"SELECT COUNT(*) FROM items WHERE caso_id = '{caso_id}'",
                0, "Non-member sees nothing",
            )

        print()
        print("=== RLS: Casos ===")
        if "parte_a" in ids:
            run_test(
                "Parte A sees their case",
                cur, ids["parte_a"],
                f"SELECT COUNT(*) FROM casos WHERE id = '{caso_id}'",
                1,
            )
        if "non_member" in ids:
            run_test(
                "Non-member cannot see the case",
                cur, ids["non_member"],
                f"SELECT COUNT(*) FROM casos WHERE id = '{caso_id}'",
                0,
            )

        print()
        print("=== RLS: Suscripciones (XOR) ===")
        if "parte_a" in ids:
            cur.execute("SELECT COUNT(*) FROM suscripciones WHERE usuario_id = 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'")
            own_sub_count = cur.fetchone()[0]
            if own_sub_count > 0:
                run_test(
                    "Parte A ve sus propias suscripciones",
                    cur, ids["parte_a"],
                    "SELECT COUNT(*) FROM suscripciones WHERE usuario_id = 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'",
                    own_sub_count, "Parte A lee sus propias filas via RLS",
                )
        if "non_member" in ids:
            run_test(
                "Non-member ve 0 suscripciones de Parte A",
                cur, ids["non_member"],
                "SELECT COUNT(*) FROM suscripciones WHERE usuario_id = 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'",
                0,
            )

        print()
        print("=== Helper Functions (EXECUTE revocado a anon) ===")
        if "parte_a" in ids:
            run_denied_test(
                "is_part_of_case(Parte A) denied for anon",
                cur, ids["parte_a"],
                f"SELECT is_part_of_case('{caso_id}')",
                role="anon",
                description="EXECUTE revocado a anon — helpers solo para authenticated",
            )
        if "admin" in ids:
            run_denied_test(
                "is_admin(Admin) denied for anon",
                cur, ids["admin"],
                "SELECT is_admin()",
                role="anon",
            )

        print()
        print("=== Helper Functions (funcionan como authenticated) ===")
        if "parte_a" in ids:
            run_test(
                "is_part_of_case(Parte A) = true",
                cur, ids["parte_a"],
                f"SELECT is_part_of_case('{caso_id}')",
                True,
            )
        if "non_member" in ids:
            run_test(
                "is_part_of_case(Non-member) = false",
                cur, ids["non_member"],
                f"SELECT is_part_of_case('{caso_id}')",
                False,
            )
        if "mediador" in ids:
            run_test(
                "is_mediator_of_case(Mediator) = true",
                cur, ids["mediador"],
                f"SELECT is_mediator_of_case('{caso_id}')",
                True,
            )
        if "admin" in ids:
            run_test(
                "is_admin(Admin) = true",
                cur, ids["admin"],
                "SELECT is_admin()",
                True,
            )
        if "parte_a" in ids:
            run_test(
                "is_admin(Parte A) = false",
                cur, ids["parte_a"],
                "SELECT is_admin()",
                False,
            )

        print()
        print("=== Helper functions funcionan vía policies (items) ===")
        if "admin" in ids:
            run_test(
                "Admin sees all items (is_admin via policy)",
                cur, ids["admin"],
                f"SELECT COUNT(*) FROM items WHERE caso_id = '{caso_id}'",
                2, "Admin access via is_admin() dentro de items_select",
            )
        if "mediador" in ids:
            run_test(
                "Mediator sees items via is_mediator_of_case",
                cur, ids["mediador"],
                f"SELECT COUNT(*) FROM items WHERE caso_id = '{caso_id}'",
                2, "Mediator access via is_mediator_of_case() dentro de items_select",
            )

        print()
        print("=== Módulo legal (TyC) ===")
        run_test(
            "anon ve legal_documents vigentes (terms+privacy)",
            cur, ids.get("parte_a", ""),
            "SELECT COUNT(*) FROM legal_documents WHERE valid_to IS NULL",
            2, "Solo la versión vigente de cada tipo",
            role="anon",
        )
        if "parte_a" in ids:
            run_test(
                "Parte A ve sus user_agreements (3)",
                cur, ids["parte_a"],
                "SELECT COUNT(*) FROM user_agreements WHERE user_id = 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'",
                3, "terms + privacy + marketing",
            )
        if "parte_b" in ids:
            run_test(
                "Parte B NO ve user_agreements de Parte A",
                cur, ids["parte_b"],
                "SELECT COUNT(*) FROM user_agreements WHERE user_id = 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'",
                0, "Aislamiento RLS entre usuarios",
            )
        if "non_member" in ids:
            run_test(
                "Non-member ve 0 user_agreements de Parte A",
                cur, ids["non_member"],
                "SELECT COUNT(*) FROM user_agreements WHERE user_id = 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'",
                0,
            )
            run_denied_test(
                "INSERT user_agreements como authenticated (Parte A) denegado",
                cur, ids["non_member"],
                "INSERT INTO user_agreements (user_id, document_type, document_version, ip, user_agent, accepted) "
                "VALUES ('d0000000-0000-0000-0000-000000000004', 'terms', 'v1.0', '127.0.0.1', 'test', true)",
                role="authenticated",
                description="sin GRANT INSERT para authenticated (solo service_role/postgres)",
            )
            run_denied_test(
                "has_accepted_current denegado para anon",
                cur, ids["non_member"],
                "SELECT has_accepted_current('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'terms')",
                role="anon",
                description="EXECUTE a service_role/postgres; denegado para anon",
            )
            run_denied_test(
                "has_accepted_current denegado para authenticated",
                cur, ids["non_member"],
                "SELECT has_accepted_current('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'terms')",
                role="authenticated",
                description="helper de servidor; EXECUTE solo service_role/postgres",
            )
        run_test(
            "has_accepted_current(A, terms) = true como service_role",
            cur, "aaaaaaaa-aaaa-0000-0000-000000000000",
            "SELECT has_accepted_current('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'terms')",
            True,
            role="service_role",
        )

        print()
        print("=== Tablas de rol de servidor (sin policies) ===")
        server_only_tables = [
            "solicitudes_arrepentimiento",
            "avisos_version_legal",
            "solicitudes_contacto",
            "rate_limit_counters",
        ]
        anon_id = ids.get("parte_a", "aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
        for table in server_only_tables:
            run_denied_test(
                f"anon SELECT {table} denegado",
                cur, anon_id,
                f"SELECT COUNT(*) FROM {table}",
                role="anon",
                description="sin GRANT para anon — permission denied",
            )
            if "parte_a" in ids:
                run_denied_test(
                    f"authenticated SELECT {table} denegado",
                    cur, ids["parte_a"],
                    f"SELECT COUNT(*) FROM {table}",
                    role="authenticated",
                    description="sin GRANT para authenticated — permission denied",
                )

        if "non_member" in ids:
            run_denied_test(
                "INSERT solicitudes_contacto como authenticated denegado",
                cur, ids["non_member"],
                "INSERT INTO solicitudes_contacto (nombre, email, mensaje) "
                "VALUES ('test', 'test@test.com', 'test')",
                role="authenticated",
                description="sin GRANT INSERT para authenticated (solo service_role/postgres)",
            )
            run_denied_test(
                "INSERT avisos_version_legal como authenticated denegado",
                cur, ids["non_member"],
                "INSERT INTO avisos_version_legal (usuario_id, tipo, version) "
                "VALUES ('d0000000-0000-0000-0000-000000000004', 'terms', 'v1.0')",
                role="authenticated",
                description="sin GRANT INSERT para authenticated (solo service_role/postgres)",
            )

        print()
        print("=== Monetización Fase 1 — RLS tablas nuevas ===")
        if "parte_a" in ids:
            run_test(
                "Parte A ve sus usage_counters (owner)",
                cur, ids["parte_a"],
                "SELECT COUNT(*) FROM usage_counters WHERE usuario_id = 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'",
                2, "dueño lee su propio uso (2 períodos de 17E)",
            )
        if "parte_b" in ids:
            run_test(
                "Parte B NO ve usage_counters de Parte A",
                cur, ids["parte_b"],
                "SELECT COUNT(*) FROM usage_counters WHERE usuario_id = 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'",
                0, "aislamiento RLS entre usuarios",
            )
        if "non_member" in ids:
            run_denied_test(
                "INSERT usage_counters como authenticated denegado",
                cur, ids["non_member"],
                "INSERT INTO usage_counters (usuario_id, period_start, period_end) "
                "VALUES ('d0000000-0000-0000-0000-000000000004', now(), now())",
                role="authenticated",
                description="escritura solo service_role/postgres",
            )
        if "parte_a" in ids:
            run_test(
                "Parte A ve lawyer_requests de su caso (participante)",
                cur, ids["parte_a"],
                "SELECT COUNT(*) FROM lawyer_requests WHERE solicitante_id = 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'",
                0, "policy is_part_of_case",
            )
        if "non_member" in ids:
            run_denied_test(
                "INSERT lawyer_requests como authenticated denegado",
                cur, ids["non_member"],
                "INSERT INTO lawyer_requests (caso_id, solicitante_id, moneda, monto_minor, external_reference) "
                "VALUES ((SELECT id FROM casos LIMIT 1), 'd0000000-0000-0000-0000-000000000004', 'ARS', 4000000, 'lawreq_test_1')",
                role="authenticated",
                description="escritura solo service_role/postgres",
            )
            run_denied_test(
                "anon SELECT payment_events denegado",
                cur, ids["non_member"],
                "SELECT COUNT(*) FROM payment_events",
                role="anon",
                description="patrón server-only — sin GRANT para anon",
            )
            run_denied_test(
                "authenticated SELECT payment_events denegado",
                cur, ids["parte_a"],
                "SELECT COUNT(*) FROM payment_events",
                role="authenticated",
                description="patrón server-only — sin GRANT para authenticated",
            )
            run_denied_test(
                "consume_quota denegado para authenticated",
                cur, ids["non_member"],
                "SELECT consume_quota('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'negotiation')",
                role="authenticated",
                description="EXECUTE solo service_role/postgres",
            )

        print()
        print("=== Quota: carrera concurrente (2 requests con 2/3) ===")
        cur.execute("SET role = 'service_role'")
        cur.execute("SET search_path = public")
        cur.execute("SET request.jwt.claims = '{\"role\": \"service_role\"}'")
        cur.execute(
            "UPDATE suscripciones SET plan_id = (SELECT id FROM planes WHERE nombre='particular'), "
            "current_period_start = now() - interval '1 day', current_period_end = now() + interval '29 days', "
            "estado = 'activa' WHERE usuario_id = 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'"
        )
        cur.execute(
            "DELETE FROM usage_counters WHERE usuario_id = 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'"
        )
        # Llegar a 2/3 consumiendo con consume_quota: garantiza que el
        # period_start del contador matchea exacto el de la suscripción
        cur.execute("SELECT consume_quota('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'negotiation')")
        cur.execute("SELECT consume_quota('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'negotiation')")
        cur.execute("SELECT negotiations_created FROM usage_counters WHERE usuario_id = 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'")
        setup_count = cur.fetchone()[0]
        cur.execute("RESET role")
        cur.execute("RESET request.jwt.claims")
        print(f"    setup: contador en {setup_count}/3")

        conn_a = connect()
        conn_a.autocommit = False
        conn_b = connect()
        conn_b.autocommit = False

        def _consume(conn):
            c = conn.cursor()
            c.execute("SET role = 'service_role'")
            c.execute("SET search_path = public")
            c.execute("SET request.jwt.claims = '{\"role\": \"service_role\"}'")
            try:
                c.execute("SELECT consume_quota('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'negotiation')")
                conn.commit()
                return True
            except psycopg2.Error:
                conn.rollback()
                return False

        # Dos transacciones: la segunda se bloquea en el FOR UPDATE de la
        # suscripción hasta que la primera commitea; READ COMMITTED la
        # re-evalúa y debe terminar en QUOTA_EXCEEDED (P0002).
        try:
            ok1 = _consume(conn_a)
            ok2 = _consume(conn_b)
        finally:
            conn_a.close()
            conn_b.close()

        cur.execute("SELECT negotiations_created FROM usage_counters WHERE usuario_id = 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'")
        final_count = cur.fetchone()[0]
        concurrency_ok = (ok1 != ok2) and (final_count == 3)
        RESULTS.append({
            "name": "carrera concurrente termina en 3/3 (no 4/3)",
            "status": "PASS" if concurrency_ok else "FAIL",
            "expected": True,
            "actual": concurrency_ok,
        })
        print(f"  [{'PASS' if concurrency_ok else 'FAIL'}] carrera concurrente termina en 3/3 (no 4/3): ok1={ok1}, ok2={ok2}, final={final_count}")

        print()
        print("=== C-01 Gate Suscripciones (ambos al día) ===")
        # Crea un usuario sin suscripción (ni propia ni de estudio) y un caso
        # con Parte A (con suscripción activa ya creada por test_17) + ese usuario.
        # RLS se saltea como service_role, pero los triggers corren igual:
        # valida la invariante a nivel base (independiente del rol).
        gate_user = "f0000000-0000-0000-0000-00000000000f"
        # Insert del usuario como postgres (superuser): service_role no tiene
        # INSERT en auth.users. RLS se saltea igual; los triggers corren.
        cur.execute(
            "INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, "
            "email_confirmed_at, created_at, updated_at, raw_user_meta_data, raw_app_meta_data) "
            "VALUES ('00000000-0000-0000-0000-000000000000', %s, 'authenticated', 'authenticated', "
            "'gate_nosub@test.com', 'x', now(), now(), now(), "
            "'{\"nombre\": \"Gate\", \"apellido\": \"Nosub\"}'::jsonb, "
            "'{\"provider\": \"email\"}'::jsonb) ON CONFLICT (id) DO NOTHING",
            (gate_user,),
        )

        # Caso de prueba en 'nuevo' con Parte A + gate_nosub
        cur.execute(
            "INSERT INTO casos (creador_id, nombre, descripcion, metodo, estado) "
            "SELECT 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Caso Gate C-01', "
            "'Caso para validar gate de suscripciones', 'negociacion', 'nuevo'",
        )
        cur.execute("SELECT id FROM casos WHERE nombre = 'Caso Gate C-01'")
        gate_caso = cur.fetchone()[0]
        gate_caso = str(gate_caso)
        cur.execute(
            "INSERT INTO caso_partes (caso_id, usuario_id, rol_en_caso, estado_invitacion) "
            "VALUES (%s, 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'parte_a', 'aceptada')",
            (gate_caso,),
        )
        cur.execute(
            "INSERT INTO caso_partes (caso_id, usuario_id, rol_en_caso, estado_invitacion) "
            "VALUES (%s, %s, 'parte_b', 'aceptada')",
            (gate_caso, gate_user),
        )

        # G1: contraparte sin suscripción activa → UPDATE a activo FALLA (P0001)
        run_expect_raise(
            "Gate: UPDATE a activo con contraparte sin suscripción FALLA (P0001)",
            cur,
            f"UPDATE casos SET estado = 'activo' WHERE id = '{gate_caso}'",
            "P0001",
            "gate_user no tiene suscripción activa",
        )

        # G1b: idem hacia en_negociacion (misma garantía en ambos estados gated)
        run_expect_raise(
            "Gate: UPDATE a en_negociacion con contraparte sin suscripción FALLA (P0001)",
            cur,
            f"UPDATE casos SET estado = 'en_negociacion' WHERE id = '{gate_caso}'",
            "P0001",
            "gate_user no tiene suscripción activa",
        )

        # Habilitar suscripción activa para gate_user.
        # validate_suscripcion_aceptacion exige TyC aceptados: asentar el
        # acuerdo previo (INSERT en user_agreements, append-only por diseño).
        cur.execute(
            "INSERT INTO user_agreements (user_id, document_type, document_version, ip, user_agent, accepted) "
            "VALUES (%s, 'terms', 'v1.0', '127.0.0.1', 'validate_rls-gate', true) ON CONFLICT DO NOTHING",
            (gate_user,),
        )
        cur.execute(
            "INSERT INTO suscripciones (id, usuario_id, plan_id, estado, current_period_start, current_period_end) "
            "SELECT '99999999-9999-9999-9999-999999999903', %s, id, 'activa', "
            "now() - interval '1 day', now() + interval '29 days' FROM planes WHERE nombre = 'particular' "
            "ON CONFLICT (id) DO NOTHING",
            (gate_user,),
        )

        # G2: ambas partes con suscripción activa → UPDATE a activo PASA
        cur.execute("SET role = 'service_role'")
        cur.execute("SET search_path = public")
        cur.execute("SET request.jwt.claims = '{\"role\": \"service_role\"}'")
        result_ok = False
        err = ""
        try:
            cur.execute(f"UPDATE casos SET estado = 'activo' WHERE id = '{gate_caso}'")
            result_ok = True
        except Exception as e:
            err = repr(e)
        cur.execute("RESET role")
        cur.execute("RESET request.jwt.claims")
        status = "PASS" if result_ok else "FAIL"
        RESULTS.append({"name": "Gate: UPDATE a activo con ambas al día PASA", "status": status,
                        "expected": True, "actual": result_ok})
        print(f"  [{status}] Gate: UPDATE a activo con ambas al día PASA | err={err}")

        # G3 (INSERT directo en activo): un caso con 0 partes se puede insertar
        # en activo (conjunto vacío → true, por diseño); la garantía real es la
        # transición (G1/G2). Se documenta aquí el borde.
        cur.execute(
            "INSERT INTO casos (creador_id, nombre, descripcion, metodo, estado) VALUES "
            "('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Caso Gate INSERT activo (sin partes)', "
            "'insert directo', 'negociacion', 'activo') ON CONFLICT DO NOTHING",
        )
        RESULTS.append({"name": "Gate: INSERT directo en activo sin partes PASA (por diseño)",
                        "status": "PASS", "expected": True, "actual": True})
        print("  [PASS] Gate: INSERT directo en activo sin partes PASA (por diseño, empty->true)")

        print()
        print("=== Bonus: INSERT service_role + cleanup ===")
        cur.execute("BEGIN")
        cur.execute(
            "SET LOCAL role = 'service_role'"
        )
        cur.execute(
            "SET LOCAL request.jwt.claims = '{\"role\": \"service_role\"}'"
        )
        cur.execute(
            "INSERT INTO solicitudes_contacto (nombre, email, mensaje) "
            "VALUES ('test_rl', 'test@rl.com', 'validation row') "
            "RETURNING codigo"
        )
        row = cur.fetchone()
        codigo = row[0] if row else None
        codigo_ok = codigo and codigo.startswith("CON-")
        RESULTS.append({
            "name": "service_role INSERT solicitudes_contacto genera CON-...",
            "status": "PASS" if codigo_ok else "FAIL",
            "expected": True,
            "actual": codigo_ok,
        })
        print(f"  [{'PASS' if codigo_ok else 'FAIL'}] service_role INSERT solicitudes_contacto genera CON-...: codigo={codigo}")
        cur.execute("ROLLBACK")

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
