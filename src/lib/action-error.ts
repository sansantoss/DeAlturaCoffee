/**
 * Convierte un error de la base de datos en algo que el admin pueda leer y arreglar,
 * en lugar de tumbar la página. Se usa en las server actions del panel.
 */
export type ActionResult = { error?: string; detail?: string };

export function describeError(e: unknown): ActionResult {
  const msg = e instanceof Error ? e.message : String(e);
  if (/does not exist|schema cache|Could not find the table/i.test(msg)) return { error: 'missingTable', detail: msg };
  if (/permission denied/i.test(msg)) return { error: 'permission', detail: msg };
  if (/invalid input value for enum/i.test(msg)) return { error: 'missingMigration', detail: msg };
  if (/ZodError|Invalid input|expected/i.test(msg) || (e as { name?: string })?.name === 'ZodError') return { error: 'invalid', detail: msg };
  return { error: 'unknown', detail: msg };
}
