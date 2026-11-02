// 시스템 설정
import * as S from '../store.js';
import { openWindow, getWindow, focus, restore } from '../wm.js';
import { I } from '../icons.js';
import { esc, fmtSize, confirmDialog, toast, pickFiles } from '../ui.js';
import { WALLPAPERS, ACCENTS, wallpaperCss } from '../appearance.js';
import { webApps } from './webapp.js';
import { webAppIcon } from '../icons.js';

const SECTIONS = [
  ['general', '일반', I.user, '#8e92a2'],
  ['appearance', '모양', I.palette, '#5b7cfa'],
  ['wallpaper', '배경화면', I.wallpaper, '#2aa7c9'],
  ['webapps', '웹 앱', I.globe, '#e0675a'],
  ['data', '데이터', I.database, '#2fb57f'],
  ['about', '이 컴퓨터에 관하여', I.info, '#9a6cf2'],
];

export function openSettings(section = 'general') {
  const existing = getWindow('settings');
  if (existing) {
    restore(existing);
    focus(existing);
    existing.settings.show(section);
    return existing;
  }
  const win = openWindow({ id: 'settings', app: 'settings', title: '시스템 설정', w: 760, h: 540, minW: 560, minH: 380, className: 'settings' });
  let cur = section;

  win.body.innerHTML = `
    <aside class="sidebar" data-drag>
      <div class="me"><span class="avatar"></span><div><b class="me-name"></b><small>es OS 사용자</small></div></div>
      <nav class="side-list">${SECTIONS.map(([k, l, ic, c]) => `<button class="side-item set-item" data-k="${k}"><span class="set-ic" style="--c:${c}">${ic}</span><span>${l}</span></button>`).join('')}</nav>
    </aside>
    <div class="pane">
      <header class="toolbar" data-drag><div class="tb-title"><h3 class="set-title"></h3></div></header>
      <div class="set-body"></div>
    </div>`;

  const $ = (s) => win.body.querySelector(s);
  const body = $('.set-body');
  win.body.querySelectorAll('.set-item').forEach((b) => (b.onclick = () => show(b.dataset.k)));

  function show(k) {
    cur = k;
    render();
    body.scrollTop = 0;
  }

  const toggle = (key, label, desc) => `
    <label class="set-row"><div><b>${label}</b>${desc ? `<small>${desc}</small>` : ''}</div>
    <input type="checkbox" class="switch" data-set="${key}" ${S.state.settings[key] ? 'checked' : ''}></label>`;

  function render() {
    const s = S.state.settings;
    $('.me-name').textContent = s.name || '사용자';
    $('.avatar').textContent = (s.name || '?').trim().charAt(0).toUpperCase();
    win.body.querySelectorAll('.set-item').forEach((b) => b.classList.toggle('on', b.dataset.k === cur));
    $('.set-title').textContent = SECTIONS.find((x) => x[0] === cur)[1];

    if (cur === 'general') {
      body.innerHTML = `
        <div class="card">
          <label class="set-row"><div><b>이름</b><small>잠금 화면과 메뉴에 표시돼요.</small></div>
            <input class="field name-in" value="${esc(s.name)}" maxlength="20" aria-label="이름"></label>
          ${toggle('clock24', '24시간제 시계', '메뉴 막대와 캘린더 시간 표시 방식')}
          ${toggle('showWidgets', '데스크탑 위젯 보기', '날짜와 할 일 위젯')}
        </div>`;
      const inp = $('.name-in');
      inp.addEventListener('change', () => S.setSetting('name', inp.value.trim() || '사용자'));
      inp.addEventListener('keydown', (e) => e.key === 'Enter' && inp.blur());
    }

    if (cur === 'appearance') {
      body.innerHTML = `
        <div class="card">
          <div class="set-row col"><b>테마</b>
            <div class="themes">
              ${[['light', '라이트', I.sun], ['dark', '다크', I.moon], ['auto', '자동', I.auto]].map(([k, l, ic]) => `
                <button class="theme-opt ${s.theme === k ? 'on' : ''}" data-theme-opt="${k}">
                  <span class="theme-prev t-${k}"><i></i><i></i></span><span>${ic}${l}</span></button>`).join('')}
            </div>
          </div>
          <div class="set-row col"><b>강조 색상</b>
            <div class="dots">${ACCENTS.map((c) => `<button class="swatch big ${s.accent === c ? 'on' : ''}" data-accent="${c}" style="--c:${c}" aria-label="강조 색상 ${c}"></button>`).join('')}</div>
          </div>
        </div>`;
      body.querySelectorAll('[data-theme-opt]').forEach((b) => (b.onclick = () => S.setSetting('theme', b.dataset.themeOpt)));
      body.querySelectorAll('[data-accent]').forEach((b) => (b.onclick = () => S.setSetting('accent', b.dataset.accent)));
    }

    if (cur === 'wallpaper') {
      body.innerHTML = `
        <div class="wp-current" style="background:${wallpaperCss()}"></div>
        <div class="card">
          <div class="set-row col"><b>기본 배경화면</b>
            <div class="wps">
              ${Object.entries(WALLPAPERS).map(([k, w]) => `<button class="wp ${s.wallpaper === k ? 'on' : ''}" data-wp="${k}"><span style="background:${w.css}"></span>${w.name}</button>`).join('')}
            </div>
          </div>
          <div class="set-row"><div><b>내 사진으로 바꾸기</b><small>사진 앱에서 사진을 열고 배경화면 버튼을 눌러도 돼요.</small></div>
            <button class="btn small up-wp">${I.upload}<span>사진 선택</span></button></div>
        </div>`;
      body.querySelectorAll('[data-wp]').forEach((b) => (b.onclick = () => S.setSetting('wallpaper', b.dataset.wp)));
      $('.up-wp').onclick = async () => {
        const files = await pickFiles({ accept: 'image/*', multiple: false });
        if (!files?.length) return;
        const { importFiles } = await import('../ui.js');
        const [n] = await importFiles(files, 'pictures');
        if (n) {
          S.state.settings.customWallpaper = n.content;
          S.setSetting('wallpaper', 'custom');
        }
      };
    }

    if (cur === 'webapps') {
      const list = webApps();
      const COLORS = ['#e0675a', '#5b7cfa', '#2fb57f', '#a26bf5', '#f0a43a', '#3b3f4e'];
      body.innerHTML = `
        <div class="card">
          ${list.length ? list.map((a) => `
            <div class="set-row web-row">${webAppIcon(a)}<div><b>${esc(a.name)}</b><small>${esc(a.url)}</small></div>
              <button class="btn small danger web-del" data-id="${esc(a.id)}">빼기</button></div>`).join('') : `<div class="set-row"><small>아직 넣은 웹 앱이 없어요.</small></div>`}
        </div>
        <div class="card">
          <div class="set-row col"><b>웹 앱 넣기</b><small>GitHub Pages · Render 등에 올린 내 웹사이트 주소를 넣으면 Dock에 앱으로 생겨요.</small>
            <div class="web-form">
              <input class="field web-name" placeholder="이름 (예: 부티크 스케줄러)" maxlength="20">
              <input class="field web-url" placeholder="https://아이디.github.io/저장소/" inputmode="url">
              <div class="web-colors">${COLORS.map((c, i) => `<button type="button" class="web-color ${i === 0 ? 'on' : ''}" data-c="${c}" style="--c:${c}" aria-label="색"></button>`).join('')}</div>
              <button class="btn small primary web-add">${I.plus}<span>넣기</span></button>
            </div>
          </div>
          <div class="note-box">${I.info}<p>창 안에서 바로 열려요. 단, 구글 · 네이버처럼 다른 사이트 안에 들어가는 걸 막아 둔 곳은 빈 화면이 될 수 있어요. 그럴 땐 창 오른쪽 위 ↗ 버튼으로 새 탭에서 열면 돼요. 내가 만든 GitHub Pages · Render 사이트는 대부분 잘 열려요.</p></div>
        </div>`;
      let color = COLORS[0];
      body.querySelectorAll('.web-color').forEach((b) => (b.onclick = () => {
        color = b.dataset.c;
        body.querySelectorAll('.web-color').forEach((x) => x.classList.toggle('on', x === b));
      }));
      body.querySelectorAll('.web-del').forEach((b) => (b.onclick = () => {
        S.setSetting('webApps', webApps().filter((a) => a.id !== b.dataset.id));
        render();
      }));
      body.querySelector('.web-add').onclick = () => {
        const name = body.querySelector('.web-name').value.trim();
        let url = body.querySelector('.web-url').value.trim();
        if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
        try { new URL(url); } catch { return toast('주소를 확인해 주세요'); }
        if (!name) return toast('이름을 적어 주세요');
        S.setSetting('webApps', [...webApps(), { id: S.uid(), name, url, color }]);
        toast(`${name} 앱을 Dock에 넣었어요`);
        render();
      };
    }

    if (cur === 'data') {
      const files = S.allNodes((n) => n.type === 'file').length;
      const folders = S.allNodes((n) => n.type === 'folder').length;
      body.innerHTML = `
        <div class="card">
          <div class="set-row"><div><b>저장된 항목</b><small>파일 ${files}개 · 폴더 ${folders}개 · 일정 ${S.state.events.length}개</small></div><span class="usage">계산 중…</span></div>
          <div class="note-box">${I.info}<p>모든 데이터는 <b>지금 이 브라우저 안에만</b> 저장돼요. 다른 기기에서는 보이지 않고, 브라우저의 사이트 데이터를 지우면 함께 사라져요. 가끔 백업을 내려받아 두세요.</p></div>
        </div>
        <div class="card">
          <div class="set-row"><div><b>백업 내보내기</b><small>모든 파일과 설정을 하나의 파일로 저장해요.</small></div><button class="btn small exp">${I.download}<span>내보내기</span></button></div>
          <div class="set-row"><div><b>백업 가져오기</b><small>내보낸 백업 파일로 되돌려요. 지금 데이터는 덮어써져요.</small></div><button class="btn small imp">${I.upload}<span>가져오기</span></button></div>
          <div class="set-row"><div><b>초기화</b><small>처음 상태로 되돌려요.</small></div><button class="btn small danger reset">초기화…</button></div>
        </div>`;
      navigator.storage?.estimate?.().then((e) => {
        const u = body.querySelector('.usage');
        if (u) u.textContent = `${fmtSize(e.usage || 0)} 사용 중`;
      }).catch(() => {});
      $('.exp').onclick = async () => {
        await S.saveNow();
        const blob = new Blob([JSON.stringify(S.state)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `es-os-backup-${S.dateKey(new Date())}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      };
      $('.imp').onclick = async () => {
        const files = await pickFiles({ accept: '.json,application/json', multiple: false });
        if (!files?.length) return;
        try {
          const data = JSON.parse(await files[0].text());
          if (!(await confirmDialog({ title: '백업으로 되돌릴까요?', message: '지금 있는 파일과 설정은 백업 내용으로 바뀌어요.', ok: '되돌리기' }))) return;
          await S.replaceState(data);
          location.reload();
        } catch (e) {
          toast(e.message || '백업 파일을 읽지 못했어요.');
        }
      };
      $('.reset').onclick = async () => {
        if (await confirmDialog({ title: '모든 데이터를 지우고 처음 상태로 되돌릴까요?', message: '파일, 사진, 일정, 설정이 모두 사라지며 되돌릴 수 없어요.', ok: '초기화', danger: true })) {
          await S.resetAll();
          location.reload();
        }
      };
    }

    if (cur === 'about') {
      body.innerHTML = `
        <div class="about">
          <div class="about-logo"></div>
          <h2>es OS</h2>
          <p>버전 1.0 · ${new Date().getFullYear()}</p>
          <div class="card">
            <div class="set-row"><b>사용자</b><span>${esc(s.name)}</span></div>
            <div class="set-row"><b>저장 위치</b><span>이 브라우저 (IndexedDB)</span></div>
            <div class="set-row"><b>화면</b><span>${screen.width} × ${screen.height}</span></div>
          </div>
          <small>브라우저에서 동작하는 나만의 작은 컴퓨터</small>
        </div>`;
    }

    body.querySelectorAll('[data-set]').forEach((inp) => (inp.onchange = () => S.setSetting(inp.dataset.set, inp.checked)));
  }

  win.cleanups.push(S.on('settings', render));
  win.settings = { show };
  render();
  return win;
}
