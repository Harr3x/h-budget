import { state } from './state.js';
import { monthlyTotalsForLastN } from './queries.js';
import { shortMonthLabel } from './formatters.js';

export function shiftColor(hex, factor) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = factor < 0 ? 0 : 255;
  const f = Math.abs(factor);
  const nr = Math.round(r + (mix - r) * f);
  const ng = Math.round(g + (mix - g) * f);
  const nb = Math.round(b + (mix - b) * f);
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

export function renderPotPieSVG(slices, size = 160) {
  const valid = slices.filter(s => s.value > 0);
  const total = valid.reduce((s, x) => s + x.value, 0);
  const r = size / 2;
  if (total === 0) return '';
  if (valid.length === 1) {
    return `<svg class="pot-pie-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${r}" cy="${r}" r="${r - 1}" fill="${valid[0].color}"></circle>
    </svg>`;
  }
  let acc = 0;
  const paths = valid.map(s => {
    const start = acc / total;
    acc += s.value;
    const end = acc / total;
    const a0 = start * 2 * Math.PI - Math.PI / 2;
    const a1 = end * 2 * Math.PI - Math.PI / 2;
    const x0 = r + r * Math.cos(a0);
    const y0 = r + r * Math.sin(a0);
    const x1 = r + r * Math.cos(a1);
    const y1 = r + r * Math.sin(a1);
    const large = (end - start) > 0.5 ? 1 : 0;
    return `<path d="M ${r} ${r} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z" fill="${s.color}" stroke="var(--bg)" stroke-width="2"></path>`;
  }).join('');
  return `<svg class="pot-pie-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${paths}</svg>`;
}

export function renderHistoryBarChart() {
  const months = monthlyTotalsForLastN(6);
  const totalAll = months.reduce((s, m) => s + m.total, 0);
  if (totalAll === 0) return '';

  const closed = months.filter(m => !m.isCurrent);
  const closedSum = closed.reduce((s, m) => s + m.total, 0);
  const closedNonZero = closed.filter(m => m.total > 0);
  const avg = closedNonZero.length >= 2
    ? Math.round(closedSum / closed.length)
    : null;

  const W = 320, H = 130;
  const padL = 8, padR = 8, padT = 12, padB = 24;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const n = months.length;
  const slot = chartW / n;
  const barW = Math.min(28, slot * 0.6);
  const maxVal = Math.max(...months.map(m => m.total), avg || 0);
  const scale = maxVal > 0 ? chartH / maxVal : 0;

  const bars = months.map((m, i) => {
    const cx = padL + slot * (i + 0.5);
    const h = m.total * scale;
    const x = cx - barW / 2;
    const y = padT + chartH - h;
    const income = state.monthlyIncomes[m.ym] != null ? state.monthlyIncomes[m.ym] : state.income;
    const fill = m.isCurrent ? 'var(--accent)' : m.total > income ? 'var(--danger)' : '#5dd39e';
    const labelY = padT + chartH + 14;
    return `
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW}" height="${Math.max(0, h).toFixed(1)}" rx="3" fill="${fill}"></rect>
      <text x="${cx.toFixed(1)}" y="${labelY}" text-anchor="middle" font-size="10" fill="var(--fg-faint)">${shortMonthLabel(m.ym)}</text>
    `;
  }).join('');

  let avgLine = '';
  if (avg != null && avg > 0) {
    const y = padT + chartH - avg * scale;
    avgLine = `
      <line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}"
            stroke="var(--fg-faint)" stroke-width="1" stroke-dasharray="4 3"></line>
    `;
  }

  return `<svg class="history-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
    ${avgLine}
    ${bars}
  </svg>`;
}
