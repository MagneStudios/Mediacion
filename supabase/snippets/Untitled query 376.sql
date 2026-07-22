-- TEST E: Tests Finales

-- E1: ¿El caso tiene estado coherente después de todo?

-- Verificar que no hay casos con estados imposibles
SELECT nombre, estado, ronda_actual
FROM casos
WHERE estado NOT IN ('nuevo', 'activo', 'en_negociacion', 'acordado', 'cerrado', 'terminado', 'vencido');
-- Esperado: 0 rows

------------------

-- E2: ¿Las firmas tienen coherencia con los acuerdos?

-- Verificar que toda firma apunta a un acuerdo que existe
SELECT f.id, f.acuerdo_id, a.estado AS acuerdo_estado
FROM firmas f
LEFT JOIN acuerdos a ON a.id = f.acuerdo_id
WHERE a.id IS NULL;
-- Esperado: 0 rows (no hay firmas huérfanas)

-------------------

-- E3: ¿Las tareas tienen coherencia con acuerdos y casos?

-- Verificar que toda tarea apunta a un acuerdo Y caso que existen
SELECT t.id, t.acuerdo_id, t.caso_id
FROM tareas t
LEFT JOIN acuerdos a ON a.id = t.acuerdo_id
LEFT JOIN casos c ON c.id = t.caso_id
WHERE a.id IS NULL OR c.id IS NULL;
-- Esperado: 0 rows

--------------------

-- E4: Resumen final del estado de la BD

-- Estado completo de la base de datos
SELECT 'Usuarios' AS entidad, COUNT(*) AS total FROM usuarios
UNION ALL SELECT 'Estudios', COUNT(*) FROM estudios
UNION ALL SELECT 'Casos', COUNT(*) FROM casos
UNION ALL SELECT 'CasoPartes', COUNT(*) FROM caso_partes
UNION ALL SELECT 'Items', COUNT(*) FROM items
UNION ALL SELECT 'Rondas', COUNT(*) FROM rondas
UNION ALL SELECT 'Propuestas', COUNT(*) FROM propuestas
UNION ALL SELECT 'Respuestas', COUNT(*) FROM respuestas_propuesta
UNION ALL SELECT 'Mediaciones', COUNT(*) FROM mediaciones
UNION ALL SELECT 'Acuerdos', COUNT(*) FROM acuerdos
UNION ALL SELECT 'Firmas', COUNT(*) FROM firmas
UNION ALL SELECT 'Tareas', COUNT(*) FROM tareas
UNION ALL SELECT 'Notificaciones', COUNT(*) FROM notificaciones
UNION ALL SELECT 'Auditoria', COUNT(*) FROM auditoria
UNION ALL SELECT 'Suscripciones', COUNT(*) FROM suscripciones
UNION ALL SELECT 'Planes', COUNT(*) FROM planes
UNION ALL SELECT 'Inversores', COUNT(*) FROM inversores
UNION ALL SELECT 'Configuracion', COUNT(*) FROM configuracion
ORDER BY entidad;