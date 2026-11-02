// 캘린더: 월 보기 + 날짜별 일정 (종류 · 반복 · 함께하는 사람 · 수정)
import * as S from '../store.js';
import { openWindow, getWindow, focus, restore } from '../wm.js';
import { I } from '../icons.js';
import { esc, showMenu } from '../ui.js';

const COLORS = { blue: '#4d7cfe', pink: '#ef5f97', green: '#2fb57f', orange: '#f29a2e', purple: '#9a6cf2' };
const ic = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
// 큰 주제: 학교 · 알바는 매주 반복, 약속은 함께하는 사람을 적을 수 있어요.
const CATS = {
  plain: { label: '일정', color: 'blue', icon: ic('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>'), ph: '새로운 일정' },
  school: { label: '학교', color: 'purple', icon: ic('<path d="m2.5 9 9.5-4.5L21.5 9 12 13.5z"/><path d="M6.5 11v4.5c1.5 1.5 3.4 2 5.5 2s4-.5 5.5-2V11M21.5 9v5"/>'), ph: '수업 이름 (예: 마케팅원론)', repeat: true },
  work: { label: '알바', color: 'orange', icon: ic('<rect x="3" y="7.5" width="18" height="12.5" rx="2.5"/><path d="M9 7.5V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5v2M3 13h18"/>'), ph: '알바 이름 (예: 카페)', repeat: true },
  meet: { label: '약속', color: 'pink', icon: ic('<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>'), ph: '무엇을 하나요? (예: 저녁 · 영화)', people: true },
};
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const catOf = (e) => CATS[e.cat] || CATS.plain;

export function openCalendar() {
  const existing = getWindow('calendar');
  if (existing) return restore(existing), focus(existing), existing;

  const win = openWindow({ id: 'calendar', app: 'calendar', title: '캘린더', w: 940, h: 620, minW: 600, minH: 460, className: 'calendar' });
  const today = new Date();
  let ym = new Date(today.getFullYear(), today.getMonth(), 1);
  let selected = S.dateKey(today);
  // 입력 폼 상태 (editing: 수정 중인 일정 id)
  const blank = () => ({ cat: 'plain', color: 'blue', days: [], people: [], editing: null });
  let form = blank();

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
          <div class="cal-dow">${DOW.map((d) => `<span>${d}</span>`).join('')}</div>
          <div class="cal-grid"></div>
        </div>
        <aside class="cal-side">
          <h4 class="cal-day"></h4>
          <div class="cal-events"></div>
          <form class="cal-add" autocomplete="off">
            <div class="cal-form-head"><b class="cf-title">새 일정</b><button type="button" class="cf-cancel" hidden>취소</button></div>
            <div class="cal-cats" role="radiogroup" aria-label="일정 종류">${Object.entries(CATS).map(([k, c]) => `<button type="button" class="cal-cat" data-cat="${k}" role="radio" style="--c:${COLORS[c.color]}">${c.icon}<span>${c.label}</span></button>`).join('')}</div>
            <input class="ev-title field" aria-label="일정 제목" maxlength="80">
            <div class="row cf-when">
              <input type="date" class="ev-date" aria-label="날짜" hidden>
              <input type="time" class="ev-time" aria-label="시작 시간 (선택)">
              <span class="cf-tilde">~</span>
              <input type="time" class="ev-end" aria-label="끝 시간 (선택)">
            </div>
            <div class="cf-repeat" hidden>
              <div class="cf-label">매주 반복 <small>요일을 고르면 그 요일마다 들어가요</small></div>
              <div class="cal-days">${DOW.map((d, i) => `<button type="button" class="cal-dowbtn ${i === 0 ? 'sun' : ''}" data-d="${i}">${d}</button>`).join('')}</div>
              <label class="cf-until">끝나는 날 <input type="date" class="ev-until" aria-label="반복 끝나는 날 (선택)"></label>
            </div>
            <div class="cf-people" hidden>
              <div class="cf-label">누구랑? <small>이름을 쓰고 Enter</small></div>
              <div class="cal-people"><span class="chips"></span><input class="ev-person" placeholder="이름" maxlength="20" aria-label="함께하는 사람"></div>
            </div>
            <div class="row">
              <div class="ev-colors">${Object.entries(COLORS).map(([k, c]) => `<button type="button" class="swatch" data-c="${k}" style="--c:${c}" aria-label="${k}"></button>`).join('')}</div>
              <button class="btn primary small cf-save">추가</button>
            </div>
          </form>
        </aside>
      </div>
    </div>`;

  const $ = (s) => win.body.querySelector(s);
  const grid = $('.cal-grid');

  const fmtTime = (t) => {
    if (!t) return '';
    const [h, mi] = t.split(':').map(Number);
    if (S.state.settings.clock24) return t;
    return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(mi).padStart(2, '0')}`;
  };
  const timeText = (e) => (e.time ? fmtTime(e.time) + (e.end ? ` ~ ${fmtTime(e.end)}` : '') : '하루 종일');
  const repeatText = (e) => {
    if (!e.repeat?.days?.length) return '';
    const days = [...e.repeat.days].sort((a, b) => a - b);
    const label = days.length === 7 ? '매일' : days.join() === '1,2,3,4,5' ? '평일마다' : `매주 ${days.map((d) => DOW[d]).join('·')}`;
    return e.repeat.until ? `${label} (~${Number(e.repeat.until.slice(5, 7))}/${Number(e.repeat.until.slice(8))})` : label;
  };
  const chipText = (e) => (e.cat === 'meet' && e.people?.length ? `${e.title} · ${e.people.join(', ')}` : e.title);

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
      const max = evs.length > 4 ? 3 : 4;
      html += `<button class="cal-cell ${d.getMonth() !== ym.getMonth() ? 'out' : ''} ${k === todayKey ? 'today' : ''} ${k === selected ? 'sel' : ''} ${d.getDay() === 0 ? 'sun' : ''} ${evs.length > 1 ? 'multi' : ''}" data-k="${k}">
        <span class="num">${d.getDate()}</span>
        ${evs.slice(0, max).map((e) => `<span class="ev" style="--c:${COLORS[e.color] || COLORS.blue}" title="${esc(chipText(e))}">${e.time ? `<em>${esc(e.time.replace(/^0/, ''))}</em>` : ''}${esc(chipText(e))}</span>`).join('')}
        ${evs.length > max ? `<span class="more">+${evs.length - max}</span>` : ''}
      </button>`;
    }
    grid.innerHTML = html;
    renderSide();
  }

  function renderSide() {
    const [y, m, d] = selected.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    $('.cal-day').innerHTML = `${m}월 ${d}일 <span>${DOW[date.getDay()]}요일</span>`;
    const evs = S.eventsOn(selected);
    $('.cal-events').innerHTML = evs.length
      ? evs.map((e) => {
          const c = catOf(e);
          const sub = [timeText(e), repeatText(e)].filter(Boolean).join(' · ');
          return `<div class="cal-ev ${form.editing === e.id ? 'editing' : ''}" data-id="${e.id}" style="--c:${COLORS[e.color] || COLORS.blue}">
            <span class="cal-ev-ic" title="${c.label}">${c.icon}</span>
            <div><b>${esc(e.title)}</b><small>${esc(sub)}</small>${e.people?.length ? `<small class="who">${I.user}${esc(e.people.join(', '))}</small>` : ''}</div>
            <button class="ed" aria-label="일정 수정" title="수정">${I.edit}</button>
            <button class="x" aria-label="일정 삭제" title="삭제">${I.x}</button>
          </div>`;
        }).join('')
      : '<div class="empty small">일정이 없어요.</div>';
    renderForm();
  }

  function renderForm() {
    const c = CATS[form.cat];
    win.body.querySelectorAll('.cal-cat').forEach((b) => { const on = b.dataset.cat === form.cat; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    win.body.querySelectorAll('.ev-colors .swatch').forEach((b) => b.classList.toggle('on', b.dataset.c === form.color));
    win.body.querySelectorAll('.cal-dowbtn').forEach((b) => b.classList.toggle('on', form.days.includes(Number(b.dataset.d))));
    $('.ev-title').placeholder = c.ph;
    $('.cf-repeat').hidden = !c.repeat && !form.days.length;
    $('.cf-people').hidden = !c.people && !form.people.length;
    $('.cf-until').hidden = !form.days.length;
    $('.cal-people .chips').innerHTML = form.people.map((p, i) => `<span class="pchip">${esc(p)}<button type="button" data-i="${i}" aria-label="${esc(p)} 빼기">${I.x}</button></span>`).join('');
    $('.cf-title').textContent = form.editing ? '일정 수정' : `${Number(selected.slice(5, 7))}월 ${Number(selected.slice(8))}일에 새 일정`;
    $('.cf-cancel').hidden = !form.editing;
    $('.ev-date').hidden = !form.editing;
    $('.cf-save').textContent = form.editing ? '저장' : '추가';
    $('.cal-add').classList.toggle('is-editing', !!form.editing);
  }

  function resetForm() {
    form = blank();
    $('.ev-title').value = '';
    $('.ev-time').value = '';
    $('.ev-end').value = '';
    $('.ev-until').value = '';
    $('.ev-person').value = '';
    renderSide();
  }

  function startEdit(id) {
    const e = S.state.events.find((x) => x.id === id);
    if (!e) return;
    form = { cat: CATS[e.cat] ? e.cat : 'plain', color: e.color || 'blue', days: [...(e.repeat?.days || [])], people: [...(e.people || [])], editing: id };
    $('.ev-title').value = e.title;
    $('.ev-time').value = e.time || '';
    $('.ev-end').value = e.end || '';
    $('.ev-date').value = e.date;
    $('.ev-until').value = e.repeat?.until || '';
    renderSide();
    $('.cal-add').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    $('.ev-title').focus({ preventScroll: true });
  }

  function addPerson() {
    const inp = $('.ev-person');
    const names = inp.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    names.forEach((n) => !form.people.includes(n) && form.people.push(n));
    inp.value = '';
    renderForm();
  }

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
  $('.cal-cats').onclick = (e) => {
    const b = e.target.closest('.cal-cat');
    if (!b) return;
    const prev = form.cat;
    form.cat = b.dataset.cat;
    if (CATS[prev].color === form.color) form.color = CATS[form.cat].color; // 색을 직접 고르지 않았으면 종류 색으로
    if (CATS[form.cat].repeat && !form.days.length && !form.editing) {
      const [y, m, d] = selected.split('-').map(Number);
      form.days = [new Date(y, m - 1, d).getDay()];
    }
    if (!CATS[form.cat].repeat && !form.editing) form.days = [];
    renderForm();
  };
  $('.cal-days').onclick = (e) => {
    const b = e.target.closest('.cal-dowbtn');
    if (!b) return;
    const d = Number(b.dataset.d);
    form.days = form.days.includes(d) ? form.days.filter((x) => x !== d) : [...form.days, d];
    renderForm();
  };
  $('.ev-colors').onclick = (e) => {
    const b = e.target.closest('.swatch');
    if (b) (form.color = b.dataset.c), renderForm();
  };
  $('.ev-person').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); addPerson(); }
    if (e.key === 'Backspace' && !e.target.value && form.people.length) { form.people.pop(); renderForm(); }
  });
  $('.ev-person').addEventListener('blur', () => $('.ev-person').value.trim() && addPerson());
  $('.cal-people').onclick = (e) => {
    const b = e.target.closest('.pchip button');
    if (b) { form.people.splice(Number(b.dataset.i), 1); renderForm(); }
    else $('.ev-person').focus();
  };
  $('.cf-cancel').onclick = resetForm;

  $('.cal-add').onsubmit = (e) => {
    e.preventDefault();
    if ($('.ev-person').value.trim()) addPerson();
    const title = $('.ev-title').value.trim();
    if (!title) return $('.ev-title').focus();
    const time = $('.ev-time').value;
    const end = time ? $('.ev-end').value : '';
    const until = form.days.length ? $('.ev-until').value : '';
    const data = {
      title, time, end, color: form.color, cat: form.cat,
      people: form.people.length ? [...form.people] : undefined,
      repeat: form.days.length ? { days: [...form.days].sort((a, b) => a - b), ...(until ? { until } : {}) } : undefined,
    };
    if (form.editing) {
      const date = $('.ev-date').value || S.state.events.find((x) => x.id === form.editing)?.date || selected;
      S.updateEvent(form.editing, { ...data, date });
    } else {
      S.addEvent({ ...data, date: selected });
    }
    resetForm();
  };

  $('.cal-events').onclick = (e) => {
    const row = e.target.closest('.cal-ev');
    if (!row) return;
    const id = row.dataset.id;
    const ev = S.state.events.find((x) => x.id === id);
    if (e.target.closest('.x')) {
      if (form.editing === id) resetForm();
      if (ev?.repeat?.days?.length) {
        const r = e.target.closest('.x').getBoundingClientRect();
        showMenu(r.left, r.bottom + 4, [
          { label: '이 날만 삭제', icon: I.x, action: () => S.skipEventOn(id, selected) },
          { label: '반복 일정 전체 삭제', icon: I.trash, action: () => S.removeEvent(id) },
        ]);
      } else S.removeEvent(id);
      return;
    }
    startEdit(id);
  };
  win.onKey = (e) => {
    if (e.target.closest?.('input, textarea')) return;
    if (e.key === 'ArrowLeft') $('.prev').click();
    if (e.key === 'ArrowRight') $('.next').click();
    if (e.key === 'Escape' && form.editing) resetForm();
  };

  win.cleanups.push(S.on('events', render), S.on('settings', render));
  render();
  return win;
}
