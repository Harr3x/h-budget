let toastTimer = null;

export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 1800);
}

export function openSheet(html, onMount) {
  closeSheet();
  const bg = document.createElement('div');
  bg.className = 'sheet-bg';
  bg.id = 'sheet-bg';
  bg.innerHTML = `<div class="sheet" onclick="event.stopPropagation()">${html}</div>`;
  bg.addEventListener('click', closeSheet);
  document.body.appendChild(bg);
  if (onMount) onMount(bg.querySelector('.sheet'));
}
export function closeSheet() {
  const bg = document.getElementById('sheet-bg');
  if (bg) bg.remove();
}
