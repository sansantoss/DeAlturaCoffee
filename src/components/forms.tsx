'use client';

import { useActionState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  applyAction,
  placeOrderAction,
  saveProfileAction,
  signInAction,
  type FormState,
} from '@/app/[locale]/actions';
import type { Customer } from '@/lib/types';

const PROVINCES = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'];

function Field({
  name, label, type = 'text', state, hint, required = true, defaultValue, autoComplete, ...rest
}: {
  name: string; label: string; type?: string; state: FormState; hint?: string; required?: boolean;
  defaultValue?: string | number; autoComplete?: string; min?: number;
}) {
  const invalid = state.fields?.includes(name);
  return (
    <label className="field">
      <span>{label}</span>
      <input
        className="input"
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        aria-invalid={invalid || undefined}
        {...rest}
      />
      {hint && <small className="hint">{hint}</small>}
    </label>
  );
}

function ProvinceSelect({ state, defaultValue, required = true }: { state: FormState; defaultValue?: string; required?: boolean }) {
  const t = useTranslations('apply');
  return (
    <label className="field">
      <span>{t('province')}</span>
      <select className="input" name="province" required={required} defaultValue={defaultValue ?? ''} aria-invalid={state.fields?.includes('province') || undefined}>
        <option value="" disabled>—</option>
        {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
    </label>
  );
}

/* ---------------- Sign in ---------------- */

export function SignInForm({ next, demo }: { next?: string; demo?: { email: string; password: string } }) {
  const t = useTranslations('auth');
  const [state, action, pending] = useActionState<FormState, FormData>(signInAction, {});
  return (
    <form action={action} className="stack">
      <input type="hidden" name="next" value={next ?? ''} />
      <Field name="email" type="email" label={t('email')} state={state} autoComplete="email" defaultValue={demo?.email} />
      <Field name="password" type="password" label={t('password')} state={state} autoComplete="current-password" />
      {state.error && <p className="error" role="alert">{t('invalid')}</p>}
      <button className="btn" disabled={pending}>{t('submit')}</button>
      {demo && <p className="notice">{t('demo', demo)}</p>}
    </form>
  );
}

/* ---------------- Apply (sign up) ---------------- */

export function ApplyForm() {
  const t = useTranslations('apply');
  const [state, action, pending] = useActionState<FormState, FormData>(applyAction, {});
  const types = ['cafe', 'restaurant', 'retail', 'office', 'other'] as const;
  return (
    <form action={action} className="stack" noValidate>
      <div className="two">
        <Field name="businessName" label={t('business')} state={state} autoComplete="organization" />
        <label className="field">
          <span>{t('type')}</span>
          <select className="input" name="businessType" defaultValue="cafe">
            {types.map((ty) => <option key={ty} value={ty}>{t(`types.${ty}`)}</option>)}
          </select>
        </label>
      </div>
      <div className="two">
        <Field name="contactName" label={t('contact')} state={state} autoComplete="name" />
        <Field name="phone" type="tel" label={t('phone')} state={state} required={false} autoComplete="tel" />
      </div>
      <div className="two">
        <Field name="city" label={t('city')} state={state} autoComplete="address-level2" />
        <ProvinceSelect state={state} />
      </div>
      <Field name="kg" type="number" min={1} label={t('kg')} state={state} defaultValue={20} />
      <div className="two">
        <Field name="email" type="email" label={t('email')} state={state} autoComplete="email" />
        <Field name="password" type="password" label={t('password')} hint={t('passwordHint')} state={state} autoComplete="new-password" />
      </div>
      <label className="field">
        <span>{t('message')}</span>
        <textarea className="input" name="message" maxLength={2000} />
      </label>
      {state.error && (
        <p className="error" role="alert">
          {t(`errors.${state.error as 'exists' | 'invalid' | 'unknown'}`)}
          {state.error === 'exists' && <> <Link href="/login" className="link">→</Link></>}
        </p>
      )}
      <div>
        <button className="btn" disabled={pending}>{t('submit')}</button>
      </div>
    </form>
  );
}

/* ---------------- Profile ---------------- */

export function ProfileForm({ customer }: { customer: Customer }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState<FormState, FormData>(saveProfileAction, {});
  const address = customer.addresses.find((a) => a.isDefault) ?? customer.addresses[0];
  return (
    <form action={action} className="stack">
      <div className="two">
        <Field name="businessName" label={t('apply.business')} state={state} defaultValue={customer.businessName} />
        <Field name="contactName" label={t('apply.contact')} state={state} defaultValue={customer.contactName} />
      </div>
      <div className="two">
        <Field name="phone" type="tel" label={t('apply.phone')} state={state} required={false} defaultValue={customer.phone} />
        <Field name="gstNumber" label="GST / HST #" state={state} required={false} defaultValue={customer.gstNumber} />
      </div>
      <label className="field">
        <span>{t('account.language')}</span>
        <select className="input" name="preferredLocale" defaultValue={customer.preferredLocale}>
          {(['en', 'fr', 'es'] as const).map((l) => <option key={l} value={l}>{t(`lang.${l}`)}</option>)}
        </select>
      </label>

      <h3 className="h-small" style={{ marginTop: '1rem' }}>{t('account.addresses')}</h3>
      <Field name="addressLabel" label={t('account.addressLabel')} state={state} required={false} defaultValue={address?.label} />
      <Field name="line1" label={t('account.line1')} state={state} required={false} defaultValue={address?.line1} autoComplete="address-line1" />
      <Field name="line2" label={t('account.line2')} state={state} required={false} defaultValue={address?.line2} autoComplete="address-line2" />
      <div className="two">
        <Field name="city" label={t('apply.city')} state={state} required={false} defaultValue={address?.city} autoComplete="address-level2" />
        <ProvinceSelect state={state} defaultValue={address?.province} required={false} />
      </div>
      <Field name="postalCode" label={t('account.postal')} state={state} required={false} defaultValue={address?.postalCode} autoComplete="postal-code" />
      {state.error && <p className="error" role="alert">{t('apply.errors.invalid')}</p>}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <button className="btn" disabled={pending}>{t('account.save')}</button>
        {state.ok && <span role="status">{t('account.saved')}</span>}
      </div>
    </form>
  );
}

/* ---------------- Checkout ---------------- */

export function CheckoutForm({
  canOrder,
  invoiceDays,
  paymentsEnabled,
}: {
  canOrder: boolean;
  invoiceDays: number | null;
  paymentsEnabled: boolean;
}) {
  const t = useTranslations('cart');
  const locale = useLocale();
  const [state, action, pending] = useActionState<FormState, FormData>(placeOrderAction, {});
  return (
    <form action={action} className="stack" lang={locale}>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }} className="stack">
        <legend className="field"><span>{t('payment')}</span></legend>
        <div className="radio-cards">
          <label>
            <input type="radio" name="payment" value="card" defaultChecked />
            <span><strong>{t('card')}</strong><br /><small>{paymentsEnabled ? t('cardHint') : t('testMode')}</small></span>
          </label>
          {invoiceDays && (
            <label>
              <input type="radio" name="payment" value="invoice" />
              <span><strong>{t('invoice', { days: invoiceDays })}</strong><br /><small>{t('invoiceHint')}</small></span>
            </label>
          )}
        </div>
      </fieldset>
      <label className="field">
        <span>{t('notes')}</span>
        <textarea className="input" name="notes" maxLength={1000} style={{ background: 'var(--cream)' }} />
      </label>
      {state.error && <p className="error" role="alert">{t(`errors.${state.error as 'minimum' | 'address' | 'empty' | 'auth'}`)}</p>}
      <button className="btn btn--block" disabled={!canOrder || pending}>
        {paymentsEnabled ? t('placeAndPay') : t('place')}
      </button>
    </form>
  );
}
