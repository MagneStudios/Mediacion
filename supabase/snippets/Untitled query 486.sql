-- ============================================================
-- PASO 2: Crear caso y vincular ambas partes
-- ============================================================

-- Crear caso (lo crea Parte A)
INSERT INTO casos (creador_id, nombre, descripcion, metodo, estado)
VALUES (
  'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Custodia de hijos menores',
  'Acuerdo de custodia compartida',
  'mediacion',
  'nuevo'
);

-- Vincular Parte A (creador)
INSERT INTO caso_partes (caso_id, usuario_id, rol_en_caso, estado_invitacion, fecha_union)
VALUES (
  (SELECT id FROM casos WHERE nombre = 'Custodia de hijos menores'),
  'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'parte_a',
  'aceptada',
  now()
);

-- Vincular Parte B (contraparte)
INSERT INTO caso_partes (caso_id, usuario_id, rol_en_caso, estado_invitacion, fecha_union)
VALUES (
  (SELECT id FROM casos WHERE nombre = 'Custodia de hijos menores'),
  'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'parte_b',
  'aceptada',
  now()
);

-- Verificar
SELECT c.nombre, c.metodo, c.estado, c.ronda_actual,
       cp.rol_en_caso, u.nombre || ' ' || u.apellido AS parte
FROM casos c
JOIN caso_partes cp ON cp.caso_id = c.id
JOIN usuarios u ON u.id = cp.usuario_id;
