import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { NewBatchForm } from '@/components/admin-finance';
import { repo } from '@/lib/db';
import { buildInventory } from '@/lib/finance';
import type { Locale } from '@/lib/types';

/** Registrar un tueste: sale café verde de un lote, entra café tostado al inventario. */
export default async function NewBatchPage({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<{ lot?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { lot } = await searchParams;
  const [t, lots, batches] = await Promise.all([getTranslations(), repo.lots.list(), repo.batches.list()]);
  const inv = buildInventory(lots, batches, []);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date());
  return (
    <div className="admin-page narrow stack-lg">
      <p><Link href="/admin/inventory" className="link">← {t('admin.nav.inventory')}</Link></p>
      <header className="stack">
        <h1 className="h-section">{t('admin.fin.batch.new')}</h1>
        <p className="hint">{t('admin.fin.batch.lead')}</p>
      </header>
      <NewBatchForm
        today={today}
        defaultLot={lot}
        lots={inv.lots.map((s) => ({ id: s.lot.id, label: s.lot.code, remainingKg: s.remainingKg, perKgCents: Math.round(s.totals.perKgCad) }))}
      />
    </div>
  );
}
