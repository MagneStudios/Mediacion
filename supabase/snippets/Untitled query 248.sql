-- ============================================================
-- PASO 4: Test RLS — Parte A solo ve sus items, NUNCA los de Parte B
-- Simular JWT de Parte A con SET request.jwt.claims
-- ============================================================

-- Simular que soy Parte A (autenticado)
SET role = 'authenticated';
SET request.jwt.claims = '{"sub": "aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

-- Parte A consulta items del caso
SELECT 'Parte A ve:' AS info;
SELECT i.nombre, i.valor_min, i.valor_max, u.nombre || ' ' || u.apellido AS duenio
FROM items i
JOIN usuarios u ON u.id = i.parte_id
WHERE i.caso_id = (SELECT id FROM casos WHERE nombre = 'Custodia de hijos menores');

-- Resetear rol
RESET role;
RESET request.jwt.claims;
