// Datos de prueba para el modo local (.data/db.json). Uso: npm run seed
// Crea tres cuentas (si no existen):
//   admin@dealtura.ca  / dealtura-admin   → panel de admin en /en/admin
//   demo@dealtura.ca   / cafe-de-altura   → cliente aprobado, puede pedir
//   nuevo@dealtura.ca  / cafe-de-altura   → solicitud pendiente de aprobar
import { promises as fs } from 'node:fs';
import { randomBytes, scryptSync, randomUUID } from 'node:crypto';
import path from 'node:path';

const FILE = path.join(process.cwd(), '.data', 'db.json');

let db = { customers: [], orders: [], applications: [], credentials: [], orderSeq: 1000, prices: [], lots: [], batches: [], expenses: [] };
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

// --orders: datos de demo para el panel (clientes en varias ciudades, pedidos del año,
// compras de café verde con sus gastos, tuestes y gastos operativos). Solo si no hay pedidos.
if (!db.orders.length && process.argv.includes('--orders')) {
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const now = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const daysAgo = (n) => new Date(now.getTime() - n * 864e5);

  const extra = [
    ['Café Saint-Henri', 'Julie Gagnon', 'Montréal', 'QC', 'H4C 2S4', 'partner'],
    ['Pour Over Ottawa', 'Daniel Park', 'Ottawa', 'ON', 'K1N 5T4', 'standard'],
    ['Granville Espresso', 'Priya Shah', 'Vancouver', 'BC', 'V6Z 1L2', 'standard'],
    ['Bodega Latina', 'Carlos Méndez', 'Toronto', 'ON', 'M6J 1H3', 'partner'],
  ];
  for (const [biz, contact, city, prov, postal, tier] of extra) {
    const id = randomUUID();
    const email = `${biz.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '')}@demo.ca`;
    db.credentials.push({ userId: id, email, passwordHash: hash('cafe-de-altura') });
    db.customers.push({
      id, email, phone: '', contactName: contact, businessName: biz, businessType: 'cafe', status: 'approved', priceTier: tier,
      invoiceTermsDays: 30, preferredLocale: prov === 'QC' ? 'fr' : 'en', hasLogin: true, createdAt: daysAgo(200).toISOString(),
      addresses: [{ id: randomUUID(), label: biz, line1: '1 Demo Street', city, province: prov, postalCode: postal, isDefault: true }],
    });
  }
  const buyers = db.customers.filter((c) => c.status === 'approved' && c.email !== 'admin@dealtura.ca');

  const cat = JSON.parse(await fs.readFile(path.join(process.cwd(), 'content', 'products.json'), 'utf8')).filter((p) => p.active);
  const roasts = ['light', 'medium', 'medium', 'dark', 'dark'];
  let seq = db.orderSeq;
  for (let i = 0; i < 80; i++) {
    const ago = Math.floor(285 * Math.random() * Math.random());
    const created = new Date(daysAgo(ago).getTime() - Math.random() * 6e7);
    const buyer = pick(buyers);
    const tier = buyer.priceTier ?? 'standard';
    const lines = [];
    for (let j = 0; j < 1 + Math.floor(Math.random() * 2); j++) {
      const p = pick(cat);
      const f = pick(p.formats);
      lines.push({ sku: f.sku, productId: p.id, productName: p.name.es, formatLabel: f.label.es, roast: pick(roasts), quantity: 2 + Math.floor(Math.random() * 5), unitPriceCents: f.price[tier], grams: f.grams });
    }
    const subtotal = lines.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0);
    const kg = lines.reduce((s, l) => s + (l.grams * l.quantity) / 1000, 0);
    const shipping = kg >= 20 ? 0 : 2500;
    const a = buyer.addresses[0] ?? { label: buyer.businessName, line1: '123 Example Street', city: 'Toronto', province: 'ON', postalCode: 'M5V 1A1' };
    seq += 1;
    db.orders.push({
      id: randomUUID(), number: `DA-${seq}`, customerId: buyer.id,
      status: ago < 4 ? pick(['paid', 'invoiced', 'roasting', 'awaiting_payment', 'shipped']) : ago < 9 ? pick(['shipped', 'delivered']) : 'delivered',
      paymentMethod: Math.random() < 0.5 ? 'invoice' : 'card', lines,
      subtotalCents: subtotal, shippingCents: shipping, taxCents: 0, totalCents: subtotal + shipping,
      shippingAddress: { label: a.label, line1: a.line1, city: a.city, province: a.province, postalCode: a.postalCode },
      createdAt: created.toISOString(), updatedAt: created.toISOString(),
    });
  }
  db.orderSeq = seq;

  // Compras de café verde: una recibida a inicio de año, otra en camino
  const year = now.getFullYear();
  const lot1 = randomUUID();
  db.lots = [
    {
      id: lot1, productId: 'prd_ven_scm', code: `VEN-${year}-01`, supplier: 'Aprocandes', origin: 'Santa Cruz de Mora, Mérida', purchasedAt: `${year}-01-10`, status: 'received',
      quantity: 4400, inputUnit: 'lb', pricePerUnitCents: 380, currency: 'USD', fxToCad: 1.37, notes: 'Lote 0002 · Finca La Curva · 84 pts SCA',
      costs: [
        { id: randomUUID(), category: 'freight', label: 'Contenedor Puerto Cabello → Montreal', amountCents: 240000, currency: 'USD' },
        { id: randomUUID(), category: 'insurance', label: 'Seguro de carga', amountCents: 18000, currency: 'USD' },
        { id: randomUUID(), category: 'customs', label: 'Aranceles e inspección CFIA', amountCents: 65000, currency: 'CAD' },
        { id: randomUUID(), category: 'broker', label: 'Agente aduanal', amountCents: 35000, currency: 'CAD' },
      ],
      createdAt: `${year}-01-10T15:00:00.000Z`,
    },
    {
      id: randomUUID(), productId: 'prd_ven_scm', code: `VEN-${year}-02`, supplier: 'Aprocandes', origin: 'Santa Cruz de Mora, Mérida', purchasedAt: iso(daysAgo(25)), status: 'in_transit',
      quantity: 2200, inputUnit: 'lb', pricePerUnitCents: 395, currency: 'USD', fxToCad: 1.38,
      costs: [{ id: randomUUID(), category: 'freight', label: 'Contenedor (anticipo)', amountCents: 200000, currency: 'USD' }],
      createdAt: daysAgo(25).toISOString(),
    },
  ];

  // Tuestes cada dos semanas desde febrero, ~15 % de merma
  db.batches = [];
  for (let d = new Date(`${year}-02-03T12:00:00Z`); d < now; d = new Date(d.getTime() + 14 * 864e5)) {
    for (const [roast, green] of [['light', 17], ['medium', 34], ['dark', 38]]) {
      const g = Math.round(green * rnd(0.85, 1.2) * 10) / 10;
      db.batches.push({
        id: randomUUID(), lotId: lot1, roastedAt: iso(d), roast, greenKg: g, roastedKg: Math.round(g * rnd(0.83, 0.87) * 10) / 10,
        roasterRateCents: 250, roasterBasis: 'green', packagingCents: Math.round(g * 120), createdAt: d.toISOString(),
      });
    }
  }

  // Gastos operativos de cada mes, con fecha (varios de transporte por mes)
  db.expenses = [];
  for (let m = 0; m <= now.getMonth(); m++) {
    const month = `${year}-${String(m + 1).padStart(2, '0')}`;
    const last = m === now.getMonth() ? now.getDate() : new Date(year, m + 1, 0).getDate();
    const add = (day, tag, description, dollars) => {
      if (day > last) return;
      db.expenses.push({ id: randomUUID(), month, date: `${month}-${String(day).padStart(2, '0')}`, tag, description, amountCents: Math.round(dollars * 100), createdAt: new Date().toISOString() });
    };
    add(1, 'Renta', 'Espacio en bodega compartida', 150);
    add(3, 'Software', 'Hosting y correo', 45);
    for (const day of [6, 13, 20, 27]) add(day, 'Transporte', pick(['Canpar · envíos Ontario', 'Purolator · Montréal', 'UPS · Vancouver', 'Mensajería local Toronto']), Math.round(rnd(45, 140)));
    add(10, 'Servicios', 'Teléfono e internet', Math.round(rnd(55, 85)));
    if (m % 2 === 0) add(15, 'Marketing', pick(['Muestras para cafeterías', 'Degustación en tienda', 'Anuncios Instagram']), Math.round(rnd(60, 220)));
    if (m % 3 === 1) add(18, 'Insumos', 'Etiquetas y válvulas extra', Math.round(rnd(40, 120)));
  }
  console.log(`${db.orders.length} pedidos, ${db.lots.length} compras, ${db.batches.length} tuestes y ${db.expenses.length} gastos de ejemplo creados`);
}

await fs.mkdir(path.dirname(FILE), { recursive: true });
await fs.writeFile(FILE, JSON.stringify(db, null, 2));
