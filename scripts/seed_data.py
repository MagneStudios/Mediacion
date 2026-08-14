"""
seed_data.py — Genera datos de prueba con Faker para Proyecto Mediación.
Uso: python scripts/seed_data.py [--count N] [--reset]
Requiere: psycopg2-binary, faker
Conexión: lee DATABASE_URL o usa defaults de Supabase local.
"""

import argparse
import json
import os
import sys
import uuid
from datetime import timedelta

import psycopg2
from faker import Faker

fake = Faker("es_AR")
Faker.seed(42)

DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:57002/postgres",
)


def connect():
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    return conn


def clean_data(cur):
    """Truncate en orden inverso de dependencias."""
    tables = [
        "notificaciones",
        "incumplimientos",
        "tareas",
        "firmas",
        "acuerdos",
        "respuestas_propuesta",
        "propuestas",
        "mediaciones",
        "rondas",
        "items",
        "invitaciones",
        "caso_partes",
        "casos",
        "carpetas",
        "pagos",
        "suscripciones",
        "auditoria",
    ]
    for t in tables:
        cur.execute(f"TRUNCATE {t} CASCADE;")
    print(f"  Truncated {len(tables)} tables.")


def seed_usuarios(cur, count):
    """Crea usuarios en auth.users + trigger popula public.usuarios."""
    usuarios = []
    roles = ["parte"] * count + ["mediador", "estudio", "admin"]
    for i, rol in enumerate(roles):
        uid = str(uuid.uuid4())
        email = f"fake{i}_{fake.user_name()}@test.com"
        nombre = fake.first_name()
        apellido = fake.last_name()

        metadata = json.dumps({"nombre": nombre, "apellido": apellido, "rol": rol})
        cur.execute(
            """
            INSERT INTO auth.users (
                instance_id, id, aud, role, email, encrypted_password,
                email_confirmed_at, created_at, updated_at,
                raw_user_meta_data, raw_app_meta_data
            ) VALUES (
                '00000000-0000-0000-0000-000000000000',
                %s, 'authenticated', 'authenticated',
                %s, crypt('test123', gen_salt('bf')),
                now(), now(), now(),
                %s::jsonb, '{"provider": "email", "providers": ["email"]}'::jsonb
            )
            """,
            (uid, email, metadata),
        )
        usuarios.append({"id": uid, "email": email, "rol": rol, "nombre": nombre, "apellido": apellido})

    print(f"  Created {len(usuarios)} usuarios.")
    return usuarios


def seed_estudios(cur, usuarios):
    """Crea un estudio y vincula al usuario de rol estudio."""
    est_id = str(uuid.uuid4())
    plan_id_query = "SELECT id FROM planes LIMIT 1"
    cur.execute(plan_id_query)
    plan_row = cur.fetchone()
    plan_id = plan_row[0] if plan_row else None

    cur.execute(
        "INSERT INTO estudios (id, nombre, plan_id, activo) VALUES (%s, %s, %s, true)",
        (est_id, f"Estudio {fake.company()}", plan_id),
    )

    estudio_user = next((u for u in usuarios if u["rol"] == "estudio"), None)
    if estudio_user:
        cur.execute(
            "UPDATE usuarios SET estudio_id = %s WHERE id = %s",
            (est_id, estudio_user["id"]),
        )

    print(f"  Created estudio {est_id[:8]}...")
    return est_id


def seed_casos(cur, usuarios, count):
    """Crea casos con partes vinculadas."""
    parte_users = [u for u in usuarios if u["rol"] == "parte"]
    medio_user = next((u for u in usuarios if u["rol"] == "mediador"), None)
    estudio_user = next((u for u in usuarios if u["rol"] == "estudio"), None)
    caso_ids = []

    for i in range(count):
        caso_id = str(uuid.uuid4())
        creador = parte_users[i % len(parte_users)]
        metodo = fake.random_element(["negociacion", "conciliacion", "mediacion"])

        cur.execute(
            """
            INSERT INTO casos (id, creador_id, nombre, descripcion, metodo, estado)
            VALUES (%s, %s, %s, %s, %s, 'nuevo')
            """,
            (caso_id, creador["id"], f"Caso {fake.sentence(nb_words=3)}", fake.paragraph(), metodo),
        )
        caso_ids.append(caso_id)

        cur.execute(
            "INSERT INTO caso_partes (caso_id, usuario_id, rol_en_caso, estado_invitacion) VALUES (%s, %s, 'parte_a', 'aceptada')",
            (caso_id, creador["id"]),
        )

        other = parte_users[(i + 1) % len(parte_users)]
        if other["id"] != creador["id"]:
            cur.execute(
                "INSERT INTO caso_partes (caso_id, usuario_id, rol_en_caso, estado_invitacion) VALUES (%s, %s, 'parte_b', 'aceptada')",
                (caso_id, other["id"]),
            )

        if medio_user and fake.boolean(chance_of_getting_true=50):
            cur.execute(
                "INSERT INTO caso_partes (caso_id, usuario_id, rol_en_caso, estado_invitacion) VALUES (%s, %s, 'mediador', 'aceptada')",
                (caso_id, medio_user["id"]),
            )

    print(f"  Created {count} casos with vinculaciones.")
    return caso_ids


def seed_items(cur, caso_ids, usuarios):
    """Crea items para cada caso."""
    parte_users = [u for u in usuarios if u["rol"] == "parte"]
    categorias = ["cuidado_ninos", "cronogramas", "bienes", "economico", "personalizado"]
    count = 0

    for caso_id in caso_ids:
        for parte in parte_users[:2]:
            num_items = fake.random_int(min=1, max=3)
            for _ in range(num_items):
                cat = fake.random_element(categorias)
                cur.execute(
                    """
                    INSERT INTO items (caso_id, parte_id, categoria, nombre, valor_min, valor_max, puede_ceder, privado)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, true)
                    """,
                    (caso_id, parte["id"], cat, fake.word(), str(fake.random_int(0, 500)), str(fake.random_int(500, 1000)), fake.boolean()),
                )
                count += 1

    print(f"  Created {count} items.")


def seed_rondas_propuestas(cur, caso_ids):
    """Crea rondas y propuestas para algunos casos."""
    r_count = 0
    p_count = 0

    for caso_id in caso_ids:
        n_rondas = fake.random_int(min=1, max=3)
        for r in range(1, n_rondas + 1):
            ronda_id = str(uuid.uuid4())
            estado = "completada" if r < n_rondas else "activa"
            cur.execute(
                "INSERT INTO rondas (id, caso_id, numero, estado, fecha_fin) VALUES (%s, %s, %s, %s, %s)",
                (ronda_id, caso_id, r, estado, fake.date_time_this_year() if estado == "completada" else None),
            )
            r_count += 1

            if fake.boolean(chance_of_getting_true=60):
                prop_id = str(uuid.uuid4())
                cur.execute(
                    """
                    INSERT INTO propuestas (id, caso_id, ronda_id, contenido, fundamentacion, estado, modelo_ia)
                    VALUES (%s, %s, %s, %s, %s, %s, 'openai/gpt-4')
                    """,
                    (
                        prop_id,
                        caso_id,
                        ronda_id,
                        f'{{"item1": "{fake.word()}", "monto": {fake.random_int(100, 900)}}}',
                        fake.paragraph(),
                        fake.random_element(["pendiente", "aceptada", "rechazada"]),
                    ),
                )
                p_count += 1

    print(f"  Created {r_count} rondas, {p_count} propuestas.")


def main():
    parser = argparse.ArgumentParser(description="Seed test data into Supabase local DB")
    parser.add_argument("--count", type=int, default=5, help="Number of users to create")
    parser.add_argument("--reset", action="store_true", help="Clean existing data first")
    args = parser.parse_args()

    print(f"Connecting to {DB_URL.split('@')[1]}...")
    conn = connect()
    cur = conn.cursor()

    try:
        if args.reset:
            print("Cleaning existing data...")
            clean_data(cur)
            conn.commit()

        print(f"Seeding {args.count} usuarios...")
        usuarios = seed_usuarios(cur, args.count)
        conn.commit()

        print("Creating estudio...")
        seed_estudios(cur, usuarios)
        conn.commit()

        print("Creating casos...")
        caso_ids = seed_casos(cur, usuarios, count=min(args.count, 5))
        conn.commit()

        print("Creating items...")
        seed_items(cur, caso_ids, usuarios)
        conn.commit()

        print("Creating rondas and propuestas...")
        seed_rondas_propuestas(cur, caso_ids)
        conn.commit()

        print("\n=== Seed complete ===")

    except Exception as e:
        conn.rollback()
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
