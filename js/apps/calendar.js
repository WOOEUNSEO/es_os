// 캘린더: 월 보기 + 날짜별 일정
import * as S from '../store.js';
import { openWindow, getWindow, focus, restore } from '../wm.js';
import { I } from '../icons.js';
import { esc } from '../ui.js';

const COLORS = { blue: '#4d7cfe', pink: '#ef5f97', green: '#2fb57f', orange: '#f29a2e', purple: '#9a6cf2' };

export function openCalendar() {
  const existing = getWindow('calendar');
  if (existing) return restore(existing), focus(existing), existing;

  const win = openWindow({ id: 'calendar', app: 'calendar', title: '캘린더', w: 900, h: 580, minW: 560, minH: 420, className: 'calendar' });
  const today = new Date();
  let ym = new Date(today.getFullYear(), today.getMonth(), 1);
  let selected = S.dateKey(today);
  let color = 'blue';

  win.body.innerHTML = `
    <div class="pane">
      <header class="toolbar pad-lights" data-drag>
        <div class="tb-title"><h3 class="cal-title"></h3></div>
        <div class="tb-spacer"></div>
        <div class="seg nav">
          <button class="prev" aria-label="이전 달">${I.left}</button>
          <button class="today">오늘</button>
          <button class="next" aria-label="다음 달">${I.right}</button>
        </div>
      </header>
      <div class="cal-wrap">
        <div class="cal-month">
          <div class="cal-dow">${['일', '월', '화', '수', '목', '금', '토'].map((d) => `<span>${d}</span>`).join('')}</div>
          <div class="cal-grid"></div>
        </div>
        <aside class="cal-side">
          <h4 class="cal-day"></h4>
          <div class="cal-events"></div>
          <form class="cal-add">
            <div class="row">
              <input type="time" class="ev-time" aria-label="시간 (선택)">
              <div class="ev-colors">${Object.entries(COLORS).map(([k, c]) => `<button type="button" class="swatch" data-c="${k}" style="--c:${c}" aria-label="${k}"></button>`).join('')}</div>
            </div>
            <div class="row"><input class="ev-title field" placeholder="새로운 일정" aria-label="일정 제목" maxlength="80"><button class="btn primary small" aria-label="일정 추가">${I.plus}</button></div>
          </form>
        </aside>
      </div>
    </div>`;

  const $ = (s) => win.body.querySelector(s);
  const grid = $('.cal-grid');

  function render() {
    $('.cal-title').innerHTML = `${ym.getFullYear()}년 <b>${ym.getMonth() + 1}월</b>`;
    const start = new Date(ym);
    start.setDate(1 - ym.getDay());
    const weeks = Math.ceil((ym.getDay() + new Date(ym.getFullYear(), ym.getMonth() + 1, 0).getDate()) / 7);
    grid.style.gridTemplateRows = `repeat(${weeks}, 1fr)`;
    const todayKey = S.dateKey(new Date());
    let html = '';
    for (let i = 0; i < weeks * 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const k = S.dateKey(d);
      const evs = S.eventsOn(k);
      html += `<button class="cal-cell ${d.getMonth() !== ym.getMonth() ? 'out' : ''} ${k === todayKey ? 'today' : ''} ${k === selected ? 'sel' : ''} ${d.getDay() === 0 ? 'sun' : ''}" data-k="${k}">
        <span class="num">${d.getDate()}</span>
        ${evs.slice(0, 2).map((e) => `<span class="ev" style="--c:${COLORS[e.color] || COLORS.blue}">${esc(e.title)}</span>`).join('')}
        ${evs.length > 2 ? `<span class="more">+${evs.length - 2}</span>` : ''}
      </button>`;
    }
    grid.innerHTML = html;
    renderSide();
  }

  function renderSide() {
    const [y, m, d] = selected.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    $('.cal-day').innerHTML = `${m}월 ${d}일 <span>${'일월화수목금토'[date.getDay()]}요일</span>`;
    const evs = S.eventsOn(selected);
    $('.cal-events').innerHTML = evs.length
      ? evs.map((e) => `<div class="cal-ev" style="--c:${COLORS[e.color] || COLORS.blue}"><i></i><div><b>${esc(e.title)}</b><small>${e.time ? fmtTime(e.time) : '하루 종일'}</small></div><button class="x" data-id="${e.id}" aria-label="일정 삭제">${I.x}</button></div>`).join('')
      : '<div class="empty small">일정이 없어요.</div>';
    win.body.querySelectorAll('.ev-colors .swatch').forEach((b) => b.classList.toggle('on', b.dataset.c === color));
  }

  const fmtTime = (t) => {
    const [h, mi] = t.split(':').map(Number);
    if (S.state.settings.clock24) return t;
    return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(mi).padStart(2, '0')}`;
  };

  grid.addEventListener('click', (e) => {
    const c = e.target.closest('.cal-cell');
    if (!c) return;
    selected = c.dataset.k;
    const [y, m] = selected.split('-').map(Number);
    if (m - 1 !== ym.getMonth()) ym = new Date(y, m - 1, 1);
    render();
  });
  grid.addEventListener('dblclick', (e) => e.target.closest('.cal-cell') && $('.ev-title').focus());
  $('.prev').onclick = () => ((ym = new Date(ym.getFullYear(), ym.getMonth() - 1, 1)), render());
  $('.next').onclick = () => ((ym = new Date(ym.getFullYear(), ym.getMonth() + 1, 1)), render());
  $('.today').onclick = () => {
    const t = new Date();
    ym = new Date(t.getFullYear(), t.getMonth(), 1);
    selected = S.dateKey(t);
    render();
  };
  $('.ev-colors').onclick = (e) => {
    const b = e.target.closest('.swatch');
    if (b) (color = b.dataset.c), renderSide();
  };
  $('.cal-add').onsubmit = (e) => {
    e.preventDefault();
    const title = $('.ev-title').value.trim();
    if (!title) return $('.ev-title').focus();
    S.addEvent({ date: selected, time: $('.ev-time').value, title, color });
    $('.ev-title').value = '';
    $('.ev-time').value = '';
  };
  $('.cal-events').onclick = (e) => {
    const x = e.target.closest('.x');
    if (x) S.removeEvent(x.dataset.id);
  };
  win.onKey = (e) => {
    if (e.key === 'ArrowLeft') $('.prev').click();
    if (e.key === 'ArrowRight') $('.next').click();
  };

  win.cleanups.push(S.on('events', render), S.on('settings', render));
  render();
  return win;
}
