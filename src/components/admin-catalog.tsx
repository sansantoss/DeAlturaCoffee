'use client';

import { useActionState, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import {
  adminCreateFarm, adminCreateProduct, adminRemoveFarm, adminSaveFarm, adminSaveProduct, adminUploadPhoto,
  type CatalogState,
} from '@/app/[locale]/admin/catalog-actions';
import { ActionErrorNote, ConfirmButton } from './ConfirmDialog';
import type { Farm, LabSheet, Localized, Origin, Product, RoastLevel } from '@/lib/types';

/*
 * Admin › Catálogo. El editor guarda el café completo de una vez ("Guardar cambios").
 * Los textos que se ven en la web van en los 3 idiomas; si dejas EN o FR vacío, se muestra el ES.
 */

const LANGS = ['es', 'en', 'fr'] as const;
const ROASTS: RoastLevel[] = ['light', 'medium', 'dark'];
const CUPPING = ['fragrance', 'flavor', 'aftertaste', 'acidity', 'body', 'balance', 'uniformity', 'cleanCup', 'sweetness', 'overall'];
const emptyLoc = (): Localized => ({ es: '', en: '', fr: '' });
const slugify = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
/** EN/FR vacíos toman el texto en español al guardar. */
const fillLoc = (l: Localized): Localized => ({ es: l.es, en: l.en || l.es, fr: l.fr || l.es });
const num = (v: string) => (v.trim() === '' ? NaN : Number(v.replace(',', '.')));

/* ---------------- piezas ---------------- */

function Section({ title, hint, children, id }: { title: string; hint?: string; children: ReactNode; id?: string }) {
  return (
    <section className="card stack cat-section" id={id}>
      <div>
        <h2 className="card__title">{title}</h2>
        {hint && <p className="hint">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function LocField({ label, value, onChange, multiline, invalid }: {
  label: string; value: Localized; onChange: (v: Localized) => void; multiline?: boolean; invalid?: boolean;
}) {
  return (
    <fieldset className="loc-field" aria-invalid={invalid || undefined}>
      <legend>{label}</legend>
      {LANGS.map((l) => (
        <label key={l} className="loc-field__row">
          <span className="loc-field__lang">{l.toUpperCase()}</span>
          {multiline ? (
            <textarea className="input" rows={3} value={value[l] ?? ''} onChange={(e) => onChange({ ...value, [l]: e.target.value })} placeholder={l === 'es' ? '' : value.es} />
          ) : (
            <input className="input" value={value[l] ?? ''} onChange={(e) => onChange({ ...value, [l]: e.target.value })} placeholder={l === 'es' ? '' : value.es} />
          )}
        </label>
      ))}
    </fieldset>
  );
}

function TextField({ label, value, onChange, type = 'text', hint, invalid, step }: {
  label: string; value: string | number | undefined; onChange: (v: string) => void; type?: string; hint?: string; invalid?: boolean; step?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        className="input" type={type} step={step} inputMode={type === 'number' ? 'decimal' : undefined}
        value={value === undefined || (typeof value === 'number' && Number.isNaN(value)) ? '' : value}
        onChange={(e) => onChange(e.target.value)} aria-invalid={invalid || undefined}
      />
      {hint && <small className="hint">{hint}</small>}
    </label>
  );
}

/** Achica la foto en el navegador (máx. 2000 px, WebP o JPG) para que suba rápido y pese poco. */
async function shrink(file: File, max = 2000): Promise<File> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  const toBlob = (type: string) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.86));
  let blob = await toBlob('image/webp');
  if (!blob || blob.type !== 'image/webp') blob = await toBlob('image/jpeg');
  if (!blob) throw new Error('No se pudo procesar la foto');
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'foto'}.${ext}`, { type: blob.type });
}

export function PhotoUpload({ folder, onUploaded, label, multiple = true }: { folder: string; onUploaded: (url: string) => void; label: string; multiple?: boolean }) {
  const t = useTranslations('admin.cat');
  const [busy, setBusy] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const run = async (files: FileList | null) => {
    if (!files?.length) return;
    setErr(null);
    for (const f of Array.from(files)) {
      setBusy((b) => b + 1);
      try {
        const small = await shrink(f);
        const fd = new FormData();
        fd.set('file', small);
        fd.set('folder', folder);
        const r = await adminUploadPhoto(fd);
        if (r.url) onUploaded(r.url);
        else setErr(r.detail ?? t('uploadError'));
      } catch {
        setErr(t('uploadFormat'));
      } finally {
        setBusy((b) => b - 1);
      }
    }
    if (input.current) input.current.value = '';
  };
  return (
    <div className="photo-upload">
      <label className="btn btn--sm btn--ghost">
        {busy ? t('uploading', { n: busy }) : label}
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple={multiple} hidden onChange={(e) => run(e.target.files)} />
      </label>
      {err && <p className="error" role="alert">{err}</p>}
    </div>
  );
}

/* ---------------- Editor de café ---------------- */

type Draft = Product & { lab?: LabSheet };

export function ProductEditor({ product, origin }: { product: Product; origin: Origin }) {
  const t = useTranslations('admin.cat');
  const tf = useTranslations('formats');
  const tl = useTranslations('lab.keys');
  const [p, setP] = useState<Draft>(() => structuredClone(product));
  const [o, setO] = useState<Origin>(() => structuredClone(origin));
  const [hasLab, setHasLab] = useState(Boolean(product.lab));
  const [dirty, setDirty] = useState(false);
  const [state, action, pending] = useActionState<CatalogState, FormData>(adminSaveProduct, {});
  const [slugTouched, setSlugTouched] = useState(product.slug !== slugify(product.name.es));
  const [showTr, setShowTr] = useState(false);
  useEffect(() => { if (state.ok) setDirty(false); }, [state]);

  const up = (patch: Partial<Draft>) => { setP((x) => ({ ...x, ...patch })); setDirty(true); };
  const upO = (patch: Partial<Origin>) => { setO((x) => ({ ...x, ...patch })); setDirty(true); };
  const bad = (k: string) => state.fields?.some((f) => f === k || f.startsWith(`${k}.`));

  const lab: LabSheet = p.lab ?? {
    date: new Date().toISOString().slice(0, 10), lab: '', lot: '', harvest: p.harvest ?? '', moisturePct: 0, densityGL: 0,
    screen: '', screenAbove16Pct: 0, primaryDefects: 0, cupping: CUPPING.map((key) => ({ key, score: 0 })), descriptors: emptyLoc(),
  };
  const upLab = (patch: Partial<LabSheet>) => up({ lab: { ...lab, ...patch } });

  const payload = useMemo(() => {
    const product: Draft = {
      ...p,
      name: fillLoc(p.name), process: fillLoc(p.process), tastingNotes: fillLoc(p.tastingNotes),
      roastInfo: Object.fromEntries(p.roasts.map((r) => [r, {
        notes: fillLoc(p.roastInfo?.[r]?.notes ?? emptyLoc()), use: fillLoc(p.roastInfo?.[r]?.use ?? emptyLoc()),
      }])),
      formats: p.formats.map((f) => ({ ...f, label: fillLoc(f.label) })),
      lab: hasLab ? { ...lab, descriptors: fillLoc(lab.descriptors) } : undefined,
      score: p.score === undefined || Number.isNaN(p.score) ? undefined : p.score,
      farm: p.farm || undefined, producer: p.producer || undefined, harvest: p.harvest || undefined,
    };
    const origin: Origin = { ...o, country: fillLoc(o.country), story: fillLoc(o.story) };
    return JSON.stringify({ product, origin });
  }, [p, o, hasLab, lab]);

  const setRoastInfo = (r: RoastLevel, key: 'notes' | 'use', v: Localized) =>
    up({ roastInfo: { ...p.roastInfo, [r]: { notes: p.roastInfo?.[r]?.notes ?? emptyLoc(), use: p.roastInfo?.[r]?.use ?? emptyLoc(), [key]: v } } });

  const images = p.images ?? [];
  const move = (i: number, d: -1 | 1) => {
    const next = [...images];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    up({ images: next });
  };

  return (
    <form action={action} className={`cat-editor stack-lg ${showTr ? '' : 'hide-tr'}`}>
      <input type="hidden" name="payload" value={payload} />

      <nav className="cat-index" aria-label={t('index')}>
        {(['general', 'origin', 'bean', 'roasts', 'formats', 'photos', 'lab'] as const).map((k) => (
          <a key={k} href={`#sec-${k}`}>{t(k)}</a>
        ))}
        <label className="check cat-index__tr">
          <input type="checkbox" checked={showTr} onChange={(e) => setShowTr(e.target.checked)} /> {t('showTranslations')}
        </label>
      </nav>

      <Section id="sec-general" title={t('general')} hint={t('generalHint')}>
        <LocField label={t('name')} value={p.name} invalid={bad('name')} onChange={(v) => up({ name: v, ...(slugTouched ? {} : { slug: slugify(v.es) }) })} />
        <div className="three">
          <TextField label={t('slug')} value={p.slug} invalid={bad('slug')} hint={`/coffee/${p.slug}`} onChange={(v) => { setSlugTouched(true); up({ slug: slugify(v) }); }} />
          <TextField label={t('sort')} type="number" value={p.sort ?? 0} onChange={(v) => up({ sort: Math.max(0, Math.round(num(v) || 0)) })} hint={t('sortHint')} />
          <label className="field check-field">
            <span>{t('visibility')}</span>
            <label className="check"><input type="checkbox" checked={p.active} onChange={(e) => up({ active: e.target.checked })} /> {t('active')}</label>
            <small className="hint">{t('activeHint')}</small>
          </label>
        </div>
      </Section>

      <Section id="sec-origin" title={t('origin')} hint={t('originHint')}>
        <LocField label={t('country')} value={o.country} invalid={bad('country')} onChange={(v) => upO({ country: v })} />
        <div className="three">
          <TextField label={t('region')} value={o.region} onChange={(v) => upO({ region: v })} hint="Santa Cruz de Mora, Mérida" />
          <TextField label={t('altMin')} type="number" value={o.altitude.min} onChange={(v) => upO({ altitude: { ...o.altitude, min: Math.round(num(v) || 0) } })} />
          <TextField label={t('altMax')} type="number" value={o.altitude.max} onChange={(v) => upO({ altitude: { ...o.altitude, max: Math.round(num(v) || 0) } })} hint={t('altHint')} />
        </div>
        <LocField label={t('story')} value={o.story} multiline onChange={(v) => upO({ story: v })} />
      </Section>

      <Section id="sec-bean" title={t('bean')}>
        <div className="three">
          <TextField label={t('farm')} value={p.farm} onChange={(v) => up({ farm: v })} />
          <TextField label={t('producer')} value={p.producer} onChange={(v) => up({ producer: v })} />
          <TextField label={t('variety')} value={p.variety} onChange={(v) => up({ variety: v })} />
        </div>
        <div className="three">
          <TextField label={t('harvest')} value={p.harvest} onChange={(v) => up({ harvest: v })} hint="2025–2026" />
          <TextField label={t('score')} type="number" step="0.25" value={p.score} onChange={(v) => up({ score: num(v) })} hint={t('scoreHint')} />
          <label className="field">
            <span>{t('tax')}</span>
            <select className="input" value={p.taxCategory} onChange={(e) => up({ taxCategory: e.target.value as Product['taxCategory'] })}>
              <option value="zero-rated-grocery">{t('taxZero')}</option>
              <option value="standard">{t('taxStandard')}</option>
            </select>
          </label>
        </div>
        <LocField label={t('process')} value={p.process} onChange={(v) => up({ process: v })} />
        <LocField label={t('notes')} value={p.tastingNotes} onChange={(v) => up({ tastingNotes: v })} />
      </Section>

      <Section id="sec-roasts" title={t('roasts')} hint={t('roastsHint')}>
        <div className="choice">
          {ROASTS.map((r) => (
            <label key={r}>
              <input
                type="checkbox" checked={p.roasts.includes(r)}
                onChange={(e) => up({ roasts: e.target.checked ? ROASTS.filter((x) => x === r || p.roasts.includes(x)) : p.roasts.filter((x) => x !== r) })}
              />
              <span>{tf(r)}</span>
            </label>
          ))}
        </div>
        {bad('roasts') && <p className="error">{t('roastsRequired')}</p>}
        {p.roasts.map((r) => (
          <div key={r} className="roast-edit">
            <h3>{tf(r)}</h3>
            <LocField label={t('roastNotes')} value={p.roastInfo?.[r]?.notes ?? emptyLoc()} onChange={(v) => setRoastInfo(r, 'notes', v)} />
            <LocField label={t('roastUse')} value={p.roastInfo?.[r]?.use ?? emptyLoc()} onChange={(v) => setRoastInfo(r, 'use', v)} />
          </div>
        ))}
      </Section>

      <Section id="sec-formats" title={t('formats')} hint={t('formatsHint')}>
        <div className="formats-edit">
          {p.formats.map((f, i) => {
            const set = (patch: Partial<typeof f>) => up({ formats: p.formats.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            return (
              <div key={i} className="format-edit">
                <div className="format-edit__head">
                  <strong>{f.label.es || f.sku}</strong>
                  {p.formats.length > 1 && (
                    <button type="button" className="link link--danger" onClick={() => up({ formats: p.formats.filter((_, j) => j !== i) })}>{t('removeFormat')}</button>
                  )}
                </div>
                <div className="three">
                  <TextField label="SKU" value={f.sku} invalid={bad('formats')} onChange={(v) => set({ sku: v.toUpperCase().replace(/[^A-Z0-9-]/g, '') })} />
                  <TextField label={t('grams')} type="number" value={f.grams} onChange={(v) => set({ grams: Math.round(num(v) || 0) })} hint={t('gramsHint')} />
                  <TextField label={t('perCase')} type="number" value={f.unitsPerCase} onChange={(v) => set({ unitsPerCase: Math.max(1, Math.round(num(v) || 1)) })} />
                </div>
                <LocField label={t('formatName')} value={f.label} onChange={(v) => set({ label: v })} />
                <div className="two">
                  <TextField label={t('priceStandard')} type="number" step="0.01" value={(f.price.standard / 100).toFixed(2)} onChange={(v) => set({ price: { ...f.price, standard: Math.round((num(v) || 0) * 100) } })} />
                  <TextField label={t('pricePartner')} type="number" step="0.01" value={(f.price.partner / 100).toFixed(2)} onChange={(v) => set({ price: { ...f.price, partner: Math.round((num(v) || 0) * 100) } })} />
                </div>
              </div>
            );
          })}
        </div>
        <div>
          <button
            type="button" className="btn btn--sm btn--ghost"
            onClick={() => up({ formats: [...p.formats, { sku: `${p.formats[0]?.sku.split('-').slice(0, -1).join('-') || 'SKU'}-NEW${p.formats.length + 1}`, label: emptyLoc(), grams: 1000, unitsPerCase: 1, price: { standard: 0, partner: 0 } }] })}
          >
            + {t('addFormat')}
          </button>
        </div>
      </Section>

      <Section id="sec-photos" title={t('photos')} hint={t('photosHint')}>
        {images.length ? (
          <ul className="photo-grid">
            {images.map((src, i) => (
              <li key={src} className="photo-grid__item">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" />
                <div className="photo-grid__bar">
                  {i === 0 ? <span className="pill pill--approved">{t('cover')}</span> : <button type="button" className="link" onClick={() => move(i, -1)}>← {t('moveLeft')}</button>}
                  <button
                    type="button" className="link link--danger"
                    onClick={() => up({ images: images.filter((x) => x !== src), roastImages: Object.fromEntries(Object.entries(p.roastImages ?? {}).filter(([, v]) => v !== src)) })}
                  >
                    {t('removePhoto')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="hint">{t('noPhotos')}</p>}
        <PhotoUpload folder={`products/${p.id}`} label={`+ ${t('addPhotos')}`} onUploaded={(url) => setP((x) => { setDirty(true); return { ...x, images: [...(x.images ?? []), url] }; })} />
        {images.length > 0 && (
          <div className="three">
            {p.roasts.map((r) => (
              <label key={r} className="field">
                <span>{t('roastPhoto', { roast: tf(r) })}</span>
                <select className="input" value={p.roastImages?.[r] ?? ''} onChange={(e) => up({ roastImages: { ...p.roastImages, [r]: e.target.value || undefined } as Product['roastImages'] })}>
                  <option value="">{t('roastPhotoAuto')}</option>
                  {images.map((src, i) => <option key={src} value={src}>{t('photoN', { n: i + 1 })}</option>)}
                </select>
              </label>
            ))}
          </div>
        )}
      </Section>

      <Section id="sec-lab" title={t('lab')} hint={t('labHint')}>
        <label className="check"><input type="checkbox" checked={hasLab} onChange={(e) => { setHasLab(e.target.checked); setDirty(true); }} /> {t('hasLab')}</label>
        {hasLab && (
          <>
            <div className="three">
              <TextField label={t('labDate')} type="date" value={lab.date} onChange={(v) => upLab({ date: v })} />
              <TextField label={t('labName')} value={lab.lab} onChange={(v) => upLab({ lab: v })} />
              <TextField label={t('labLot')} value={lab.lot} onChange={(v) => upLab({ lot: v })} />
            </div>
            <div className="three">
              <TextField label={t('labMoisture')} type="number" step="0.1" value={lab.moisturePct} onChange={(v) => upLab({ moisturePct: num(v) || 0 })} />
              <TextField label={t('labDensity')} type="number" value={lab.densityGL} onChange={(v) => upLab({ densityGL: num(v) || 0 })} />
              <TextField label={t('labDefects')} type="number" value={lab.primaryDefects} onChange={(v) => upLab({ primaryDefects: Math.round(num(v) || 0) })} />
            </div>
            <div className="three">
              <TextField label={t('labScreen')} value={lab.screen} onChange={(v) => upLab({ screen: v })} hint="16–18" />
              <TextField label={t('labScreen16')} type="number" step="0.1" value={lab.screenAbove16Pct} onChange={(v) => upLab({ screenAbove16Pct: num(v) || 0 })} />
              <TextField label={t('labHarvest')} value={lab.harvest} onChange={(v) => upLab({ harvest: v })} />
            </div>
            <fieldset className="cupping-edit">
              <legend>{t('cupping')}</legend>
              {CUPPING.map((key) => {
                const cur = lab.cupping.find((c) => c.key === key)?.score ?? 0;
                return (
                  <TextField
                    key={key} label={tl(key)} type="number" step="0.25" value={cur}
                    onChange={(v) => upLab({ cupping: CUPPING.map((k) => ({ key: k, score: k === key ? Math.min(10, Math.max(0, num(v) || 0)) : lab.cupping.find((c) => c.key === k)?.score ?? 0 })) })}
                  />
                );
              })}
              <p className="hint">{t('cuppingTotal', { total: lab.cupping.reduce((s, c) => s + c.score, 0).toFixed(2) })}</p>
            </fieldset>
            <LocField label={t('descriptors')} value={lab.descriptors} multiline onChange={(v) => upLab({ descriptors: v })} />
          </>
        )}
      </Section>

      <div className="save-bar">
        <span className="save-bar__status" role="status">
          {pending ? t('saving') : state.ok && !dirty ? `✓ ${t('saved')}` : dirty ? t('unsaved') : ''}
        </span>
        {state.error && <ActionErrorNote result={state} />}
        <div className="save-bar__actions">
          {p.active && <Link className="link" href={`/coffee/${p.slug}`} target="_blank">{t('viewOnSite')}</Link>}
          <button className="btn" disabled={pending}>{t('save')}</button>
        </div>
      </div>
    </form>
  );
}

/* ---------------- Crear café / finca ---------------- */

export function NewProductButton() {
  const t = useTranslations('admin.cat');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<CatalogState | null>(null);
  return (
    <>
      <button type="button" className="btn" disabled={pending} onClick={() => start(async () => {
        const r = await adminCreateProduct();
        if (r.id) router.push(`/admin/catalog/${r.id}`); else setErr(r);
      })}>+ {t('newProduct')}</button>
      {err?.error && <ActionErrorNote result={err} />}
    </>
  );
}

export function NewFarmButton({ productId }: { productId?: string }) {
  const t = useTranslations('admin.cat');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<CatalogState | null>(null);
  return (
    <>
      <button type="button" className="btn btn--sm btn--ghost" disabled={pending} onClick={() => start(async () => {
        const r = await adminCreateFarm(productId);
        if (r.id) router.push(`/admin/catalog/farms/${r.id}`); else setErr(r);
      })}>+ {t('newFarm')}</button>
      {err?.error && <ActionErrorNote result={err} />}
    </>
  );
}

/* ---------------- Editor de finca ---------------- */

export function FarmEditor({ farm, products }: { farm: Farm; products: { id: string; name: string }[] }) {
  const t = useTranslations('admin.cat');
  const router = useRouter();
  const [f, setF] = useState<Farm>(() => structuredClone(farm));
  const [dirty, setDirty] = useState(false);
  const [state, action, pending] = useActionState<CatalogState, FormData>(adminSaveFarm, {});
  useEffect(() => { if (state.ok) setDirty(false); }, [state]);
  const up = (patch: Partial<Farm>) => { setF((x) => ({ ...x, ...patch })); setDirty(true); };
  const isUrl = /^(https?:)?\//.test(f.image);
  const payload = JSON.stringify({ ...f, text: fillLoc(f.text), productId: f.productId || undefined });

  return (
    <form action={action} className="cat-editor stack-lg">
      <input type="hidden" name="payload" value={payload} />
      <Section title={t('farmData')}>
        <div className="three">
          <TextField label={t('farmName')} value={f.name} onChange={(v) => up({ name: v })} invalid={state.fields?.includes('name')} />
          <TextField label={t('producer')} value={f.producer} onChange={(v) => up({ producer: v })} />
          <TextField label={t('variety')} value={f.variety} onChange={(v) => up({ variety: v })} />
        </div>
        <div className="three">
          <TextField label={t('town')} value={f.town} onChange={(v) => up({ town: v })} />
          <TextField label={t('state')} value={f.state} onChange={(v) => up({ state: v })} />
          <TextField label={t('altitude')} type="number" value={f.altitude} onChange={(v) => up({ altitude: Math.round(num(v) || 0) })} />
        </div>
        <LocField label={t('farmText')} value={f.text} multiline onChange={(v) => up({ text: v })} />
        <div className="three">
          <label className="field">
            <span>{t('farmProduct')}</span>
            <select className="input" value={f.productId ?? ''} onChange={(e) => up({ productId: e.target.value || undefined })}>
              <option value="">{t('farmAllProducts')}</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <TextField label={t('sort')} type="number" value={f.sort ?? 0} onChange={(v) => up({ sort: Math.max(0, Math.round(num(v) || 0)) })} />
          <label className="field check-field">
            <span>{t('visibility')}</span>
            <label className="check"><input type="checkbox" checked={f.published} onChange={(e) => up({ published: e.target.checked })} /> {t('published')}</label>
          </label>
        </div>
      </Section>
      <Section title={t('farmPhoto')} hint={t('farmPhotoHint')}>
        {isUrl ? (
          <div className="photo-grid__item photo-grid__item--single">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.image} alt="" />
            <div className="photo-grid__bar"><button type="button" className="link link--danger" onClick={() => up({ image: '' })}>{t('removePhoto')}</button></div>
          </div>
        ) : (
          <p className="hint">{f.image ? t('farmPhotoFile', { file: f.image }) : t('noPhotos')}</p>
        )}
        <PhotoUpload folder={`farms/${f.id}`} multiple={false} label={isUrl ? t('replacePhoto') : `+ ${t('addPhoto')}`} onUploaded={(url) => up({ image: url })} />
      </Section>
      <div className="save-bar">
        <span className="save-bar__status" role="status">{pending ? t('saving') : state.ok && !dirty ? `✓ ${t('saved')}` : dirty ? t('unsaved') : ''}</span>
        {state.error && <ActionErrorNote result={state} />}
        <div className="save-bar__actions">
          <ConfirmButton
            title={t('removeFarmTitle')} message={`${f.name}. ${t('removeFarmNote')}`} confirmLabel={t('removeFarm')}
            onConfirm={async () => {
              const fd = new FormData(); fd.set('id', f.id);
              const r = await adminRemoveFarm(fd);
              if (!r.error) router.push('/admin/catalog');
              return r;
            }}
          >
            {t('removeFarm')}
          </ConfirmButton>
          <button className="btn" disabled={pending}>{t('save')}</button>
        </div>
      </div>
    </form>
  );
}
