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


def run_test(name, cur, user_id, sql, expected, description=""):
    """Ejecuta un SQL con JWT simulado y compara el resultado."""
    cur.execute("SET role = 'authenticated'")
    cur.execute(f"SET request.jwt.claims = '{{\"sub\": \"{user_id}\", \"role\": \"authenticated\"}}'")
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
        cur.execute("SELECT COUNT(*) FROM suscripciones")
        sub_count = cur.fetchone()[0]
        if "parte_a" in ids and sub_count > 0:
            run_test(
                "Parte A sees own subscription",
                cur, ids["parte_a"],
                "SELECT COUNT(*) FROM suscripciones WHERE usuario_id = 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'",
                sub_count, "All subscriptions belong to Parte A",
            )
        if "non_member" in ids:
            run_test(
                "Non-member sees zero subscriptions",
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
