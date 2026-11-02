// 웹 앱: GitHub Pages · Render 등으로 만든 내 웹사이트를 es OS 창 안에서 앱처럼 연다.
import * as S from '../store.js';
import { openWindow, getWindow, focus, restore } from '../wm.js';
import { I } from '../icons.js';
import { esc } from '../ui.js';

export const DEFAULT_WEB_APPS = [
  { id: 'scheduler', name: '부티크 스케줄러', url: 'https://the-boutique-scheduler.onrender.com/', color: '#e0675a' },
];

export const webApps = () => (Array.isArray(S.state.settings.webApps) ? S.state.settings.webApps : DEFAULT_WEB_APPS);
export const webAppById = (id) => webApps().find((a) => a.id === id);

export function openWebApp(id) {
  const app = webAppById(id);
  if (!app) return null;
  const wid = `web-${app.id}`;
  const ex = getWindow(wid);
  if (ex) { restore(ex); focus(ex); return ex; }
  const win = openWindow({ id: wid, app: `web:${app.id}`, title: app.name, w: 1100, h: 700, minW: 420, minH: 300, className: 'webapp' });
  let host = '';
  try { host = new URL(app.url).host; } catch {}
  win.body.innerHTML = `
    <header class="toolbar web-bar" data-drag>
      <div class="web-addr" data-drag>${I.globe}<span>${esc(host || app.url)}</span></div>
      <div class="tb-spacer"></div>
      <button class="tb reload" title="새로고침" aria-label="새로고침">${I.refresh}</button>
      <a class="tb ext" href="${esc(app.url)}" target="_blank" rel="noopener noreferrer" title="새 탭에서 열기" aria-label="새 탭에서 열기">${I.external}</a>
    </header>
    <div class="web-frame">
      <div class="web-loading">불러오는 중…<small>오래 걸리면 오른쪽 위 ↗ 버튼으로 새 탭에서 열어 주세요.</small></div>
      <iframe src="${esc(app.url)}" title="${esc(app.name)}" allow="clipboard-write; fullscreen" referrerpolicy="no-referrer-when-downgrade"></iframe>
    </div>`;
  const frame = win.body.querySelector('iframe');
  const loading = win.body.querySelector('.web-loading');
  frame.addEventListener('load', () => loading.classList.add('done'));
  win.body.querySelector('.reload').onclick = () => { loading.classList.remove('done'); frame.src = app.url; };
  // 창을 옮기거나 크기를 바꿀 때 iframe이 마우스를 가로채지 않게
  win.el.addEventListener('pointerdown', (e) => { if (e.target.closest('[data-drag], .win-resize')) win.el.classList.add('web-dragging'); }, true);
  window.addEventListener('pointerup', () => win.el.classList.remove('web-dragging'));
  return win;
}
