export const eurFmt = new Intl.NumberFormat('de-DE', {
  style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2,
});
export const dateFmt = new Intl.DateTimeFormat('de-DE');
export const monthFmt = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });
export const dayFmt   = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: 'long' });

export function formatEUR(cents) {
  return eurFmt.format((cents || 0) / 100);
}
export function formatDateIso(iso) {
  return dateFmt.format(new Date(iso + 'T00:00:00'));
}
export function formatYearMonth(ym) {
  return monthFmt.format(new Date(ym + '-01T00:00:00'));
}
export function formatDayHeader(iso) {
  return dayFmt.format(new Date(iso + 'T00:00:00'));
}

export const MONTH_SHORT = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
export function shortMonthLabel(ym) {
  const m = parseInt(ym.slice(5, 7), 10);
  return MONTH_SHORT[m - 1] || ym;
}

export function parseEURInput(str) {
  if (str == null) return null;
  let s = String(str).trim().replace(/\s/g, '').replace(/€/g, '').trim();
  if (!s) return null;
  if (!/^-?[\d.,]+$/.test(s)) return null;

  let cleaned;
  if (s.includes(',')) {
    cleaned = s.replace(/\./g, '').replace(',', '.');
  } else {
    const parts = s.split('.');
    if (parts.length === 1) {
      cleaned = s;
    } else {
      const last = parts[parts.length - 1];
      if (last.length === 3) {
        cleaned = parts.join('');
      } else if (last.length === 1 || last.length === 2) {
        cleaned = parts.slice(0, -1).join('') + '.' + last;
      } else {
        return null;
      }
    }
  }
  const n = parseFloat(cleaned);
  if (isNaN(n)) return null;
  return Math.round(n * 100);
}

export function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
export function escapeAttr(s) { return escapeHtml(s); }
