/**
 * Clasificación única de inversiones para balance y reglas de negocio.
 * Evita bugs donde Postgres devuelve "false" como string (truthy en JS).
 */

export function coerceInvestmentBoolean(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const n = value.trim().toLowerCase();
    if (['true', '1', 't', 'yes', 'si', 'sí'].includes(n)) return true;
    if (['false', '0', 'f', 'no', '', 'null'].includes(n)) return false;
  }
  return Boolean(value);
}

export function isInvestmentDomiciliation(inv: {
  isDomiciliation?: unknown;
  is_domiciliation?: unknown;
}): boolean {
  return (
    coerceInvestmentBoolean(inv?.isDomiciliation) ||
    coerceInvestmentBoolean(inv?.is_domiciliation)
  );
}

export function isInvestmentCancelled(inv: {
  isCancelled?: unknown;
  is_cancelled?: unknown;
  status?: unknown;
}): boolean {
  if (
    coerceInvestmentBoolean(inv?.isCancelled) ||
    coerceInvestmentBoolean(inv?.is_cancelled)
  ) {
    return true;
  }
  const status = String(inv?.status ?? '').toLowerCase();
  return status === 'cancelled' || status === 'canceled' || status === 'cancelada';
}

/**
 * Activa = no cancelada, no domiciliación, no vencida por fecha ni por status explícito.
 * "completed" del legacy no implica vencida si la fecha de vencimiento es futura.
 */
export function resolveInvestmentLifecycle(
  inv: {
    status?: unknown;
    maturityDate?: unknown;
    maturity_date?: unknown;
    isCancelled?: unknown;
    is_cancelled?: unknown;
    isDomiciliation?: unknown;
    is_domiciliation?: unknown;
  },
  nowMs: number = Date.now(),
): 'active' | 'matured' | 'cancelled' {
  if (isInvestmentCancelled(inv)) return 'cancelled';

  const status = String(inv?.status ?? '').toLowerCase();

  const maturityDateRaw = inv?.maturityDate ?? inv?.maturity_date;
  if (maturityDateRaw) {
    const maturityTs = new Date(maturityDateRaw as string).getTime();
    if (Number.isFinite(maturityTs) && maturityTs < nowMs) {
      return 'matured';
    }
  }

  if (status === 'matured' || status === 'vencida' || status === 'vencido') return 'matured';

  return 'active';
}

/** Principal en inversiones a plazo (no domiciliación) que siguen activas. */
export function isActiveTermInvestment(inv: unknown, nowMs?: number): boolean {
  const row = inv as Record<string, unknown>;
  if (isInvestmentDomiciliation(row)) return false;
  return resolveInvestmentLifecycle(row, nowMs) === 'active';
}
