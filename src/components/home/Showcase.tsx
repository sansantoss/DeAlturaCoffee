'use client';

import { useState, type ReactNode } from 'react';
import { Link } from '@/i18n/navigation';

export function ShowcaseTabs({
  tabs,
  title,
  seeLabel,
  applyLabel,
  applyHref,
  plate,
}: {
  tabs: { sku: string; label: string; text: string }[];
  title: string;
  seeLabel: string;
  applyLabel: string;
  applyHref: string;
  plate: ReactNode;
}) {
  const [active, setActive] = useState(tabs[0]?.sku);
  const current = tabs.find((t) => t.sku === active) ?? tabs[0];

  return (
    <section className="showcase" aria-labelledby="showcase-title">
      <div className="showcase__plate">{plate}</div>
      <div className="showcase__text" data-reveal>
        <div className="tabs" role="tablist" aria-label={title}>
          {tabs.map((t) => (
            <button
              key={t.sku}
              role="tab"
              id={`tab-${t.sku}`}
              aria-selected={t.sku === active}
              aria-controls="showcase-panel"
              onClick={() => setActive(t.sku)}
              className="nums"
            >
              {t.label}
            </button>
          ))}
        </div>
        <div id="showcase-panel" role="tabpanel" aria-labelledby={`tab-${active}`}>
          <h2 id="showcase-title" className="showcase__title">{title}</h2>
          <p className="showcase__desc">{current.text}</p>
        </div>
        <div className="showcase__actions">
          <Link href="/coffee/venezuela-santa-cruz-de-mora">{seeLabel}</Link>
          <Link href={applyHref}>{applyLabel}</Link>
        </div>
      </div>
    </section>
  );
}
