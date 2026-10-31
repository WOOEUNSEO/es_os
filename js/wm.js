// 창 관리자: 열기, 포커스, 드래그, 크기 조절, 최소화, 확대, 닫기
const MENUBAR = 30;
const DOCK_SPACE = 92;

const wins = new Map();
let zTop = 100;
let cascade = 0;
let focused = null;

const changeFns = new Set();
export const onWinChange = (fn) => (changeFns.add(fn), () => changeFns.delete(fn));
const changed = () => changeFns.forEach((f) => f());

export const isMobile = () => matchMedia('(max-width: 720px)').matches;
export const getWindow = (id) => wins.get(id);
export const focusedWin = () => (focused && wins.has(focused.id) ? focused : null);
export const windowsOf = (app) => [...wins.values()].filter((w) => w.app === app);
export const allWindows = () => [...wins.values()];

const layer = () => document.getElementById('windows');

export function openWindow(opts) {
  const id = opts.id || 'w' + Math.random().toString(36).slice(2, 9);
  if (wins.has(id)) {
    const w = wins.get(id);
    restore(w);
    focus(w);
    return w;
  }
  const el = document.createElement('section');
  el.className = `win opening ${opts.className || ''}`;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', opts.title);
  el.innerHTML = `
    <div class="lights">
      <button class="l-close" aria-label="닫기" title="닫기"></button>
      <button class="l-min" aria-label="최소화" title="최소화"></button>
      <button class="l-max" aria-label="크게 보기" title="크게 보기"></button>
    </div>
    <div class="win-body"></div>
    <div class="win-resize" aria-hidden="true"></div>`;

  const vw = innerWidth, vh = innerHeight;
  const w = Math.min(opts.w || 720, vw - 32);
  const h = Math.min(opts.h || 480, vh - MENUBAR - DOCK_SPACE - 16);
  const off = (cascade++ % 6) * 26;
  const x = Math.max(12, Math.round((vw - w) / 2 - 80 + off));
  const y = Math.max(MENUBAR + 10, Math.round((vh - DOCK_SPACE - h) / 2 - 10 + off * 0.6));
  Object.assign(el.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });

  const win = {
    id, app: opts.app, title: opts.title, el,
    body: el.querySelector('.win-body'),
    minW: opts.minW || 360, minH: opts.minH || 240,
    minimized: false, maximized: false, prev: null,
    cleanups: [], onKey: null,
  };
  wins.set(id, win);
  layer().appendChild(el);
  el.addEventListener('animationend', () => el.classList.remove('opening'), { once: true });

  el.querySelector('.l-close').onclick = (e) => (e.stopPropagation(), close(win));
  el.querySelector('.l-min').onclick = (e) => (e.stopPropagation(), minimize(win));
  el.querySelector('.l-max').onclick = (e) => (e.stopPropagation(), toggleMax(win));
  el.addEventListener('pointerdown', () => focus(win), true);

  setupDrag(win);
  setupResize(win);
  focus(win);
  return win;
}

export function focus(win) {
  if (!win || !wins.has(win.id)) return;
  if (focused !== win || win.el.style.zIndex < zTop) win.el.style.zIndex = ++zTop;
  wins.forEach((w) => w.el.classList.toggle('focused', w === win));
  focused = win;
  changed();
}

export function blurAll() {
  if (!focused) return;
  focused = null;
  wins.forEach((w) => w.el.classList.remove('focused'));
  changed();
}

export function close(win) {
  if (!wins.has(win.id)) return;
  wins.delete(win.id);
  win.cleanups.forEach((f) => f());
  win.el.classList.add('closing');
  setTimeout(() => win.el.remove(), 180);
  if (focused === win) {
    focused = null;
    const next = [...wins.values()].filter((w) => !w.minimized).sort((a, b) => b.el.style.zIndex - a.el.style.zIndex)[0];
    if (next) focus(next);
  }
  changed();
}

function dockTarget(win) {
  const t = document.querySelector(`#dock [data-app="${win.app}"]`);
  return t?.getBoundingClientRect();
}

export function minimize(win) {
  if (win.minimized) return;
  const r = win.el.getBoundingClientRect();
  const t = dockTarget(win);
  const dx = t ? t.left + t.width / 2 - (r.left + r.width / 2) : 0;
  const dy = t ? t.top + t.height / 2 - (r.top + r.height / 2) : innerHeight;
  win.el.classList.add('minimizing');
  win.el.style.transform = `translate(${dx}px, ${dy}px) scale(.08)`;
  win.el.style.opacity = '0';
  win.minimized = true;
  setTimeout(() => {
    if (win.minimized) win.el.classList.add('hidden');
  }, 380);
  if (focused === win) {
    focused = null;
    wins.forEach((w) => w.el.classList.remove('focused'));
  }
  changed();
}

export function restore(win) {
  if (!win.minimized) return;
  win.minimized = false;
  win.el.classList.remove('hidden');
  requestAnimationFrame(() => {
    win.el.style.transform = '';
    win.el.style.opacity = '';
    setTimeout(() => win.el.classList.remove('minimizing'), 400);
  });
  focus(win);
}

export function toggleMax(win) {
  if (isMobile()) return;
  const s = win.el.style;
  win.el.classList.add('animating');
  if (win.maximized) {
    Object.assign(s, win.prev);
    win.maximized = false;
  } else {
    win.prev = { left: s.left, top: s.top, width: s.width, height: s.height };
    Object.assign(s, {
      left: '8px', top: MENUBAR + 8 + 'px',
      width: innerWidth - 16 + 'px',
      height: innerHeight - MENUBAR - DOCK_SPACE - 8 + 'px',
    });
    win.maximized = true;
  }
  win.el.classList.toggle('maximized', win.maximized);
  setTimeout(() => win.el.classList.remove('animating'), 320);
}

function setupDrag(win) {
  const el = win.el;
  el.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('[data-drag]');
    if (!handle || e.button !== 0 || isMobile()) return;
    if (e.target.closest('button, input, textarea, select, a, [contenteditable], .no-drag')) return;
    const sx = e.clientX, sy = e.clientY;
    const ox = el.offsetLeft, oy = el.offsetTop;
    let moved = false;
    const mv = (ev) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return;
      if (!moved && win.maximized) {
        // 확대된 창을 끌면 원래 크기로 돌아옵니다.
        const pw = parseFloat(win.prev.width);
        win.maximized = false;
        el.classList.remove('maximized');
        el.style.width = win.prev.width;
        el.style.height = win.prev.height;
        const ratio = (sx - ox) / el.offsetWidth || 0.5;
        win._ox = sx - pw * Math.min(ratio, 1);
      }
      moved = true;
      const baseX = win._ox ?? ox;
      el.style.left = Math.min(innerWidth - 80, Math.max(80 - el.offsetWidth, baseX + dx)) + 'px';
      el.style.top = Math.min(innerHeight - 60, Math.max(MENUBAR, oy + dy)) + 'px';
      el.classList.add('dragging');
    };
    const up = () => {
      delete win._ox;
      el.classList.remove('dragging');
      removeEventListener('pointermove', mv);
      removeEventListener('pointerup', up);
    };
    addEventListener('pointermove', mv);
    addEventListener('pointerup', up);
  });
  el.addEventListener('dblclick', (e) => {
    if (e.target.closest('[data-drag]') && !e.target.closest('button, input, textarea, .no-drag, .fitem, .note-item')) toggleMax(win);
  });
}

function setupResize(win) {
  const h = win.el.querySelector('.win-resize');
  h.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const sx = e.clientX, sy = e.clientY;
    const sw = win.el.offsetWidth, sh = win.el.offsetHeight;
    win.maximized = false;
    win.el.classList.remove('maximized');
    const mv = (ev) => {
      win.el.style.width = Math.max(win.minW, sw + ev.clientX - sx) + 'px';
      win.el.style.height = Math.max(win.minH, sh + ev.clientY - sy) + 'px';
    };
    const up = () => {
      removeEventListener('pointermove', mv);
      removeEventListener('pointerup', up);
    };
    addEventListener('pointermove', mv);
    addEventListener('pointerup', up);
  });
}

// 브라우저 크기가 바뀌면 창이 화면 밖으로 나가지 않게 합니다.
addEventListener('resize', () => {
  wins.forEach((w) => {
    const el = w.el;
    if (w.maximized) {
      el.style.width = innerWidth - 16 + 'px';
      el.style.height = innerHeight - MENUBAR - DOCK_SPACE - 8 + 'px';
      return;
    }
    if (el.offsetLeft > innerWidth - 80) el.style.left = innerWidth - el.offsetWidth - 12 + 'px';
    if (el.offsetTop > innerHeight - 80) el.style.top = MENUBAR + 10 + 'px';
  });
});

// 포커스된 창에 키보드 이벤트 전달
addEventListener('keydown', (e) => {
  const w = focusedWin();
  if (!w || w.minimized) return;
  if (e.target.closest?.('input, textarea, [contenteditable]')) return;
  w.onKey?.(e);
});
