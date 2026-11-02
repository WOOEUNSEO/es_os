// 메모: 텍스트 파일 작성과 편집
import * as S from '../store.js';
import { openWindow, getWindow, focus, restore } from '../wm.js';
import { I } from '../icons.js';
import { esc, fmtDate, confirmDialog, showMenu } from '../ui.js';

const textFiles = () => S.allNodes((n) => n.type === 'file' && n.kind === 'text').sort((a, b) => b.mtime - a.mtime);

export function openNotes(fileId) {
  const existing = getWindow('notes');
  if (existing) {
    restore(existing);
    focus(existing);
    if (fileId) existing.notes.select(fileId);
    return existing;
  }
  const win = openWindow({ id: 'notes', app: 'notes', title: '메모', w: 820, h: 540, minW: 520, minH: 320, className: 'notes' });
  let cur = null;
  let q = '';

  win.body.innerHTML = `
    <aside class="sidebar note-side" data-drag>
      <div class="note-search"><label class="searchbox">${I.search}<input type="search" placeholder="검색" aria-label="메모 검색"></label></div>
      <div class="note-list" role="listbox" aria-label="메모 목록"></div>
    </aside>
    <div class="pane">
      <header class="toolbar" data-drag>
        <div class="tb-title"><span class="tb-path note-path"></span></div>
        <div class="tb-spacer"></div>
        <button class="tb chk" title="체크리스트 (줄 앞에 체크 동그라미 넣기)" aria-label="체크리스트">${I.checklist}</button>
        <button class="tb del" title="휴지통으로 이동" aria-label="휴지통으로 이동">${I.trash}</button>
        <button class="tb new" title="새로운 메모" aria-label="새로운 메모">${I.compose}</button>
      </header>
      <div class="note-editor">
        <input class="note-title" aria-label="제목" spellcheck="false">
        <div class="note-date"></div>
        <textarea class="note-body" aria-label="내용" placeholder="여기에 내용을 적어 보세요."></textarea>
        <div class="note-links" hidden></div>
      </div>
      <div class="note-empty" hidden>메모를 선택하거나 새로 만들어 보세요.</div>
    </div>`;

  const $ = (s) => win.body.querySelector(s);
  const list = $('.note-list'), title = $('.note-title'), body = $('.note-body');

  function renderList() {
    const files = textFiles().filter((n) => !q || (n.name + n.content).toLowerCase().includes(q));
    list.innerHTML = files.length
      ? files.map((n) => {
          const [base] = S.splitExt(n.name);
          const first = (n.content || '').split('\n').find((l) => l.trim()) || '추가 텍스트 없음';
          return `<button class="note-item ${n.id === cur ? 'on' : ''}" data-id="${n.id}" role="option" aria-selected="${n.id === cur}">
            <b>${esc(base)}</b><span><em>${fmtDate(n.mtime)}</em> ${esc(first.slice(0, 60))}</span></button>`;
        }).join('')
      : `<div class="empty small">${q ? '검색 결과가 없어요.' : '메모가 없어요.'}</div>`;
  }

  function renderEditor() {
    const n = cur && S.node(cur);
    const ok = n && !S.inTrash(cur);
    $('.note-editor').hidden = !ok;
    $('.note-empty').hidden = !!ok;
    $('.del').disabled = !ok;
    $('.chk').disabled = !ok;
    if (!ok) {
      cur = null;
      $('.note-path').textContent = '';
      return;
    }
    if (document.activeElement !== title) title.value = S.splitExt(n.name)[0];
    if (document.activeElement !== body && body.value !== n.content) body.value = n.content;
    $('.note-date').textContent = new Date(n.mtime).toLocaleString('ko-KR', { dateStyle: 'long', timeStyle: 'short' });
    $('.note-path').textContent = S.pathOf(n.id);
    renderLinks(body.value);
  }

  // 메모 속 링크는 아래에 눌러서 열 수 있는 칩으로 보여줘요.
  function renderLinks(text) {
    const box = $('.note-links');
    const urls = [...new Set((String(text || '').match(/https?:\/\/[^\s<>"')\]]+/g) || []).map((u) => u.replace(/[.,;:!?]+$/, '')))].slice(0, 12);
    box.hidden = !urls.length;
    box.innerHTML = urls.map((u) => {
      let label = u;
      try { const x = new URL(u); label = x.host.replace(/^www\./, '') + (x.pathname.length > 1 ? x.pathname : ''); } catch {}
      return `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer" title="${esc(u)}">${I.link || '↗'}<span>${esc(label.length > 48 ? label.slice(0, 47) + '…' : label)}</span></a>`;
    }).join('');
  }

  function select(id) {
    cur = id;
    const n = S.node(id);
    if (n) {
      title.value = S.splitExt(n.name)[0];
      body.value = n.content;
    }
    renderList();
    renderEditor();
    list.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
  }

  function newNote() {
    const n = S.create('documents', { name: '새로운 메모.txt', kind: 'text', content: '' });
    select(n.id);
    title.focus();
    title.select();
  }

  list.addEventListener('click', (e) => {
    const b = e.target.closest('.note-item');
    if (b) select(b.dataset.id);
  });
  list.addEventListener('contextmenu', (e) => {
    const b = e.target.closest('.note-item');
    if (!b) return;
    e.preventDefault();
    select(b.dataset.id);
    showMenu(e.clientX, e.clientY, [
      { label: '휴지통으로 이동', icon: I.trash, action: () => S.trash(b.dataset.id) },
    ]);
  });
  $('.note-search input').addEventListener('input', (e) => ((q = e.target.value.trim().toLowerCase()), renderList()));
  $('.new').onclick = newNote;
  $('.del').onclick = async () => {
    if (!cur) return;
    const n = S.node(cur);
    if (await confirmDialog({ title: `'${n.name}'을(를) 휴지통으로 옮길까요?`, message: 'Finder의 휴지통에서 되돌릴 수 있어요.', ok: '휴지통으로 이동' })) {
      S.trash(cur);
      const next = textFiles()[0];
      next ? select(next.id) : ((cur = null), renderList(), renderEditor());
    }
  };

  body.addEventListener('input', () => {
    renderLinks(body.value);
    if (!cur) return;
    S.update(cur, { content: body.value }, { quiet: true });
    $('.note-date').textContent = '방금 수정됨';
    const item = list.querySelector(`.note-item[data-id="${cur}"] span`);
    const first = body.value.split('\n').find((l) => l.trim()) || '추가 텍스트 없음';
    if (item) item.innerHTML = `<em>지금</em> ${esc(first.slice(0, 60))}`;
  });
  const commitTitle = () => {
    if (!cur) return;
    const n = S.node(cur);
    const ext = S.splitExt(n.name)[1] || '.txt';
    const v = title.value.trim();
    if (v && v + ext !== n.name) S.rename(cur, v + ext);
    else title.value = S.splitExt(n.name)[0];
  };
  title.addEventListener('blur', commitTitle);
  title.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') (e.preventDefault(), body.focus());
  });
  // ---------- 체크리스트: 줄 앞의 ⚪(할 일) · ✅(완료). 동그라미를 누르면 체크, Enter 로 다음 항목 ----------
  const OPEN = '⚪', DONE = '✅';
  const isItem = (line) => line.startsWith(OPEN + ' ') || line.startsWith(DONE + ' ');
  const lineStartAt = (pos) => body.value.lastIndexOf('\n', pos - 1) + 1;
  const saveBody = () => body.dispatchEvent(new Event('input'));
  function toggleChecklist() {
    const v = body.value;
    const a = lineStartAt(body.selectionStart);
    let b = v.indexOf('\n', Math.max(body.selectionEnd - (body.selectionEnd > body.selectionStart && v[body.selectionEnd - 1] === '\n' ? 1 : 0), a));
    if (b < 0) b = v.length;
    const lines = v.slice(a, b).split('\n');
    const allItems = lines.every((l) => isItem(l));
    const next = lines.map((l) => (allItems ? l.slice(2) : isItem(l) ? l : `${OPEN} ${l}`)).join('\n');
    body.setRangeText(next, a, b, 'select');
    if (lines.length === 1) body.setSelectionRange(a + next.length, a + next.length);
    body.focus();
    saveBody();
  }
  $('.chk').onclick = () => { if (cur) toggleChecklist(); };
  // 동그라미(줄 맨 앞 두 칸)를 누르면 체크 · 해제
  body.addEventListener('mouseup', () => {
    if (body.selectionStart !== body.selectionEnd) return;
    const pos = body.selectionStart;
    const a = lineStartAt(pos);
    if (pos - a > 1) return;
    const line = body.value.slice(a, a + 2);
    if (!isItem(body.value.slice(a, a + 3))) return;
    const mark = line[0] === OPEN ? DONE : OPEN;
    body.setRangeText(mark, a, a + 1, 'preserve');
    const end = body.value.indexOf('\n', a);
    const to = end < 0 ? body.value.length : end;
    body.setSelectionRange(to, to);
    saveBody();
  });
  body.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && body.selectionStart === body.selectionEnd) {
      const pos = body.selectionStart;
      const a = lineStartAt(pos);
      const line = body.value.slice(a, pos);
      if (isItem(line + ' ') || isItem(line)) {
        e.preventDefault();
        if (line.trim().length <= 1) body.setRangeText('', a, pos, 'end'); // 빈 항목에서 Enter → 체크리스트 끝
        else body.setRangeText(`\n${OPEN} `, pos, pos, 'end');
        saveBody();
        return;
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'l' || e.key === 'L')) { e.preventDefault(); toggleChecklist(); return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      body.setRangeText('\t', body.selectionStart, body.selectionEnd, 'end');
      body.dispatchEvent(new Event('input'));
    }
  });

  win.cleanups.push(S.on('fs', () => (renderList(), renderEditor())));
  win.notes = { select };

  const first = fileId || textFiles()[0]?.id;
  first ? select(first) : (renderList(), renderEditor());
  return win;
}
