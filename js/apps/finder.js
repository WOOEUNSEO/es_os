// Finder: 폴더와 파일 탐색
import * as S from '../store.js';
import { openWindow } from '../wm.js';
import { I, TAGS, fileIcon, tagColor } from '../icons.js';
import {
  esc, fmtDate, fmtSize, kindLabel, metaLine, showMenu, confirmDialog, startRename,
  setDragIds, isInternalDrag, isFileDrag, getDragIds, makeDropTarget, openNode,
  importFiles, pickFiles, itemMenuItems,
} from '../ui.js';

const PLACES = [
  ['desktop', '데스크탑', I.monitor],
  ['documents', '문서', I.doc],
  ['downloads', '다운로드', I.download],
  ['pictures', '사진', I.image],
];

export function openFinder(start = 'documents') {
  if (!S.node(start) && !String(start).startsWith('tag:')) start = 'documents';
  const win = openWindow({ app: 'finder', title: 'Finder', w: 880, h: 540, minW: 500, minH: 300, className: 'finder' });
  const st = { cur: start, hist: [start], i: 0, q: '', sel: new Set(), anchor: null };

  win.body.innerHTML = `
    <aside class="sidebar" data-drag>
      <nav class="side-list" aria-label="위치"></nav>
    </aside>
    <div class="pane">
      <header class="toolbar" data-drag>
        <div class="navbtns">
          <button class="tb back" aria-label="뒤로">${I.left}</button>
          <button class="tb fwd" aria-label="앞으로">${I.right}</button>
        </div>
        <div class="tb-title"><h3></h3><span class="tb-path"></span></div>
        <div class="tb-spacer"></div>
        <div class="seg" role="group" aria-label="보기 방식">
          <button data-view="grid" aria-label="아이콘으로 보기" title="아이콘">${I.grid}</button>
          <button data-view="list" aria-label="목록으로 보기" title="목록">${I.list}</button>
        </div>
        <button class="tb newf" title="새 폴더" aria-label="새 폴더">${I.folderPlus}</button>
        <button class="tb up" title="내 컴퓨터에서 파일 가져오기" aria-label="파일 가져오기">${I.upload}</button>
        <label class="searchbox">${I.search}<input type="search" placeholder="검색" aria-label="파일 검색"></label>
      </header>
      <div class="fbanner" hidden></div>
      <div class="fcontent" tabindex="0"></div>
      <footer class="fstatus"></footer>
    </div>`;

  const $ = (s) => win.body.querySelector(s);
  const side = $('.side-list'), content = $('.fcontent'), banner = $('.fbanner');
  const search = $('.searchbox input');

  /* ---------- 사이드바 ---------- */
  side.innerHTML = `
    <h6>즐겨찾기</h6>
    ${PLACES.map(([id, label, ic]) => `<button class="side-item" data-go="${id}">${ic}<span>${label}</span></button>`).join('')}
    <h6>위치</h6>
    <button class="side-item" data-go="home">${I.home}<span>홈</span></button>
    <button class="side-item" data-go="trash">${I.trash}<span>휴지통</span></button>
    <h6>태그</h6>
    ${TAGS.map((t) => `<button class="side-item" data-go="tag:${t.key}"><span class="tagdot" style="--c:${t.c}"></span><span>${t.name}</span></button>`).join('')}`;
  side.querySelectorAll('[data-go]').forEach((b) => {
    b.onclick = () => go(b.dataset.go);
    if (!b.dataset.go.startsWith('tag:')) makeDropTarget(b, () => b.dataset.go);
  });

  /* ---------- 이동 ---------- */
  function go(id) {
    st.q = '';
    search.value = '';
    if (id === st.cur) return render();
    st.hist = st.hist.slice(0, st.i + 1);
    st.hist.push(id);
    st.i = st.hist.length - 1;
    st.cur = id;
    st.sel.clear();
    render();
    content.scrollTop = 0;
  }
  $('.back').onclick = () => { if (st.i > 0) (st.cur = st.hist[--st.i], st.sel.clear(), render()); };
  $('.fwd').onclick = () => { if (st.i < st.hist.length - 1) (st.cur = st.hist[++st.i], st.sel.clear(), render()); };
  win.body.querySelectorAll('.seg button').forEach((b) => (b.onclick = () => S.setSetting('finderView', b.dataset.view)));
  $('.newf').onclick = () => newFolder();
  $('.up').onclick = async () => {
    const files = await pickFiles();
    if (files?.length) importFiles(files, realFolder() || 'documents');
  };
  search.addEventListener('input', () => ((st.q = search.value.trim()), st.sel.clear(), render()));
  search.addEventListener('keydown', (e) => e.key === 'Escape' && ((search.value = ''), (st.q = ''), render()));

  const isTag = () => st.cur.startsWith('tag:');
  const realFolder = () => (st.q || isTag() ? null : st.cur);

  function items() {
    if (st.q) {
      const q = st.q.toLowerCase();
      return S.allNodes((n) => n.name.toLowerCase().includes(q)).sort((a, b) => b.mtime - a.mtime);
    }
    if (isTag()) {
      const k = st.cur.slice(4);
      return S.allNodes((n) => n.tag === k);
    }
    return S.children(st.cur);
  }

  /* ---------- 그리기 ---------- */
  function render() {
    if (!isTag() && !S.node(st.cur)) {
      st.cur = 'documents';
      st.hist = ['documents'];
      st.i = 0;
    }
    const list = items();
    const ids = new Set(list.map((n) => n.id));
    [...st.sel].forEach((id) => !ids.has(id) && st.sel.delete(id));

    const view = S.state.settings.finderView;
    let title, path;
    if (st.q) (title = '검색 결과'), (path = `'${st.q}' · 모든 위치`);
    else if (isTag()) (title = TAGS.find((t) => t.key === st.cur.slice(4))?.name + ' 태그'), (path = '태그가 붙은 항목');
    else (title = S.node(st.cur).name), (path = S.pathOf(st.cur));
    $('.tb-title h3').textContent = title;
    $('.tb-path').textContent = path;
    $('.back').disabled = st.i <= 0;
    $('.fwd').disabled = st.i >= st.hist.length - 1;
    win.body.querySelectorAll('.seg button').forEach((b) => b.classList.toggle('on', b.dataset.view === view));
    $('.newf').disabled = !realFolder() || st.cur === 'trash';
    side.querySelectorAll('[data-go]').forEach((b) => b.classList.toggle('on', !st.q && b.dataset.go === st.cur));

    // 휴지통 안내
    if (st.cur === 'trash' && !st.q) {
      banner.hidden = false;
      banner.innerHTML = `<span>휴지통에 있는 항목은 직접 비우기 전까지 보관돼요.</span><button class="btn small" ${list.length ? '' : 'disabled'}>비우기</button>`;
      banner.querySelector('button').onclick = emptyTrash;
    } else banner.hidden = true;

    content.className = `fcontent view-${view}`;
    if (!list.length) {
      content.innerHTML = `<div class="empty">${st.q ? '검색 결과가 없어요.' : st.cur === 'trash' ? '휴지통이 비어 있어요.' : isTag() ? '이 태그가 붙은 항목이 없어요.' : '폴더가 비어 있어요.'}
        ${!st.q && !isTag() && st.cur !== 'trash' ? '<small>파일을 여기로 끌어다 놓거나, 위의 + 버튼으로 새 폴더를 만들어 보세요.</small>' : ''}</div>`;
    } else if (view === 'list') {
      content.innerHTML = `<div class="lhead"><span>이름</span><span>수정일</span><span>크기</span><span>종류</span></div>` +
        list.map((n) => `
        <div class="fitem row ${n.type === 'folder' ? 'is-folder' : ''} ${st.sel.has(n.id) ? 'sel' : ''}" data-id="${n.id}" draggable="${!n.system}">
          <span class="fi-icon">${fileIcon(n)}</span>
          <span class="fi-name"><span class="fname">${esc(n.name)}</span>${n.tag ? `<span class="tagdot" style="--c:${tagColor(n.tag)}"></span>` : ''}</span>
          <span class="c2">${fmtDate(n.mtime)}</span>
          <span class="c2">${n.type === 'folder' ? '--' : fmtSize(S.sizeOf(n))}</span>
          <span class="c2">${kindLabel(n)}</span>
        </div>`).join('');
    } else {
      content.innerHTML = list.map((n) => `
        <div class="fitem ${n.type === 'folder' ? 'is-folder' : ''} ${st.sel.has(n.id) ? 'sel' : ''}" data-id="${n.id}" draggable="${!n.system}" title="${esc(n.name)}">
          <div class="fi-icon">${fileIcon(n)}</div>
          <div class="fname">${esc(n.name)}</div>
          <small>${n.tag ? `<span class="tagdot" style="--c:${tagColor(n.tag)}"></span>` : ''}${st.q ? esc(S.pathOf(n.parent)) : metaLine(n)}</small>
        </div>`).join('');
    }
    $('.fstatus').textContent = `${list.length}개 항목${st.sel.size ? ` · ${st.sel.size}개 선택됨` : ''}`;
  }

  function paintSel() {
    content.querySelectorAll('.fitem').forEach((el) => el.classList.toggle('sel', st.sel.has(el.dataset.id)));
    $('.fstatus').textContent = `${content.querySelectorAll('.fitem').length}개 항목${st.sel.size ? ` · ${st.sel.size}개 선택됨` : ''}`;
  }

  /* ---------- 동작 ---------- */
  function rename(id) {
    const el = content.querySelector(`.fitem[data-id="${id}"] .fname`);
    if (el) startRename(el, S.node(id), () => content.focus({ preventScroll: true }));
  }
  function newFolder() {
    const pid = realFolder();
    if (!pid || pid === 'trash') return;
    const n = S.create(pid, { type: 'folder', name: '새로운 폴더' });
    st.sel = new Set([n.id]);
    render();
    content.querySelector(`.fitem[data-id="${n.id}"]`)?.scrollIntoView({ block: 'nearest' });
    rename(n.id);
  }
  function newText() {
    const pid = realFolder();
    if (!pid || pid === 'trash') return;
    const n = S.create(pid, { name: '새로운 문서.txt', kind: 'text', content: '' });
    st.sel = new Set([n.id]);
    render();
    rename(n.id);
  }
  async function emptyTrash() {
    const count = S.children('trash').length;
    if (!count) return;
    if (await confirmDialog({ title: `휴지통에 있는 ${count}개 항목을 영구적으로 삭제할까요?`, message: '이 작업은 되돌릴 수 없어요.', ok: '휴지통 비우기', danger: true }))
      S.emptyTrash();
  }
  async function deleteSel() {
    const ids = [...st.sel];
    if (!ids.length) return;
    if (ids.every((id) => S.node(id)?.parent === 'trash')) {
      if (await confirmDialog({ title: `${ids.length}개 항목을 영구적으로 삭제할까요?`, message: '이 작업은 되돌릴 수 없어요.', ok: '삭제', danger: true }))
        ids.forEach((id) => S.destroy(id));
    } else ids.forEach((id) => S.trash(id));
  }

  /* ---------- 마우스 ---------- */
  content.addEventListener('pointerdown', (e) => {
    const it = e.target.closest('.fitem');
    if (!it) {
      if (e.button === 0 && !e.target.closest('.rename')) (st.sel.clear(), paintSel());
      return;
    }
    const id = it.dataset.id;
    if (e.metaKey || e.ctrlKey) {
      st.sel.has(id) ? st.sel.delete(id) : st.sel.add(id);
      st.anchor = id;
    } else if (e.shiftKey && st.anchor) {
      const all = [...content.querySelectorAll('.fitem')].map((x) => x.dataset.id);
      const [a, b] = [all.indexOf(st.anchor), all.indexOf(id)].sort((x, y) => x - y);
      st.sel = new Set(all.slice(a, b + 1));
    } else if (!st.sel.has(id) || e.button === 2) {
      if (!st.sel.has(id)) st.sel = new Set([id]);
      st.anchor = id;
    }
    paintSel();
  });
  content.addEventListener('click', (e) => {
    const it = e.target.closest('.fitem');
    if (it && !e.metaKey && !e.ctrlKey && !e.shiftKey && st.sel.size > 1) {
      st.sel = new Set([it.dataset.id]);
      paintSel();
    }
  });
  content.addEventListener('dblclick', (e) => {
    const it = e.target.closest('.fitem');
    if (!it) return;
    const n = S.node(it.dataset.id);
    if (n?.type === 'folder') go(n.id);
    else if (n) openNode(n.id);
  });
  content.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const it = e.target.closest('.fitem');
    if (it) {
      if (!st.sel.has(it.dataset.id)) (st.sel = new Set([it.dataset.id])), paintSel();
      const ids = [...st.sel];
      const items = itemMenuItems(ids, { rename: () => rename(ids[0]) }).map((x) =>
        x && x.label === '열기' ? { ...x, action: () => ids.forEach((id) => (S.node(id).type === 'folder' && ids.length === 1 ? go(id) : openNode(id))) } : x
      );
      showMenu(e.clientX, e.clientY, items);
    } else {
      const pid = realFolder();
      const view = S.state.settings.finderView;
      showMenu(e.clientX, e.clientY, [
        { label: '새로운 폴더', icon: I.folderPlus, disabled: !pid || pid === 'trash', action: newFolder },
        { label: '새로운 텍스트 문서', icon: I.doc, disabled: !pid || pid === 'trash', action: newText },
        { label: '파일 가져오기…', icon: I.upload, action: () => $('.up').click() },
        { sep: true },
        { label: '아이콘으로 보기', checked: view === 'grid', action: () => S.setSetting('finderView', 'grid') },
        { label: '목록으로 보기', checked: view === 'list', action: () => S.setSetting('finderView', 'list') },
        st.cur === 'trash' ? { sep: true } : null,
        st.cur === 'trash' ? { label: '휴지통 비우기…', icon: I.trash, danger: true, disabled: !S.children('trash').length, action: emptyTrash } : null,
      ]);
    }
  });

  /* ---------- 드래그 앤 드롭 ---------- */
  content.addEventListener('dragstart', (e) => {
    const it = e.target.closest('.fitem');
    if (!it) return;
    if (!st.sel.has(it.dataset.id)) (st.sel = new Set([it.dataset.id])), paintSel();
    setDragIds(e, [...st.sel]);
    const img = it.querySelector('.fi-icon');
    if (img) e.dataTransfer.setDragImage(img, 28, 24);
    requestAnimationFrame(() => content.querySelectorAll('.fitem.sel').forEach((x) => x.classList.add('ghost')));
  });
  content.addEventListener('dragend', () => content.querySelectorAll('.ghost').forEach((x) => x.classList.remove('ghost')));

  let overEl = null;
  const setOver = (el) => {
    if (overEl === el) return;
    overEl?.classList.remove('drop-over');
    overEl = el;
    overEl?.classList.add('drop-over');
  };
  content.addEventListener('dragover', (e) => {
    if (!isInternalDrag(e) && !isFileDrag(e)) return;
    const f = e.target.closest('.fitem.is-folder');
    const target = f && !f.classList.contains('ghost') ? f : realFolder() ? content : null;
    if (!target) return setOver(null);
    e.preventDefault();
    e.dataTransfer.dropEffect = isFileDrag(e) ? 'copy' : 'move';
    setOver(target);
  });
  content.addEventListener('dragleave', (e) => {
    if (!content.contains(e.relatedTarget)) setOver(null);
  });
  content.addEventListener('drop', async (e) => {
    e.preventDefault();
    const pid = overEl === content ? realFolder() : overEl?.dataset.id;
    setOver(null);
    if (!pid) return;
    if (isInternalDrag(e)) (getDragIds(e) || []).forEach((id) => S.move(id, pid));
    else if (e.dataTransfer.files.length) {
      const made = await importFiles(e.dataTransfer.files, pid === 'trash' ? 'downloads' : pid);
      st.sel = new Set(made.map((n) => n.id));
      render();
    }
  });

  /* ---------- 키보드 ---------- */
  win.onKey = (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (e.key === 'Delete' || (e.key === 'Backspace' && (mod || st.sel.size))) (e.preventDefault(), deleteSel());
    else if (e.key === 'Enter' && st.sel.size === 1) (e.preventDefault(), rename([...st.sel][0]));
    else if (mod && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      st.sel = new Set([...content.querySelectorAll('.fitem')].map((x) => x.dataset.id));
      paintSel();
    } else if (mod && e.key === 'ArrowUp') {
      const p = S.node(st.cur)?.parent;
      if (p) go(p);
    } else if (mod && e.key === 'ArrowDown' && st.sel.size === 1) {
      const id = [...st.sel][0];
      S.node(id).type === 'folder' ? go(id) : openNode(id);
    }
  };

  win.cleanups.push(S.on('fs', render), S.on('settings', render));
  win.finder = { go, newFolder, newText, realFolder: () => realFolder() };
  render();
  content.focus({ preventScroll: true });
  return win;
}
