-- ============================================================
-- PASO 3: Items privados + test de aislamiento (RN-01)
-- ============================================================

-- Parte A carga sus items
INSERT INTO items (caso_id, parte_id, categoria, nombre, descripcion, valor_min, valor_max, puede_ceder, condiciones_cesion)
VALUES (
  (SELECT id FROM casos WHERE nombre = 'Custodia de hijos menores'),
  'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'cuidado_ninos',
  'Custodia compartida',
  'Quiero custodia de lunes a miercoles',
  'lunes a miercoles',
  'toda la semana',
  true,
  'Siempre que sea en mi domicilio'
);

-- Parte B carga sus items
INSERT INTO items (caso_id, parte_id, categoria, nombre, descripcion, valor_min, valor_max, puede_ceder)
VALUES (
  (SELECT id FROM casos WHERE nombre = 'Custodia de hijos menores'),
  'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'cuidado_ninos',
  'Custodia compartida',
  'Quiero custodia de jueves a domingo',
  'jueves a domingo',
  'toda la semana',
  false
);

-- Verificar: ambos items existen (como superuser veo todo)
SELECT i.nombre, i.categoria, i.valor_min, i.valor_max, i.puede_ceder,
       u.nombre || ' ' || u.apellido AS duenio
FROM items i
JOIN usuarios u ON u.id = i.parte_id;
