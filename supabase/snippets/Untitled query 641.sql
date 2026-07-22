--Tests B (Edge cases de RLS + integridad)

-- B1: ¿Un parte puede INSERTAR un item como parte de OTRO usuario?

-- Parte A intenta crear un item atribuyéndolo a Parte B
SET role = 'authenticated';
SET request.jwt.claims = '{"sub": "aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

INSERT INTO items (caso_id, parte_id, categoria, nombre, valor_min, valor_max, privado)
SELECT
  id, 'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'economico', 'Item robado', '0', '100', true
FROM casos WHERE nombre = 'Custodia de hijos menores';

RESET role;
RESET request.jwt.claims;

-- Resultado esperado: ERROR (RLS policy: parte_id = auth.uid())
-- Si acepta: es un BUG de seguridad (Parte A crea item como si fuera de Parte B)

----------------

-- B2: ¿Un parte puede ver la tabla de configuración?

SET role = 'authenticated';
SET request.jwt.claims = '{"sub": "aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

SELECT * FROM configuracion;

RESET role;
RESET request.jwt.claims;

-- Resultado esperado: 0 rows (RLS: solo admin lee configuracion)
-- Si devuelve filas: BUG (parte accede a config del sistema)

-------------------

-- B3: ¿Un parte puede ver la tabla de auditoría?

SET role = 'authenticated';
SET request.jwt.claims = '{"sub": "aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

SELECT * FROM auditoria LIMIT 5;

RESET role;
RESET request.jwt.claims;

-- Resultado esperado: 0 rows (RLS: solo admin lee auditoría)

--------------------

-- B4: ¿El trigger de auditoría registra correctamente?

-- Verificar que hay registros de auditoría para las acciones hechas
SELECT accion, entidad, COUNT(*) as total
FROM auditoria
GROUP BY accion, entidad
ORDER BY total DESC;

-- Resultado esperado: registros de INSERT/UPDATE en casos, items, etc.

---------------------

-- B5: ¿Un parte puede borrar un caso?

SET role = 'authenticated';
SET request.jwt.claims = '{"sub": "aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

-- Parte A intenta borrar el caso Custodia
DELETE FROM casos
WHERE nombre = 'Custodia de hijos menores';

RESET role;
RESET request.jwt.claims;

-- Resultado esperado: 0 rows deleted (no hay DELETE policy en casos)
-- Verificar que sigue existiendo:
SELECT nombre, estado FROM casos WHERE nombre = 'Custodia de hijos menores';

---------------------

-- B6: ¿El endpoint de inversores funciona para anon?

-- Simular usuario anónimo (no autenticado)
RESET role;
RESET request.jwt.claims;

-- Anon puede INSERTAR en inversores (formulario público)
INSERT INTO inversores (nombre, email, capital_disponible, experiencia)
VALUES ('Inversor Test', 'inversor@test.com', '100000', '5 anos');

-- Anon puede LEER inversores
SELECT COUNT(*) AS total_inversores FROM inversores;

-- Resultado esperado: INSERT exitoso, COUNT = 1