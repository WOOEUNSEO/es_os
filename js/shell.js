// 바탕화면 껍데기: 메뉴 막대, Dock, 데스크탑 아이콘, 위젯, 검색, 잠금 화면
import * as S from './store.js';
import { I, appIcon, fileIcon, tagColor } from './icons.js';
import { APPS, launch } from './apps.js';
import { onWinChange, focusedWin, windowsOf, close, blurAll, allWindows } from './wm.js';
import {
  esc, showMenu, closeMenu, menuOpen, startRename, setDragIds, makeDropTarget,
  isInternalDrag, getDragIds, openNode, itemMenuItems, importFiles, pickFiles, confirmDialog,
} from './ui.js';
import { openFinder } from './apps/finder.js';
import { openNotes } from './apps/notes.js';
import { openSettings } from './apps/settings.js';
import { openCalendar } from './apps/calendar.js';
import { resolvedTheme } from './appearance.js';

const $ = (s) => document.querySelector(s);
const fmtClock = (d, opts = {}) =>
  d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit', hour12: !S.state.settings.clock24, ...opts });

/* =================== 메뉴 막대 =================== */
let openKey = null;

function currentApp() {
  return focusedWin()?.app || 'finder';
}

function menuFor(key) {
  const w = focusedWin();
  const app = currentApp();
  const finder = w?.app === 'finder' ? w.finder : null;
  const theme = S.state.settings.theme;
  switch (key) {
    case 'logo':
      return [
        { label: 'es OS에 관하여', icon: I.info, action: () => openSettings('about') },
        { sep: true },
        { label: '시스템 설정…', icon: I.palette, action: () => openSettings() },
        { sep: true },
        { label: '모든 창 닫기', icon: I.x, disabled: !allWindows().length, action: () => allWindows().forEach(close) },
        { label: '잠금 화면', icon: I.user, action: lock },
      ];
    case 'app':
      return [
        { label: `${APPS[app].name}에 관하여`, icon: I.info, action: () => openSettings('about') },
        { sep: true },
        app === 'finder' ? { label: '새로운 Finder 윈도우', icon: I.folderPlus, action: () => openFinder() } : null,
        { label: `${APPS[app].name} 종료`, icon: I.x, disabled: !windowsOf(app).length, action: () => windowsOf(app).forEach(close) },
      ];
    case 'file':
      return [
        { label: '새로운 Finder 윈도우', icon: I.folderPlus, action: () => openFinder() },
        {
          label: '새로운 폴더', icon: I.folderPlus,
          action: () => (finder?.realFolder() && finder.realFolder() !== 'trash' ? finder.newFolder() : newDesktopItem('folder')),
        },
        { label: '새로운 메모', icon: I.compose, action: () => openNotes(S.create('documents', { name: '새로운 메모.txt', kind: 'text' }).id) },
        {
          label: '파일 가져오기…', icon: I.upload,
          action: async () => {
            const files = await pickFiles();
            const pid = finder?.realFolder();
            if (files?.length) importFiles(files, pid && pid !== 'trash' ? pid : 'downloads');
          },
        },
        { sep: true },
        { label: '창 닫기', icon: I.x, disabled: !w, action: () => w && close(w) },
      ];
    case 'view':
      return [
        { label: '라이트 모드', checked: theme === 'light', action: () => S.setSetting('theme', 'light') },
        { label: '다크 모드', checked: theme === 'dark', action: () => S.setSetting('theme', 'dark') },
        { label: '시스템 설정 따르기', checked: theme === 'auto', action: () => S.setSetting('theme', 'auto') },
        { sep: true },
        { label: '데스크탑 위젯', checked: S.state.settings.showWidgets, action: () => S.setSetting('showWidgets', !S.state.settings.showWidgets) },
        { sep: true },
        { label: 'Finder: 아이콘으로 보기', checked: S.state.settings.finderView === 'grid', action: () => S.setSetting('finderView', 'grid') },
        { label: 'Finder: 목록으로 보기', checked: S.state.settings.finderView === 'list', action: () => S.setSetting('finderView', 'list') },
      ];
  }
  return [];
}

function openMenubarMenu(btn) {
  const key = btn.dataset.menu;
  document.querySelectorAll('#menubar [data-menu]').forEach((b) => b.classList.toggle('active', b === btn));
  openKey = key;
  showMenu(0, 0, menuFor(key), {
    anchor: btn.getBoundingClientRect(),
    onClose: () => {
      openKey = null;
      document.querySelectorAll('#menubar [data-menu]').forEach((b) => b.classList.remove('active'));
    },
  });
}

function initMenubar() {
  const mb = $('#menubar');
  mb.innerHTML = `
    <button class="mb-btn mb-logo" data-menu="logo" data-menu-trigger aria-label="es OS 메뉴"><span class="logo"></span></button>
    <button class="mb-btn mb-app" data-menu="app" data-menu-trigger><b></b></button>
    <button class="mb-btn" data-menu="file" data-menu-trigger>파일</button>
    <button class="mb-btn" data-menu="view" data-menu-trigger>보기</button>
    <div class="mb-right">
      <span class="mb-bat" hidden></span>
      <button class="mb-btn mb-theme" aria-label="라이트/다크 전환"></button>
      <button class="mb-btn mb-search" aria-label="검색 (Ctrl+K)" title="검색 (Ctrl+K)">${I.search}</button>
      <button class="mb-btn mb-clock" aria-label="캘린더 열기"></button>
    </div>`;
  mb.querySelectorAll('[data-menu]').forEach((b) => {
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (openKey === b.dataset.menu) closeMenu();
      else openMenubarMenu(b);
    });
    b.addEventListener('pointerenter', () => openKey && openKey !== b.dataset.menu && openMenubarMenu(b));
    b.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), openMenubarMenu(b)));
  });
  mb.querySelector('.mb-search').onclick = () => openSpotlight();
  mb.querySelector('.mb-clock').onclick = () => openCalendar();
  mb.querySelector('.mb-theme').onclick = () => S.setSetting('theme', resolvedTheme() === 'dark' ? 'light' : 'dark');

  const updateApp = () => (mb.querySelector('.mb-app b').textContent = APPS[currentApp()].name);
  const updateTheme = () => (mb.querySelector('.mb-theme').innerHTML = resolvedTheme() === 'dark' ? I.moon : I.sun);
  onWinChange(updateApp);
  S.on('settings', () => (updateTheme(), tick()));
  updateApp();
  updateTheme();

  const tick = () => {
    const d = new Date();
    mb.querySelector('.mb-clock').textContent =
      `${d.getMonth() + 1}월 ${d.getDate()}일 (${'일월화수목금토'[d.getDay()]}) ${fmtClock(d)}`;
    updateLock();
  };
  tick();
  setInterval(tick, 5000);

  // 배터리 (지원하는 브라우저에서만 표시)
  navigator.getBattery?.().then((b) => {
    const el = mb.querySelector('.mb-bat');
    const upd = () => {
      el.hidden = false;
      el.innerHTML = `${Math.round(b.level * 100)}% ${I.battery}`;
      el.title = b.charging ? '충전 중' : '배터리';
      const fill = el.querySelector('.bat-fill');
      fill.setAttribute('width', String(Math.max(1.5, 18 * b.level)));
      el.classList.toggle('low', b.level < 0.2 && !b.charging);
    };
    upd();
    b.addEventListener('levelchange', upd);
    b.addEventListener('chargingchange', upd);
  }).catch(() => {});
}

/* =================== Dock =================== */
const DOCK_APPS = ['finder', 'notes', 'photos', 'calendar', 'settings'];

function initDock() {
  const dock = $('#dock');
  dock.innerHTML =
    DOCK_APPS.map((a) => `<button class="dock-item" data-app="${a}" aria-label="${APPS[a].name}"><span class="dock-label">${APPS[a].name}</span>${appIcon(a)}<span class="dot"></span></button>`).join('') +
    `<span class="dock-sep"></span><button class="dock-item" data-app="trash" aria-label="휴지통"><span class="dock-label">휴지통</span><span class="trash-ic"></span></button>`;

  dock.querySelectorAll('.dock-item').forEach((b) => {
    b.onclick = () => {
      if (b.dataset.app === 'trash') return openFinder('trash');
      const { reopened } = launch(b.dataset.app);
      if (!reopened) {
        b.classList.remove('bounce');
        void b.offsetWidth;
        b.classList.add('bounce');
      }
    };
  });
  makeDropTarget(dock.querySelector('[data-app="trash"]'), () => 'trash');

  const updateTrash = () =>
    (dock.querySelector('.trash-ic').innerHTML = appIcon(S.children('trash').length ? 'trash-full' : 'trash'));
  const updateDots = () =>
    dock.querySelectorAll('.dock-item[data-app]').forEach((b) => b.classList.toggle('running', windowsOf(b.dataset.app).length > 0));
  updateTrash();
  updateDots();
  S.on('fs', updateTrash);
  onWinChange(updateDots);

  // 자정이 지나면 캘린더 아이콘 날짜를 바꿉니다.
  let day = new Date().getDate();
  setInterval(() => {
    if (new Date().getDate() !== day) {
      day = new Date().getDate();
      const c = dock.querySelector('[data-app="calendar"] .appicon');
      c.outerHTML = appIcon('calendar');
    }
  }, 60000);

  // 마우스를 올리면 아이콘이 커지는 효과
  const items = [...dock.querySelectorAll('.dock-item')];
  let raf = 0;
  dock.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      dock.classList.add('magnify');
      items.forEach((it) => {
        const r = it.getBoundingClientRect();
        const d = Math.abs(e.clientX - (r.left + r.width / 2));
        const s = 1 + 0.42 * Math.max(0, Math.cos(Math.min(d / 150, 1) * (Math.PI / 2))) ** 1.4;
        it.style.setProperty('--s', s.toFixed(3));
      });
    });
  });
  dock.addEventListener('pointerleave', () => {
    cancelAnimationFrame(raf);
    dock.classList.remove('magnify');
    items.forEach((it) => it.style.setProperty('--s', 1));
  });
}

/* =================== 데스크탑 아이콘 =================== */
const desk = { sel: new Set() };

function newDesktopItem(kind) {
  const n = kind === 'folder'
    ? S.create('desktop', { type: 'folder', name: '새로운 폴더' })
    : S.create('desktop', { name: '새로운 문서.txt', kind: 'text' });
  desk.sel = new Set([n.id]);
  renderDesktop();
  renameDesk(n.id);
}
function renameDesk(id) {
  const el = document.querySelector(`#desk-icons [data-id="${id}"] .fname`);
  if (el) startRename(el, S.node(id));
}

function renderDesktop() {
  const wrap = $('#desk-icons');
  const list = S.children('desktop');
  [...desk.sel].forEach((id) => !list.some((n) => n.id === id) && desk.sel.delete(id));
  wrap.innerHTML = list.map((n) => `
    <div class="dicon ${n.type === 'folder' ? 'is-folder' : ''} ${desk.sel.has(n.id) ? 'sel' : ''}" data-id="${n.id}" draggable="true" tabindex="-1" title="${esc(n.name)}">
      <div class="fi-icon">${fileIcon(n)}</div>
      <div class="fname">${esc(n.name)}</div>
      ${n.tag ? `<span class="tagdot" style="--c:${tagColor(n.tag)}"></span>` : ''}
    </div>`).join('');
}
const paintDesk = () => document.querySelectorAll('#desk-icons .dicon').forEach((el) => el.classList.toggle('sel', desk.sel.has(el.dataset.id)));

function initDesktop() {
  const area = $('#desktop');
  const wrap = $('#desk-icons');

  area.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.widget, .rename')) return;
    const it = e.target.closest('.dicon');
    blurAll();
    if (!it) {
      if (e.button === 0) (desk.sel.clear(), paintDesk());
      return;
    }
    const id = it.dataset.id;
    if (e.metaKey || e.ctrlKey) desk.sel.has(id) ? desk.sel.delete(id) : desk.sel.add(id);
    else if (!desk.sel.has(id)) desk.sel = new Set([id]);
    paintDesk();
  });
  area.addEventListener('dblclick', (e) => {
    const it = e.target.closest('.dicon');
    if (it) openNode(it.dataset.id);
  });
  area.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.widget')) return;
    e.preventDefault();
    const it = e.target.closest('.dicon');
    if (it) {
      if (!desk.sel.has(it.dataset.id)) (desk.sel = new Set([it.dataset.id])), paintDesk();
      const ids = [...desk.sel];
      showMenu(e.clientX, e.clientY, itemMenuItems(ids, { rename: () => renameDesk(ids[0]) }));
    } else {
      showMenu(e.clientX, e.clientY, [
        { label: '새로운 폴더', icon: I.folderPlus, action: () => newDesktopItem('folder') },
        { label: '새로운 텍스트 문서', icon: I.doc, action: () => newDesktopItem('text') },
        { label: '파일 가져오기…', icon: I.upload, action: async () => { const f = await pickFiles(); if (f?.length) importFiles(f, 'desktop'); } },
        { sep: true },
        { label: '배경화면 변경…', icon: I.wallpaper, action: () => openSettings('wallpaper') },
        { label: S.state.settings.showWidgets ? '위젯 숨기기' : '위젯 보기', icon: I.calendar, action: () => S.setSetting('showWidgets', !S.state.settings.showWidgets) },
      ]);
    }
  });

  wrap.addEventListener('dragstart', (e) => {
    const it = e.target.closest('.dicon');
    if (!it) return;
    if (!desk.sel.has(it.dataset.id)) (desk.sel = new Set([it.dataset.id])), paintDesk();
    setDragIds(e, [...desk.sel]);
    e.dataTransfer.setDragImage(it.querySelector('.fi-icon'), 30, 26);
  });

  // 폴더 아이콘 위에 놓으면 그 폴더로, 빈 곳에 놓으면 데스크탑으로
  let over = null;
  const setOver = (el) => {
    if (over === el) return;
    over?.classList.remove('drop-over');
    over = el;
    over?.classList.add('drop-over');
  };
  area.addEventListener('dragover', (e) => {
    if (!isInternalDrag(e) && !e.dataTransfer.types.includes('Files')) return;
    if (e.target.closest('.widget')) return;
    e.preventDefault();
    const f = e.target.closest('.dicon.is-folder');
    setOver(f || null);
    area.classList.toggle('drop-desk', !f);
  });
  area.addEventListener('dragleave', (e) => {
    if (!area.contains(e.relatedTarget)) (setOver(null), area.classList.remove('drop-desk'));
  });
  area.addEventListener('drop', async (e) => {
    e.preventDefault();
    const pid = over?.dataset.id || 'desktop';
    setOver(null);
    area.classList.remove('drop-desk');
    if (isInternalDrag(e)) (getDragIds(e) || []).forEach((id) => S.move(id, pid));
    else if (e.dataTransfer.files.length) {
      const made = await importFiles(e.dataTransfer.files, pid);
      desk.sel = new Set(made.map((n) => n.id));
      renderDesktop();
    }
  });

  // 창이 선택되지 않았을 때 데스크탑 단축키
  addEventListener('keydown', (e) => {
    if (focusedWin() || menuOpen() || !desk.sel.size) return;
    if (e.target.closest?.('input, textarea')) return;
    if (!$('#lock').hidden || !$('#spotlight').hidden) return;
    if (e.key === 'Delete' || e.key === 'Backspace') (e.preventDefault(), [...desk.sel].forEach((id) => S.trash(id)));
    if (e.key === 'Enter' && desk.sel.size === 1) (e.preventDefault(), renameDesk([...desk.sel][0]));
  });

  S.on('fs', renderDesktop);
  renderDesktop();
}

/* =================== 위젯 =================== */
function initWidgets() {
  const box = $('#widgets');
  box.innerHTML = `
    <section class="widget w-date glass" aria-label="날짜">
      <div class="wd-day"></div><div class="wd-num"></div><div class="wd-sub"></div>
    </section>
    <section class="widget w-todo" aria-label="할 일">
      <h5>오늘 할 일 <span class="todo-count"></span></h5>
      <ul class="todo-list"></ul>
      <form class="todo-add"><input placeholder="+ 할 일 추가" maxlength="40" aria-label="할 일 추가"></form>
    </section>`;

  const date = box.querySelector('.w-date');
  date.onclick = () => openCalendar();
  const renderDate = () => {
    const d = new Date();
    const evs = S.eventsOn(S.dateKey(d));
    date.querySelector('.wd-day').textContent = `${'일월화수목금토'[d.getDay()]}요일`;
    date.querySelector('.wd-num').textContent = d.getDate();
    date.querySelector('.wd-sub').innerHTML = `${d.getMonth() + 1}월 · ${fmtClock(d)}<br>${evs.length ? `<span class="wd-ev">${esc(evs[0].title)}</span>${evs.length > 1 ? ` 외 ${evs.length - 1}개` : ''}` : '오늘 일정 없음'}`;
  };

  const list = box.querySelector('.todo-list');
  const renderTodos = () => {
    const t = S.state.todos;
    box.querySelector('.todo-count').textContent = t.length ? `${t.filter((x) => x.done).length}/${t.length}` : '';
    list.innerHTML = t.length
      ? t.map((x) => `<li class="${x.done ? 'done' : ''}" data-id="${x.id}"><button class="chk" aria-label="${x.done ? '완료 취소' : '완료'}">${x.done ? I.check : ''}</button><span>${esc(x.text)}</span><button class="rm" aria-label="삭제">${I.x}</button></li>`).join('')
      : '<li class="none">할 일이 없어요 🎉</li>';
  };
  list.onclick = (e) => {
    const li = e.target.closest('li[data-id]');
    if (!li) return;
    if (e.target.closest('.rm')) S.removeTodo(li.dataset.id);
    else S.toggleTodo(li.dataset.id);
  };
  box.querySelector('.todo-add').onsubmit = (e) => {
    e.preventDefault();
    const inp = e.target.querySelector('input');
    if (inp.value.trim()) S.addTodo(inp.value.trim());
    inp.value = '';
  };

  S.on('todos', renderTodos);
  S.on('events', renderDate);
  S.on('settings', renderDate);
  setInterval(renderDate, 15000);
  renderDate();
  renderTodos();
}

/* =================== 검색 (Spotlight) =================== */
let spotSel = 0;
let spotResults = [];

function calc(q) {
  if (!/^[\d\s+\-*/().%^×÷,]+$/.test(q) || !/\d/.test(q) || !/[+\-*/%^×÷]/.test(q)) return null;
  try {
    const expr = q.replace(/×/g, '*').replace(/÷/g, '/').replace(/\^/g, '**').replace(/,/g, '');
    const v = Function(`"use strict";return (${expr})`)();
    return Number.isFinite(v) ? Math.round(v * 1e10) / 1e10 : null;
  } catch {
    return null;
  }
}

function spotSearch(q) {
  const res = [];
  const ql = q.toLowerCase();
  const c = calc(q);
  if (c !== null) res.push({ icon: `<span class="calc-ic">=</span>`, title: c.toLocaleString('ko-KR'), sub: '계산 결과 · Enter로 복사', run: () => navigator.clipboard?.writeText(String(c)) });
  if (!q) {
    Object.entries(APPS).forEach(([k, a]) => res.push({ icon: appIcon(k), title: a.name, sub: '앱', run: () => launch(k) }));
    return res;
  }
  Object.entries(APPS).forEach(([k, a]) => {
    if ((a.name + ' ' + a.keywords).toLowerCase().includes(ql)) res.push({ icon: appIcon(k), title: a.name, sub: '앱', run: () => launch(k) });
  });
  const extra = [
    ['다크 모드', '다크 dark 어둡게 테마', () => S.setSetting('theme', 'dark')],
    ['라이트 모드', '라이트 light 밝게 테마', () => S.setSetting('theme', 'light')],
    ['배경화면 변경', '배경화면 wallpaper 바탕화면', () => openSettings('wallpaper')],
    ['휴지통 열기', '휴지통 trash', () => openFinder('trash')],
    ['백업 내보내기', '백업 backup 데이터', () => openSettings('data')],
  ];
  extra.forEach(([t, kw, run]) => (t + kw).toLowerCase().includes(ql) && res.push({ icon: `<span class="cmd-ic">${I.right}</span>`, title: t, sub: '바로가기', run }));
  S.allNodes((n) => n.name.toLowerCase().includes(ql))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, 8)
    .forEach((n) => res.push({ icon: fileIcon(n), title: n.name, sub: S.pathOf(n.parent), run: () => openNode(n.id) }));
  S.state.events
    .filter((e) => e.title.toLowerCase().includes(ql))
    .slice(0, 3)
    .forEach((e) => res.push({ icon: appIcon('calendar'), title: e.title, sub: `일정 · ${e.date}`, run: () => openCalendar() }));
  return res.slice(0, 12);
}

function renderSpot() {
  const box = $('#spotlight .spot-results');
  box.innerHTML = spotResults.length
    ? spotResults.map((r, i) => `<button class="spot-item ${i === spotSel ? 'on' : ''}" data-i="${i}"><span class="spot-ic">${r.icon}</span><span class="spot-t"><b>${esc(r.title)}</b><small>${esc(r.sub)}</small></span></button>`).join('')
    : '<div class="empty small">일치하는 항목이 없어요.</div>';
  box.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
}

export function openSpotlight() {
  const sp = $('#spotlight');
  if (!$('#lock').hidden) return;
  closeMenu();
  sp.hidden = false;
  sp.classList.remove('out');
  const inp = sp.querySelector('input');
  inp.value = '';
  spotSel = 0;
  spotResults = spotSearch('');
  renderSpot();
  requestAnimationFrame(() => inp.focus());
}
function closeSpotlight() {
  const sp = $('#spotlight');
  if (sp.hidden) return;
  sp.classList.add('out');
  setTimeout(() => (sp.hidden = true), 140);
}

function initSpotlight() {
  const sp = $('#spotlight');
  sp.innerHTML = `<div class="spot glass" role="dialog" aria-label="검색">
    <label class="spot-in">${I.search}<input placeholder="앱, 파일, 계산식 검색" aria-label="검색어" autocomplete="off" spellcheck="false"></label>
    <div class="spot-results" role="listbox"></div></div>`;
  const inp = sp.querySelector('input');
  inp.addEventListener('input', () => {
    spotSel = 0;
    spotResults = spotSearch(inp.value.trim());
    renderSpot();
  });
  inp.addEventListener('keydown', (e) => {
    if (e.isComposing) return;
    if (e.key === 'ArrowDown') (e.preventDefault(), (spotSel = Math.min(spotSel + 1, spotResults.length - 1)), renderSpot());
    if (e.key === 'ArrowUp') (e.preventDefault(), (spotSel = Math.max(spotSel - 1, 0)), renderSpot());
    if (e.key === 'Enter' && spotResults[spotSel]) (closeSpotlight(), spotResults[spotSel].run());
    if (e.key === 'Escape') closeSpotlight();
  });
  sp.addEventListener('pointerdown', (e) => e.target === sp && closeSpotlight());
  sp.querySelector('.spot-results').addEventListener('click', (e) => {
    const b = e.target.closest('.spot-item');
    if (b) (closeSpotlight(), spotResults[+b.dataset.i].run());
  });
  addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      sp.hidden ? openSpotlight() : closeSpotlight();
    }
  });
}

/* =================== 잠금 화면 =================== */
function updateLock() {
  const l = $('#lock');
  if (!l || l.hidden || !l.querySelector('.lk-date')) return;
  const d = new Date();
  l.querySelector('.lk-date').textContent = d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });
  l.querySelector('.lk-time').textContent = d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit', hour12: false });
  const name = S.state.settings.name || '사용자';
  l.querySelector('.lk-name').textContent = name;
  l.querySelector('.avatar').textContent = name.trim().charAt(0).toUpperCase();
}

let onFirstUnlock = null;
function unlock() {
  const l = $('#lock');
  if (l.hidden || l.classList.contains('out')) return;
  l.classList.add('out');
  document.body.classList.remove('locked');
  setTimeout(() => {
    l.hidden = true;
    l.classList.remove('out');
    onFirstUnlock?.();
    onFirstUnlock = null;
  }, 520);
}
function lock() {
  closeMenu();
  const l = $('#lock');
  l.hidden = false;
  document.body.classList.add('locked');
  l.classList.add('in');
  setTimeout(() => l.classList.remove('in'), 500);
  updateLock();
}
function initLock(afterUnlock) {
  const l = $('#lock');
  l.innerHTML = `
    <div class="lk-top"><div class="lk-date"></div><div class="lk-time"></div></div>
    <div class="lk-user"><span class="avatar big"></span><b class="lk-name"></b><button class="lk-hint">클릭하거나 아무 키나 눌러서 시작하기</button></div>`;
  l.addEventListener('click', unlock);
  addEventListener('keydown', (e) => {
    if (!l.hidden && !e.metaKey && !e.ctrlKey) (e.preventDefault(), unlock());
  });
  let sy = null;
  l.addEventListener('touchstart', (e) => (sy = e.touches[0].clientY), { passive: true });
  l.addEventListener('touchmove', (e) => sy !== null && sy - e.touches[0].clientY > 40 && unlock(), { passive: true });
  onFirstUnlock = afterUnlock;
  document.body.classList.add('locked');
  updateLock();
  l.querySelector('.lk-hint').focus({ preventScroll: true });
}

export function initShell({ afterUnlock } = {}) {
  initMenubar();
  initDock();
  initDesktop();
  initWidgets();
  initSpotlight();
  initLock(afterUnlock);
}
