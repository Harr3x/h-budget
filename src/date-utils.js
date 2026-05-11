export function todayIso() {
  const d = new Date();
  return isoFromDate(d);
}
export function isoFromDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export function todayYearMonth() {
  return todayIso().slice(0, 7);
}
export function yearMonthOf(iso) {
  return iso.slice(0, 7);
}
export function nextYearMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}
export function prevYearMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, '0')}`;
}
export function lastDayOfMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}
export function isoForYmDay(ym, day) {
  const last = lastDayOfMonth(ym);
  const d = Math.min(day, last);
  return `${ym}-${String(d).padStart(2, '0')}`;
}
