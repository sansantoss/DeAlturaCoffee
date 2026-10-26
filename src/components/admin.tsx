'use client';

import { startTransition, useActionState, useMemo, useState, useTransition, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ActionErrorNote, ConfirmButton } from './ConfirmDialog';
import type { ActionResult } from '@/lib/action-error';
import {
  adminCreateCustomer, adminCreateOrder, adminGrantAccess, adminSetPrices, adminUpdateCustomer, adminUpdateOrder,
  type AdminFormState,
} from '@/app/[locale]/admin/actions';
import type { AccountStatus, OrderStatus, PriceTier } from '@/lib/types';

/*
 * Panel de admin. Patrón en todas las tablas: la fila muestra TEXTO con lo que dice la base;
 * "Editar" la pasa a modo edición; "Guardar" guarda y regresa a texto con el valor nuevo.
 * Los controles de una fila se ligan a su <form> con el atributo `form`, así la fila sigue siendo <tr>.
 */

const money = (cents: number, locale: string) =>
  new Intl.NumberFormat(locale === 'en' ? 'en-CA' : locale === 'fr' ? 'fr-CA' : 'es-MX', { style: 'currency', currency: 'CAD' }).format(cents / 100);

function RowActions({ formId, editing, pending, onEdit, onCancel, extra, error }: {
  formId: string; editing: boolean; pending: boolean; onEdit: () => void; onCancel: () => void; extra?: ReactNode; error?: ActionResult | null;
}) {
  const t = useTranslations('admin');
  return (
    <>
    <div className="cell-actions">
      {editing ? (
        <>
          <button key="save" type="submit" form={formId} className="btn btn--sm" disabled={pending}>{pending ? t('saving') : t('save')}</button>
          <button key="cancel" type="button" className="link" disabled={pending} onClick={(e) => { e.preventDefault(); onCancel(); }}>{t('cancel')}</button>
        </>
      ) : (
        <>
          <button key="edit" type="button" className="btn btn--sm btn--ghost" onClick={(e) => { e.preventDefault(); onEdit(); }}>{t('edit')}</button>
          {extra}
        </>
      )}
    </div>
    {error?.error && <ActionErrorNote result={error} />}
    </>
  );
}

/** Guarda la fila; si la base responde con error, se queda en edición y lo muestra. */
function useRowSave(action: (fd: FormData) => Promise<ActionResult>) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<ActionResult | null>(null);
  const save = (fd: FormData) => start(async () => {
    const r = await action(fd);
    if (r?.error) setError(r);
    else { setError(null); setEditing(false); }
  });
  return {
    editing, pending, error, save,
    edit: () => { setError(null); setEditing(true); },
    cancel: () => { setError(null); setEditing(false); },
  };
}

/* ---------------- Clientes ---------------- */

const STATUSES: AccountStatus[] = ['pending', 'approved', 'suspended'];
const TIERS: PriceTier[] = ['standard', 'partner'];
const TERMS = [15, 30, 45];

export function CustomerRow({ id, status, priceTier, invoiceTermsDays, hasLogin, who, contact, stats }: {
  id: string; status: AccountStatus; priceTier: PriceTier; invoiceTermsDays: number | null; hasLogin: boolean;
  who: ReactNode; contact: ReactNode; stats: ReactNode;
}) {
  const t = useTranslations('admin');
  const { editing, pending, error, save, edit, cancel } = useRowSave(adminUpdateCustomer);
  const formId = `c-${id}`;

  return (
    <tr className={editing ? 'is-editing' : undefined}>
      <td>{who}</td>
      <td>{contact}</td>
      <td>
        {editing ? (
          <select form={formId} name="status" defaultValue={status} className="input input--sm" aria-label={t('status')}>
            {STATUSES.map((s) => <option key={s} value={s}>{t(`statuses.${s}`)}</option>)}
          </select>
        ) : <span className={`pill pill--${status}`}>{t(`statuses.${status}`)}</span>}
      </td>
      <td>
        {editing ? (
          <select form={formId} name="priceTier" defaultValue={priceTier} className="input input--sm" aria-label={t('tier')}>
            {TIERS.map((s) => <option key={s} value={s}>{t(`tiers.${s}`)}</option>)}
          </select>
        ) : t(`tiers.${priceTier}`)}
      </td>
      <td>
        {editing ? (
          <select form={formId} name="invoiceTermsDays" defaultValue={invoiceTermsDays ? String(invoiceTermsDays) : 'none'} className="input input--sm" aria-label={t('terms')}>
            <option value="none">{t('termsNone')}</option>
            {TERMS.map((d) => <option key={d} value={String(d)}>{t('days', { days: d })}</option>)}
          </select>
        ) : invoiceTermsDays ? t('days', { days: invoiceTermsDays }) : t('termsNone')}
      </td>
      <td className="num">{stats}</td>
      <td>
        <span className={`pill ${hasLogin ? 'pill--approved' : 'pill--muted'}`}>{hasLogin ? t('access.yes') : t('access.no')}</span>
      </td>
      <td>
        <form id={formId} action={save}>
          <input type="hidden" name="id" value={id} />
        </form>
        <RowActions
          formId={formId} editing={editing} pending={pending} error={error}
          onEdit={edit} onCancel={cancel}
          extra={<GrantAccess id={id} hasLogin={hasLogin} />}
        />
      </td>
    </tr>
  );
}

function GrantAccess({ id, hasLogin }: { id: string; hasLogin: boolean }) {
  const t = useTranslations('admin.access');
  const [state, action, pending] = useActionState<AdminFormState, FormData>(adminGrantAccess, {});
  if (state.password) {
    return (
      <div className="temp-pass" role="status">
        <strong>{t('tempTitle')}</strong>
        <code className="temp-pass__value">{state.password}</code>
        <small>{t('tempNote')}</small>
      </div>
    );
  }
  const run = () => new Promise<void>((resolve) => {
    const fd = new FormData();
    fd.set('id', id);
    startTransition(() => { action(fd); resolve(); });
  });
  if (hasLogin) {
    return (
      <ConfirmButton className="link" tone="neutral" title={t('regrant')} message={t('confirm')} confirmLabel={t('regrantConfirm')} onConfirm={run} disabled={pending}>
        {t('regrant')}
      </ConfirmButton>
    );
  }
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button className="link" disabled={pending}>{t('grant')}</button>
    </form>
  );
}

/* ---------------- Pedidos ---------------- */

const ORDER_STATUSES: OrderStatus[] = ['awaiting_payment', 'paid', 'invoiced', 'roasting', 'shipped', 'delivered', 'cancelled'];

export function OrderRow({ id, status, cells }: { id: string; status: OrderStatus; cells: ReactNode }) {
  const t = useTranslations();
  const { editing, pending, error, save, edit, cancel } = useRowSave(adminUpdateOrder);
  const formId = `o-${id}`;
  return (
    <tr className={editing ? 'is-editing' : undefined}>
      {cells}
      <td>
        {editing ? (
          <select form={formId} name="status" defaultValue={status} className="input input--sm" aria-label={t('admin.status')}>
            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{t(`order.status.${s}`)}</option>)}
          </select>
        ) : <span className={`status status--${status}`}>{t(`order.status.${status}`)}</span>}
      </td>
      <td>
        <form id={formId} action={save}>
          <input type="hidden" name="id" value={id} />
        </form>
        <RowActions formId={formId} editing={editing} pending={pending} error={error} onEdit={edit} onCancel={cancel} />
      </td>
    </tr>
  );
}

/* ---------------- Precios ---------------- */

export function PriceRow({ sku, product, format, standardCents, partnerCents }: {
  sku: string; product: string; format: string; standardCents: number; partnerCents: number;
}) {
  const locale = useLocale();
  const { editing, pending, error, save, edit, cancel } = useRowSave(adminSetPrices);
  const formId = `p-${sku}`;
  const discount = standardCents ? Math.round((1 - partnerCents / standardCents) * 1000) / 10 : 0;
  return (
    <tr className={editing ? 'is-editing' : undefined}>
      <td><strong>{product}</strong></td>
      <td>{format}</td>
      <td className="num">
        {editing
          ? <input form={formId} name="standard" type="number" step="0.01" min="0.01" defaultValue={(standardCents / 100).toFixed(2)} className="input input--sm input--num" />
          : money(standardCents, locale)}
      </td>
      <td className="num">
        {editing
          ? <input form={formId} name="partner" type="number" step="0.01" min="0.01" defaultValue={(partnerCents / 100).toFixed(2)} className="input input--sm input--num" />
          : money(partnerCents, locale)}
      </td>
      <td className="num">{discount}%</td>
      <td>
        <form id={formId} action={save}>
          <input type="hidden" name="sku" value={sku} />
        </form>
        <RowActions formId={formId} editing={editing} pending={pending} error={error} onEdit={edit} onCancel={cancel} />
      </td>
    </tr>
  );
}

/* ---------------- Nuevo cliente ---------------- */

const PROVINCES = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'];

function F({ name, label, state, type = 'text', required = true, ...rest }: {
  name: string; label: string; state: AdminFormState; type?: string; required?: boolean; autoComplete?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input className="input" name={name} type={type} required={required} aria-invalid={state.fields?.includes(name) || undefined} {...rest} />
    </label>
  );
}

export function NewCustomerForm() {
  const t = useTranslations();
  const [state, action, pending] = useActionState<AdminFormState, FormData>(adminCreateCustomer, {});
  if (state.ok && state.id) {
    return (
      <div className="notice notice--strong stack" role="status">
        <strong>{t('admin.newCustomer.created')}</strong>
        <p><Link className="btn" href={`/admin/orders/new?customer=${state.id}`}>{t('admin.newCustomer.orderFor')}</Link></p>
      </div>
    );
  }
  return (
    <form action={action} className="stack" noValidate>
      <div className="two">
        <F name="businessName" label={t('apply.business')} state={state} />
        <label className="field">
          <span>{t('apply.type')}</span>
          <select className="input" name="businessType" defaultValue="cafe">
            {(['cafe', 'restaurant', 'retail', 'office', 'other'] as const).map((x) => <option key={x} value={x}>{t(`apply.types.${x}`)}</option>)}
          </select>
        </label>
      </div>
      <div className="two">
        <F name="contactName" label={t('apply.contact')} state={state} />
        <F name="phone" label={t('apply.phone')} state={state} type="tel" required={false} />
      </div>
      <div className="two">
        <F name="email" label={t('apply.email')} state={state} type="email" />
        <label className="field">
          <span>{t('account.language')}</span>
          <select className="input" name="preferredLocale" defaultValue="en">
            <option value="en">English</option><option value="fr">Français</option><option value="es">Español</option>
          </select>
        </label>
      </div>

      <h3 className="h-small">{t('admin.newCustomer.addressTitle')}</h3>
      <F name="line1" label={t('account.line1')} state={state} />
      <F name="line2" label={t('account.line2')} state={state} required={false} />
      <div className="two">
        <F name="city" label={t('apply.city')} state={state} />
        <label className="field">
          <span>{t('apply.province')}</span>
          <select className="input" name="province" defaultValue="ON">{PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}</select>
        </label>
      </div>
      <F name="postalCode" label={t('account.postal')} state={state} />

      <h3 className="h-small">{t('admin.newCustomer.accountTitle')}</h3>
      <div className="two">
        <label className="field">
          <span>{t('admin.tier')}</span>
          <select className="input" name="priceTier" defaultValue="standard">
            {TIERS.map((s) => <option key={s} value={s}>{t(`admin.tiers.${s}`)}</option>)}
          </select>
        </label>
        <label className="field">
          <span>{t('admin.terms')}</span>
          <select className="input" name="invoiceTermsDays" defaultValue="30">
            <option value="none">{t('admin.termsNone')}</option>
            {TERMS.map((d) => <option key={d} value={String(d)}>{t('admin.days', { days: d })}</option>)}
          </select>
        </label>
      </div>
      {state.error && <p className="error" role="alert">{t(`admin.newCustomer.errors.${state.error as 'exists' | 'invalid' | 'unknown'}`)}</p>}
      <div><button className="btn" disabled={pending}>{t('admin.newCustomer.create')}</button></div>
    </form>
  );
}

/* ---------------- Nuevo pedido ---------------- */

export interface OrderOption { sku: string; label: string; grams: number; roasts: string[]; price: Record<PriceTier, number> }
export interface CustomerOption { id: string; label: string; tier: PriceTier; hasCredit: boolean }

export function NewOrderForm({ customers, options, defaultCustomer, minimumKg }: {
  customers: CustomerOption[]; options: OrderOption[]; defaultCustomer?: string; minimumKg: number;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [state, action, pending] = useActionState<AdminFormState, FormData>(adminCreateOrder, {});
  const [customerId, setCustomerId] = useState(defaultCustomer ?? '');
  const [lines, setLines] = useState([{ sku: options[0]?.sku ?? '', roast: options[0]?.roasts[0] ?? 'medium', quantity: 1 }]);
  const customer = customers.find((c) => c.id === customerId);
  const bySku = useMemo(() => new Map(options.map((o) => [o.sku, o])), [options]);
  const subtotal = customer ? lines.reduce((s, l) => s + (bySku.get(l.sku)?.price[customer.tier] ?? 0) * l.quantity, 0) : 0;
  const kg = lines.reduce((s, l) => s + ((bySku.get(l.sku)?.grams ?? 0) * l.quantity) / 1000, 0);
  const set = (i: number, patch: Partial<(typeof lines)[number]>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  if (state.ok) {
    return (
      <div className="notice notice--strong stack" role="status">
        <strong>{t('admin.newOrder.created')}</strong>
        <p><Link className="btn" href="/admin/orders">{t('admin.newOrder.view')}</Link></p>
      </div>
    );
  }

  return (
    <form action={action} className="stack">
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      <label className="field">
        <span>{t('admin.newOrder.customer')}</span>
        <select className="input" name="customerId" required value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="" disabled>{t('admin.newOrder.pick')}</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </label>

      <div className="order-lines">
        {lines.map((l, i) => {
          const opt = bySku.get(l.sku);
          return (
            <div className="order-line" key={i}>
              <label className="field">
                <span>{t('admin.newOrder.format')}</span>
                <select className="input" value={l.sku} onChange={(e) => set(i, { sku: e.target.value, roast: bySku.get(e.target.value)?.roasts[0] ?? 'medium' })}>
                  {options.map((o) => <option key={o.sku} value={o.sku}>{o.label}</option>)}
                </select>
              </label>
              <label className="field">
                <span>{t('admin.newOrder.roast')}</span>
                <select className="input" value={l.roast} onChange={(e) => set(i, { roast: e.target.value })}>
                  {(opt?.roasts ?? []).map((r) => <option key={r} value={r}>{t(`formats.${r}` as 'formats.medium')}</option>)}
                </select>
              </label>
              <label className="field">
                <span>{t('admin.newOrder.qty')}</span>
                <input className="input" type="number" min={1} max={999} value={l.quantity} onChange={(e) => set(i, { quantity: Math.max(1, Number(e.target.value) || 1) })} />
              </label>
              {lines.length > 1 && (
                <button type="button" className="link order-line__remove" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>{t('admin.newOrder.remove')}</button>
              )}
            </div>
          );
        })}
        <div>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setLines((ls) => [...ls, { sku: options[0].sku, roast: options[0].roasts[0], quantity: 1 }])}>
            + {t('admin.newOrder.add')}
          </button>
        </div>
      </div>

      <p className="order-estimate nums">
        {kg.toLocaleString(locale, { maximumFractionDigits: 2 })} kg
        {customer && <> · {t('admin.newOrder.estimate')}: <strong>{money(subtotal, locale)}</strong></>}
        {kg < minimumKg && <> · <span className="hint">min. {minimumKg} kg</span></>}
      </p>

      <fieldset className="radio-cards">
        <legend className="field"><span>{t('admin.newOrder.payment')}</span></legend>
        <label><input type="radio" name="payment" value="card" defaultChecked /> <span>{t('admin.newOrder.card')}</span></label>
        {customer?.hasCredit && <label><input type="radio" name="payment" value="invoice" /> <span>{t('admin.newOrder.invoice')}</span></label>}
      </fieldset>
      <label className="check"><input type="checkbox" name="skipMinimum" /> {t('admin.newOrder.skipMinimum')}</label>
      <label className="field">
        <span>{t('admin.newOrder.notes')}</span>
        <textarea className="input" name="notes" maxLength={1000} />
      </label>
      {state.error && <p className="error" role="alert">{t(`admin.newOrder.errors.${state.error as 'auth' | 'address' | 'empty' | 'minimum' | 'invalid'}`)}</p>}
      <div><button className="btn" disabled={pending || !customerId}>{t('admin.newOrder.create')}</button></div>
    </form>
  );
}
