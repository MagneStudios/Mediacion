--test_09b_summary
SELECT relname AS tabla, n_live_tup AS filas
FROM pg_stat_user_tables
WHERE schemaname = 'public' AND n_live_tup > 0
ORDER BY relname;
