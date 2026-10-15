// Datos de prueba para el modo local (.data/db.json). Uso: npm run seed
// Crea tres cuentas (si no existen):
//   admin@dealtura.ca  / dealtura-admin   → panel de admin en /en/admin
//   demo@dealtura.ca   / cafe-de-altura   → cliente aprobado, puede pedir
//   nuevo@dealtura.ca  / cafe-de-altura   → solicitud pendiente de aprobar
import { promises as fs } from 'node:fs';
import { randomBytes, scryptSync, randomUUID } from 'node:crypto';
import path from 'node:path';

const FILE = path.join(process.cwd(), '.data', 'db.json');

let db = { customers: [], orders: [], applications: [], credentials: [], orderSeq: 1000 };
try { db = { ...db, ...JSON.parse(await fs.readFile(FILE, 'utf8')) }; } catch {}

const hash = (pw) => {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(pw, salt, 64).toString('hex')}`;
};

const accounts = [
  {
    email: 'admin@dealtura.ca', password: 'dealtura-admin',
    customer: { contactName: 'Equipo DeAltura', businessName: 'DeAltura Coffee', businessType: 'other', status: 'approved', invoiceTermsDays: null, preferredLocale: 'es' },
  },
  {
    email: 'demo@dealtura.ca', password: 'cafe-de-altura',
    customer: {
      contactName: 'Demo Buyer', businessName: 'Café Demo', businessType: 'cafe', status: 'approved', invoiceTermsDays: 30, preferredLocale: 'en',
      addresses: [{ id: randomUUID(), label: 'Café Demo', line1: '123 Example Street', city: 'Toronto', province: 'ON', postalCode: 'M5V 1A1', isDefault: true }],
    },
  },
  {
    email: 'nuevo@dealtura.ca', password: 'cafe-de-altura',
    customer: { contactName: 'Marie Tremblay', businessName: 'Café du Plateau', businessType: 'cafe', status: 'pending', invoiceTermsDays: null, preferredLocale: 'fr' },
    application: { city: 'Montréal', province: 'QC', estimatedKgPerMonth: 25, message: 'Espresso pour deux succursales.' },
  },
];

for (const a of accounts) {
  if (db.credentials.some((c) => c.email === a.email)) {
    console.log(`Ya existe: ${a.email}`);
    continue;
  }
  const id = randomUUID();
  const now = new Date().toISOString();
  db.credentials.push({ userId: id, email: a.email, passwordHash: hash(a.password) });
  db.customers.push({
    id, email: a.email, phone: '', priceTier: 'standard', addresses: [], createdAt: now, ...a.customer,
  });
  if (a.application) {
    db.applications.push({
      id: randomUUID(), email: a.email, contactName: a.customer.contactName, businessName: a.customer.businessName,
      businessType: a.customer.businessType, locale: a.customer.preferredLocale, createdAt: now, ...a.application,
    });
  }
  console.log(`Creada: ${a.email} / ${a.password}`);
}

await fs.mkdir(path.dirname(FILE), { recursive: true });
await fs.writeFile(FILE, JSON.stringify(db, null, 2));
