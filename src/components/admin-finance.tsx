'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  adminAddLotCost, adminCreateBatch, adminCreateExpense, adminCreateLot, adminDeleteBatch, adminDeleteExpense,
  adminRemoveLotCost, adminUpdateLot,
} from '@/app/[locale]/admin/finance-actions';
import type { AdminFormState } from '@/app/[locale]/admin/actions';
import type { LotStatus, MassUnit } from '@/lib/types';

const KG_PER_LB = 0.45359237;
const parse = (v: string) => {
  let s = v.trim().replace(/\s/g, '');
  if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = Number(s);
  return s === '' || !Number.isFinite(n) ? NaN : n;
};
const toKg = (q: number, u: MassUnit) => (u === 'lb' ? q * KG_PER_LB : q);

function useFmt() {
  const locale = useLocale();
  const tag = locale === 'en' ? 'en-CA' : locale === 'fr' ? 'fr-CA' : 'es-MX';
  return {
    n: (v: number, d = 2) => new Intl.NumberFormat(tag, { maximumFractionDigits: d }).format(v),
    money: (cents: number) => new Intl.NumberFormat(tag, { style: 'currency', currency: 'CAD' }).format(cents / 100),
  };
}

/* ---------------- Conversor lb ⇄ kg (siempre a la mano en el panel) ---------------- */

export function UnitConverter() {
  const t = useTranslations('admin.converter');
  const { n } = useFmt();
  const [kg, setKg] = useState('1');
  const [lb, setLb] = useState(n(2.20462262, 3));
  return (
    <div className="converter" role="group" aria-label={t('title')}>
      <p className="converter__title">{t('title')}</p>
      <label>
        <input
          className="input" inputMode="decimal" value={lb} aria-label="lb"
          onChange={(e) => { setLb(e.target.value); const v = parse(e.target.value); setKg(Number.isNaN(v) ? '' : n(v * KG_PER_LB, 3)); }}
        />
        <span>lb</span>
      </label>
      <span className="converter__eq" aria-hidden="true">⇅</span>
      <label>
        <input
          className="input" inputMode="decimal" value={kg} aria-label="kg"
          onChange={(e) => { setKg(e.target.value); const v = parse(e.target.value); setLb(Number.isNaN(v) ? '' : n(v / KG_PER_LB, 3)); }}
        />
        <span>kg</span>
      </label>
    </div>
  );
}

/** Cantidad + unidad, con la equivalencia en la otra unidad debajo. */
function QtyField({ name, unitName, label, defaultUnit = 'lb', invalid, onKg, onUnit }: {
  name: string; unitName: string; label: string; defaultUnit?: MassUnit; invalid?: boolean;
  onKg?: (kg: number) => void; onUnit?: (u: MassUnit) => void;
}) {
  const { n } = useFmt();
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState<MassUnit>(defaultUnit);
  const v = parse(qty);
  const kg = Number.isNaN(v) ? NaN : toKg(v, unit);
  useEffect(() => { onKg?.(kg); }, [kg, onKg]);
  useEffect(() => { onUnit?.(unit); }, [unit, onUnit]);
  return (
    <label className="field">
      <span>{label}</span>
      <div className="qty-unit">
        <input className="input" name={name} inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} aria-invalid={invalid || undefined} required />
        <select className="input" name={unitName} value={unit} onChange={(e) => setUnit(e.target.value as MassUnit)} aria-label={label}>
          <option value="lb">lb</option>
          <option value="kg">kg</option>
        </select>
      </div>
      <small className="hint nums">{Number.isNaN(kg) ? ' ' : unit === 'lb' ? `= ${n(kg, 2)} kg` : `= ${n(kg / KG_PER_LB, 2)} lb`}</small>
    </label>
  );
}

function Err({ state }: { state: AdminFormState }) {
  const t = useTranslations('admin.fin.errors');
  if (!state.error) return null;
  const key = state.error === 'roastedMore' || state.error === 'invalid' ? state.error : 'unknown';
  return <p className="error" role="alert">{t(key)}</p>;
}

const bad = (state: AdminFormState, f: string) => (state.fields?.includes(f) ? true : undefined);

/* ---------------- Nueva compra de café verde ---------------- */

export function NewLotForm({ today, defaultCode }: { today: string; defaultCode: string }) {
  const t = useTranslations('admin.fin');
  const { n, money } = useFmt();
  const [state, action, pending] = useActionState<AdminFormState, FormData>(adminCreateLot, {});
  const [kg, setKg] = useState(NaN);
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'CAD'>('USD');
  const [fx, setFx] = useState('1.37');
  const [unit, setUnit] = useState<MassUnit>('lb');

  if (state.ok && state.id) {
    return (
      <div className="notice notice--strong stack" role="status">
        <strong>{t('lot.created')}</strong>
        <p>{t('lot.createdNext')}</p>
        <p><Link className="btn btn--cream" href={`/admin/inventory/lots/${state.id}`}>{t('lot.open')}</Link></p>
      </div>
    );
  }

  // Estimado en vivo del costo del café (sin gastos de importación)
  const p = parse(price);
  const qtyInUnit = Number.isNaN(kg) ? NaN : unit === 'lb' ? kg / KG_PER_LB : kg;
  const coffeeCad = qtyInUnit * p * 100 * (currency === 'USD' ? parse(fx) : 1);

  return (
    <form action={action} className="stack" noValidate>
      <div className="two">
        <label className="field"><span>{t('lot.code')}</span><input className="input" name="code" defaultValue={defaultCode} aria-invalid={bad(state, 'code')} required /></label>
        <label className="field"><span>{t('lot.date')}</span><input className="input" type="date" name="purchasedAt" defaultValue={today} required /></label>
      </div>
      <div className="two">
        <label className="field"><span>{t('lot.supplier')}</span><input className="input" name="supplier" placeholder="Aprocandes" aria-invalid={bad(state, 'supplier')} required /></label>
        <label className="field"><span>{t('lot.origin')}</span><input className="input" name="origin" defaultValue="Santa Cruz de Mora, Mérida" /></label>
      </div>
      <div className="two">
        <QtyField name="quantity" unitName="inputUnit" label={t('lot.quantity')} onKg={setKg} onUnit={setUnit} invalid={bad(state, 'quantity')} />
        <label className="field">
          <span>{t('lot.status')}</span>
          <select className="input" name="status" defaultValue="ordered">
            {(['ordered', 'in_transit', 'received'] as LotStatus[]).map((s) => <option key={s} value={s}>{t(`lotStatus.${s}`)}</option>)}
          </select>
        </label>
      </div>
      <div className="three">
        <label className="field">
          <span>{t('lot.price')}</span>
          <input className="input" name="pricePerUnit" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} aria-invalid={bad(state, 'pricePerUnit')} required />
          <small className="hint">{t('lot.priceHint', { unit })}</small>
        </label>
        <label className="field">
          <span>{t('lot.currency')}</span>
          <select className="input" name="currency" value={currency} onChange={(e) => setCurrency(e.target.value as 'USD' | 'CAD')}>
            <option value="USD">USD</option><option value="CAD">CAD</option>
          </select>
        </label>
        <label className="field">
          <span>{t('lot.fx')}</span>
          <input className="input" name="fxToCad" inputMode="decimal" value={currency === 'CAD' ? '1' : fx} onChange={(e) => setFx(e.target.value)} disabled={currency === 'CAD'} aria-invalid={bad(state, 'fxToCad')} />
          {currency === 'CAD' && <input type="hidden" name="fxToCad" value="1" />}
          <small className="hint">{t('lot.fxHint')}</small>
        </label>
      </div>
      <label className="field"><span>{t('notes')}</span><textarea className="input" name="notes" rows={2} /></label>
      <p className="estimate nums" aria-live="polite">
        {Number.isFinite(coffeeCad) && coffeeCad > 0
          ? t('lot.estimate', { kg: n(kg, 1), total: money(coffeeCad), perKg: money(coffeeCad / kg) })
          : t('lot.estimateEmpty')}
      </p>
      <Err state={state} />
      <div><button className="btn" disabled={pending}>{t('lot.create')}</button></div>
    </form>
  );
}

/* ---------------- Ficha de la compra: estado y tipo de cambio (texto → Editar → Guardar) ---------------- */

export function LotEdit({ id, status, fxToCad, currency }: { id: string; status: LotStatus; fxToCad: number; currency: string }) {
  const t = useTranslations('admin');
  const { n } = useFmt();
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  if (!editing) {
    return (
      <div className="lot-edit">
        <span className={`pill pill--lot-${status}`}>{t(`fin.lotStatus.${status}`)}</span>
        {currency === 'USD' && <span className="hint nums">1 USD = {n(fxToCad, 4)} CAD</span>}
        <button type="button" className="btn btn--sm btn--ghost" onClick={(e) => { e.preventDefault(); setEditing(true); }}>{t('edit')}</button>
      </div>
    );
  }
  return (
    <form
      className="lot-edit"
      action={(fd) => start(async () => { await adminUpdateLot(fd); setEditing(false); })}
    >
      <input type="hidden" name="id" value={id} />
      <select className="input input--sm" name="status" defaultValue={status} aria-label={t('fin.lot.status')}>
        {(['ordered', 'in_transit', 'received'] as LotStatus[]).map((s) => <option key={s} value={s}>{t(`fin.lotStatus.${s}`)}</option>)}
      </select>
      {currency === 'USD' ? (
        <label className="lot-edit__fx"><span className="hint">1 USD =</span><input className="input input--sm" name="fxToCad" defaultValue={String(fxToCad)} inputMode="decimal" /><span className="hint">CAD</span></label>
      ) : <input type="hidden" name="fxToCad" value="1" />}
      <button key="save" type="submit" className="btn btn--sm" disabled={pending}>{pending ? t('saving') : t('save')}</button>
      <button key="cancel" type="button" className="link" onClick={(e) => { e.preventDefault(); setEditing(false); }}>{t('cancel')}</button>
    </form>
  );
}

/* ---------------- Agregar gasto a la compra ---------------- */

const COST_CATS = ['freight', 'customs', 'broker', 'insurance', 'storage', 'other'] as const;

export function AddCostForm({ lotId, currency }: { lotId: string; currency: 'USD' | 'CAD' }) {
  const t = useTranslations('admin.fin');
  const [state, action, pending] = useActionState<AdminFormState, FormData>(adminAddLotCost, {});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) formRef.current?.reset(); }, [state]);
  return (
    <form ref={formRef} action={action} className="cost-form" noValidate>
      <input type="hidden" name="lotId" value={lotId} />
      <label className="field">
        <span>{t('cost.category')}</span>
        <select className="input" name="category" defaultValue="freight">
          {COST_CATS.map((c) => <option key={c} value={c}>{t(`costCat.${c}`)}</option>)}
        </select>
      </label>
      <label className="field"><span>{t('cost.label')}</span><input className="input" name="label" placeholder={t('cost.labelPh')} /></label>
      <label className="field"><span>{t('cost.amount')}</span><input className="input" name="amount" inputMode="decimal" aria-invalid={bad(state, 'amount')} required /></label>
      <label className="field">
        <span>{t('lot.currency')}</span>
        <select className="input" name="currency" defaultValue={currency === 'USD' ? 'USD' : 'CAD'}>
          <option value="CAD">CAD</option><option value="USD">USD</option>
        </select>
      </label>
      <div className="cost-form__go"><button className="btn" disabled={pending}>+ {t('cost.add')}</button></div>
      <Err state={state} />
    </form>
  );
}

/** Botón de borrar con confirmación (para gastos, tuestes y costos). */
export function DeleteButton({ kind, id, lotId, label }: { kind: 'cost' | 'batch' | 'expense'; id: string; lotId?: string; label: string }) {
  const t = useTranslations('admin.fin');
  const [pending, start] = useTransition();
  const run = (fd: FormData) => start(async () => {
    if (kind === 'cost') await adminRemoveLotCost(fd);
    else if (kind === 'batch') await adminDeleteBatch(fd);
    else await adminDeleteExpense(fd);
  });
  return (
    <form action={run} onSubmit={(e) => { if (!window.confirm(t('confirmDelete'))) e.preventDefault(); }}>
      <input type="hidden" name={kind === 'cost' ? 'costId' : 'id'} value={id} />
      {lotId && <input type="hidden" name="lotId" value={lotId} />}
      <button className="link link--danger" disabled={pending} aria-label={`${label}`}>{t('delete')}</button>
    </form>
  );
}

/* ---------------- Registrar un tueste ---------------- */

export interface LotOption { id: string; label: string; remainingKg: number; perKgCents: number }

export function NewBatchForm({ lots, today, defaultLot }: { lots: LotOption[]; today: string; defaultLot?: string }) {
  const t = useTranslations('admin.fin');
  const tr = useTranslations('formats');
  const { n, money } = useFmt();
  const [state, action, pending] = useActionState<AdminFormState, FormData>(adminCreateBatch, {});
  const [lotId, setLotId] = useState(defaultLot ?? lots[0]?.id ?? '');
  const [greenKg, setGreenKg] = useState(NaN);
  const [roastedKg, setRoastedKg] = useState(NaN);
  const [rate, setRate] = useState('');
  const [rateUnit, setRateUnit] = useState<MassUnit>('kg');
  const [basis, setBasis] = useState<'green' | 'roasted'>('green');
  const [pack, setPack] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const [formKey, setFormKey] = useState(0);
  useEffect(() => { if (state.ok) { formRef.current?.reset(); setFormKey((k) => k + 1); } }, [state]);

  const lot = lots.find((l) => l.id === lotId);
  const ratePerKg = (Number.isNaN(parse(rate)) ? 0 : parse(rate)) * (rateUnit === 'lb' ? 1 / KG_PER_LB : 1);
  const greenCost = lot && Number.isFinite(greenKg) ? greenKg * lot.perKgCents : NaN;
  const roasterCost = ratePerKg * 100 * (basis === 'green' ? greenKg : roastedKg);
  const total = greenCost + roasterCost + (Number.isNaN(parse(pack)) ? 0 : parse(pack) * 100);
  const ok = Number.isFinite(total) && roastedKg > 0 && greenKg > 0;

  if (!lots.length) return <p className="notice">{t('batch.noLots')} <Link className="link" href="/admin/inventory/lots/new">{t('lot.new')}</Link></p>;

  return (
    <form ref={formRef} action={action} className="stack" noValidate key={formKey}>
      {state.ok && <p className="notice" role="status">{t('batch.created')}</p>}
      <div className="two">
        <label className="field">
          <span>{t('batch.lot')}</span>
          <select className="input" name="lotId" value={lotId} onChange={(e) => setLotId(e.target.value)}>
            {lots.map((l) => <option key={l.id} value={l.id}>{l.label} · {n(l.remainingKg, 1)} kg</option>)}
          </select>
          {lot && <small className="hint nums">{t('batch.lotCost', { cost: money(lot.perKgCents) })}</small>}
        </label>
        <label className="field"><span>{t('batch.date')}</span><input className="input" type="date" name="roastedAt" defaultValue={today} required /></label>
      </div>
      <fieldset className="field roast-choice">
        <legend><span>{t('batch.roast')}</span></legend>
        <div className="choice">
          {(['light', 'medium', 'dark'] as const).map((r) => (
            <label key={r}><input type="radio" name="roast" value={r} defaultChecked={r === 'medium'} /><span>{tr(r)}</span></label>
          ))}
        </div>
      </fieldset>
      <div className="two">
        <QtyField name="greenQty" unitName="greenUnit" label={t('batch.green')} defaultUnit="kg" onKg={setGreenKg} invalid={bad(state, 'greenQty')} />
        <QtyField name="roastedQty" unitName="roastedUnit" label={t('batch.roasted')} defaultUnit="kg" onKg={setRoastedKg} invalid={bad(state, 'roastedQty')} />
      </div>
      <div className="three">
        <label className="field">
          <span>{t('batch.rate')}</span>
          <div className="qty-unit">
            <input className="input" name="roasterRate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
            <select className="input" name="roasterRateUnit" value={rateUnit} onChange={(e) => setRateUnit(e.target.value as MassUnit)} aria-label={t('batch.rate')}>
              <option value="kg">/ kg</option><option value="lb">/ lb</option>
            </select>
          </div>
          <small className="hint">CAD</small>
        </label>
        <label className="field">
          <span>{t('batch.basis')}</span>
          <select className="input" name="roasterBasis" value={basis} onChange={(e) => setBasis(e.target.value as 'green' | 'roasted')}>
            <option value="green">{t('batch.basisGreen')}</option><option value="roasted">{t('batch.basisRoasted')}</option>
          </select>
        </label>
        <label className="field">
          <span>{t('batch.packaging')}</span>
          <input className="input" name="packaging" inputMode="decimal" value={pack} onChange={(e) => setPack(e.target.value)} placeholder="0" />
          <small className="hint">{t('batch.packagingHint')}</small>
        </label>
      </div>
      <label className="field"><span>{t('notes')}</span><textarea className="input" name="notes" rows={2} /></label>
      <p className="estimate nums" aria-live="polite">
        {ok
          ? t('batch.estimate', {
              shrink: n((1 - roastedKg / greenKg) * 100, 1),
              total: money(total),
              perKg: money(total / roastedKg),
              perLb: money((total / roastedKg) * KG_PER_LB),
            })
          : t('batch.estimateEmpty')}
      </p>
      <Err state={state} />
      <div><button className="btn" disabled={pending}>{t('batch.create')}</button></div>
    </form>
  );
}

/* ---------------- Gasto operativo del mes ---------------- */

export function ExpenseForm({ month, tags }: { month: string; tags: string[] }) {
  const t = useTranslations('admin.fin');
  const [state, action, pending] = useActionState<AdminFormState, FormData>(adminCreateExpense, {});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) formRef.current?.reset(); }, [state]);
  return (
    <form ref={formRef} action={action} className="cost-form cost-form--expense" noValidate>
      <label className="field"><span>{t('exp.month')}</span><input className="input" type="month" name="month" defaultValue={month} required /></label>
      <label className="field">
        <span>{t('exp.tag')}</span>
        <input className="input" name="tag" list="expense-tags" placeholder={tags[0]} aria-invalid={bad(state, 'tag')} required />
        <datalist id="expense-tags">{tags.map((x) => <option key={x} value={x} />)}</datalist>
      </label>
      <label className="field"><span>{t('exp.description')}</span><input className="input" name="description" placeholder={t('exp.descriptionPh')} /></label>
      <label className="field"><span>{t('exp.amount')}</span><input className="input" name="amount" inputMode="decimal" aria-invalid={bad(state, 'amount')} required /></label>
      <div className="cost-form__go"><button className="btn" disabled={pending}>+ {t('exp.add')}</button></div>
      <Err state={state} />
    </form>
  );
}
