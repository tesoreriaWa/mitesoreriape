/**
 * Funciones puras para el motor de tesorería (base de referencia).
 * Usar en backend autoritativo. No sustituyen Firestore Rules ni las transacciones.
 * Todas las cantidades se expresan en CÉNTIMOS ENTEROS.
 */
export type Destination = 'credit' | 'donation';
export type WeekAllocation = { kind: 'week'; weekId: string; amountCents: number };
export type OtherAllocation = { kind: Destination; amountCents: number };
export type Allocation = WeekAllocation | OtherAllocation;

function assertDate(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Fecha inválida: ${date}`);
  const dateUTC = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(+dateUTC) || dateUTC.toISOString().slice(0, 10) !== date) throw new Error(`Fecha inválida: ${date}`);
}
function utcDate(date: string): Date { assertDate(date); return new Date(`${date}T00:00:00.000Z`); }
function stamp(date: Date): string { return date.toISOString().slice(0, 10); }
export function getFridays(firstFriday: string, lastFriday: string, pausedFridays: string[] = []): string[] {
  const first = utcDate(firstFriday), last = utcDate(lastFriday);
  if (first.getUTCDay() !== 5) throw new Error('La primera fecha debe ser viernes');
  if (first > last) return [];
  const paused = new Set(pausedFridays);
  const result: string[] = [];
  for (let d = new Date(first); d <= last; d.setUTCDate(d.getUTCDate() + 7)) {
    const key = stamp(d);
    if (!paused.has(key)) result.push(key);
  }
  return result;
}
export function getUnpaidCents(dueFriday: string, weeklyFeeCents: number, paidByWeek: Record<string, number>): number {
  assertDate(dueFriday);
  if (!Number.isInteger(weeklyFeeCents) || weeklyFeeCents <= 0) throw new Error('Cuota inválida');
  const applied = paidByWeek[dueFriday] ?? 0;
  if (!Number.isInteger(applied) || applied < 0 || applied > weeklyFeeCents) throw new Error('Asignación existente inválida');
  return weeklyFeeCents - applied;
}
export type PaymentInput = {
  amountCents: number;
  paidAtDate: string; // YYYY-MM-DD en America/Lima
  firstFriday: string;
  joinedFriday: string;
  weeklyFeeCents: number;
  throughFriday: string; // fecha límite conocida de calendario (para futuros elegibles)
  paidByWeek: Record<string, number>;
  futureWeekSelections: string[];
  leftoverDestination?: Destination;
  pausedFridays?: string[];
};
/**
 * Este repartidor no consume créditos anteriores; el backend debe calcular
 * esos créditos ANTES y representarlos en paidByWeek cuando ya se aplicaron.
 */
export function allocatePayment(input: PaymentInput): Allocation[] {
  const {amountCents, paidAtDate, firstFriday, joinedFriday, weeklyFeeCents, throughFriday, paidByWeek, futureWeekSelections, leftoverDestination, pausedFridays = []} = input;
  if (!Number.isInteger(amountCents) || amountCents < 500) throw new Error('El abono ordinario mínimo es S/ 5.00');
  if (!Number.isInteger(weeklyFeeCents) || weeklyFeeCents <= 0) throw new Error('Cuota inválida');
  assertDate(paidAtDate);
  const weeks = getFridays(firstFriday, throughFriday, pausedFridays).filter(d => d >= joinedFriday);
  const valid = new Set(weeks);
  const futureSet = new Set(futureWeekSelections);
  if (futureSet.size !== futureWeekSelections.length) throw new Error('Semanas elegidas duplicadas');
  for (const d of futureSet) if (!valid.has(d) || d <= paidAtDate) throw new Error(`Adelanto futuro inválido: ${d}`);

  let rem = amountCents;
  const out: Allocation[] = [];
  // FIFO: fechas exigibles; la de hoy se incluye aunque todavía no esté vencida.
  for (const week of weeks.filter(w => w <= paidAtDate)) {
    if (rem <= 0) break;
    const due = getUnpaidCents(week, weeklyFeeCents, paidByWeek);
    const apply = Math.min(rem, due);
    if (apply) { out.push({kind:'week', weekId:week, amountCents:apply}); rem -= apply; }
  }
  for (const week of [...futureSet].sort()) {
    if (rem <= 0) break;
    const due = getUnpaidCents(week, weeklyFeeCents, paidByWeek);
    const apply = Math.min(rem, due);
    if (apply) { out.push({kind:'week', weekId:week, amountCents:apply}); rem -= apply; }
  }
  if (rem > 0) {
    if (!leftoverDestination) throw new Error('Debes elegir destino del excedente: crédito o aporte voluntario');
    out.push({kind:leftoverDestination, amountCents:rem});
  }
  if (out.reduce((s, x) => s+x.amountCents,0) !== amountCents) throw new Error('Descuadre');
  return out;
}

export function formatPEN(amountCents: number): string {
  if (!Number.isSafeInteger(amountCents)) throw new Error('Importe inválido');
  return new Intl.NumberFormat('es-PE',{style:'currency',currency:'PEN'}).format(amountCents/100);
}
export function progressPercent(cashCents: number, goalCents: number | null): number | null {
  if (goalCents === null || goalCents <= 0) return null;
  return Math.max(0, Math.min(100, Math.round(cashCents/goalCents*1000)/10));
}
