-- DeAltura Coffee — permisos explícitos
-- Supabase ya no siempre da acceso automático a las tablas nuevas desde su API.
-- Esto deja claro quién puede hacer qué. Se puede correr más de una vez.

-- El servidor de la web (llave secreta / service_role) lee y escribe todo.
grant usage on schema public to service_role, authenticated, anon;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Un cliente con sesión (la futura app) solo puede LEER lo suyo; RLS filtra las filas.
grant select on customers, orders, order_lines to authenticated;
grant select, insert, update, delete on addresses to authenticated;

-- Visitantes sin sesión: nada.
revoke all on all tables in schema public from anon;
