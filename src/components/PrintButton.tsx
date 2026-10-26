'use client';

/** Imprimir o guardar como PDF (el navegador ofrece "Guardar como PDF"). */
export function PrintButton({ label }: { label: string }) {
  return <button type="button" className="btn btn--sm" onClick={() => window.print()}>{label}</button>;
}
