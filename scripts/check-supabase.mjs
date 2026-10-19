// Revisa que Supabase esté bien conectado. Uso:  npm run check:supabase
// Lee las llaves de .env.local; no imprime ninguna llave.
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ok = (m) => console.log(`  ✔ ${m}`);
const bad = (m) => { console.log(`  ✘ ${m}`); process.exitCode = 1; };

console.log('\nDeAltura · revisión de Supabase\n');
if (process.env.DATA_BACKEND !== 'supabase') bad('DATA_BACKEND no es "supabase" en .env.local'); else ok('DATA_BACKEND=supabase');
if (!url?.startsWith('https://')) bad('Falta NEXT_PUBLIC_SUPABASE_URL (https://xxxx.supabase.co)'); else ok('URL del proyecto');
if (!anon) bad('Falta NEXT_PUBLIC_SUPABASE_ANON_KEY (la llave publishable / anon)'); else ok('Llave pública');
if (!secret) bad('Falta SUPABASE_SERVICE_ROLE_KEY (la llave secret / service_role)'); else ok('Llave secreta');
if (secret && anon && secret === anon) bad('La llave secreta es igual a la pública: copiaste la misma dos veces');
if (process.exitCode) process.exit();

const admin = createClient(url, secret, { auth: { persistSession: false } });
for (const table of ['customers', 'addresses', 'orders', 'order_lines', 'wholesale_applications']) {
  const { error, count } = await admin.from(table).select('*', { count: 'exact', head: true });
  if (error) bad(`${table}: ${error.message}${/does not exist|schema cache/i.test(error.message) ? '  → corre supabase/migrations/0001_init.sql' : /permission/i.test(error.message) ? '  → corre supabase/migrations/0002_grants.sql' : ''}`);
  else ok(`${table} (${count ?? 0} filas)`);
}

const pub = createClient(url, anon, { auth: { persistSession: false } });
const { data: leak } = await pub.from('customers').select('id').limit(1);
if (leak && leak.length) bad('¡Un visitante sin sesión puede leer clientes! Revisa RLS'); else ok('Visitantes sin sesión no ven datos de clientes');

const admins = (process.env.ADMIN_EMAILS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
if (!admins.length) bad('ADMIN_EMAILS vacío: nadie podrá entrar a /admin'); else ok(`Admins: ${admins.join(', ')}`);

console.log(process.exitCode ? '\nHay cosas que arreglar (✘).\n' : '\nTodo listo. Corre npm run dev y prueba /es/wholesale.\n');
