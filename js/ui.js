// 공용 UI: 메뉴, 대화상자, 이름 바꾸기, 드래그 앤 드롭, 파일 열기/가져오기
import * as S from './store.js';
import { I, TAGS, FOLDER_COLORS, FOLDER_COLOR_NAMES } from './icons.js';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function fmtSize(b) {
  if (b == null) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(b < 10240 ? 1 : 0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
export function fmtDate(t) {
  const d = new Date(t), now = new Date();
  const time = d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit', hour12: !S.state.settings.clock24 });
  if (S.dateKey(d) === S.dateKey(now)) return `오늘 ${time}`;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (S.dateKey(d) === S.dateKey(y)) return `어제 ${time}`;
  return `${d.getFullYear() === now.getFullYear() ? '' : d.getFullYear() + '. '}${d.getMonth() + 1}. ${d.getDate()}.`;
}
export function kindLabel(n) {
  if (n.type === 'folder') return '폴더';
  if (n.kind === 'image') return '이미지';
  if (n.kind === 'text') return '텍스트';
  return (S.splitExt(n.name)[1].slice(1).toUpperCase() || '파일') + ' 파일';
}
export function metaLine(n) {
  if (n.type === 'folder') return `${S.children(n.id).length}개 항목`;
  return fmtSize(S.sizeOf(n));
}

/* ---------- 메뉴 ---------- */
let menuEl = null;
let menuClose = null;
export function closeMenu() {
  if (!menuEl) return;
  const el = menuEl;
  menuEl = null;
  el.classList.add('out');
  setTimeout(() => el.remove(), 120);
  menuClose?.();
  menuClose = null;
}
export function showMenu(x, y, items, { anchor, onClose } = {}) {
  closeMenu();
  const el = document.createElement('div');
  el.className = 'menu glass';
  el.setAttribute('role', 'menu');
  items.filter(Boolean).forEach((it) => {
    if (it.sep) {
      el.insertAdjacentHTML('beforeend', '<div class="menu-sep"></div>');
      return;
    }
    if (it.swatches) {
      const row = document.createElement('div');
      row.className = 'menu-swatches';
      if (it.label) row.insertAdjacentHTML('beforeend', `<span class="menu-sub">${esc(it.label)}</span>`);
      const dots = document.createElement('div');
      dots.className = 'dots';
      it.swatches.forEach((s) => {
        const b = document.createElement('button');
        b.className = 'swatch' + (s.on ? ' on' : '');
        b.style.setProperty('--c', s.c);
        b.title = s.title;
        b.setAttribute('aria-label', s.title);
        b.onclick = () => (closeMenu(), s.action());
        dots.appendChild(b);
      });
      row.appendChild(dots);
      el.appendChild(row);
      return;
    }
    const b = document.createElement('button');
    b.className = 'menu-item' + (it.danger ? ' danger' : '') + (it.checked ? ' checked' : '');
    b.setAttribute('role', 'menuitem');
    b.disabled = !!it.disabled;
    b.innerHTML = `<span class="mi-ic">${it.checked ? I.check : it.icon || ''}</span><span class="mi-label">${esc(it.label)}</span>${it.hint ? `<span class="mi-hint">${esc(it.hint)}</span>` : ''}`;
    b.onclick = () => {
      closeMenu();
      it.action?.();
    };
    el.appendChild(b);
  });
  document.body.appendChild(el);
  const r = el.getBoundingClientRect();
  if (anchor) {
    x = anchor.left;
    y = anchor.bottom + 4;
  }
  el.style.left = Math.max(6, Math.min(x, innerWidth - r.width - 6)) + 'px';
  el.style.top = Math.max(34, Math.min(y, innerHeight - r.height - 6)) + 'px';
  menuEl = el;
  menuClose = onClose;
  return el;
}
addEventListener('pointerdown', (e) => {
  if (menuEl && !menuEl.contains(e.target) && !e.target.closest('[data-menu-trigger]')) closeMenu();
}, true);
addEventListener('keydown', (e) => {
  if (!menuEl) return;
  if (e.key === 'Escape') return closeMenu();
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const items = [...menuEl.querySelectorAll('.menu-item:not(:disabled)')];
    const i = items.indexOf(document.activeElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  }
});
addEventListener('blur', closeMenu);
export const menuOpen = () => !!menuEl;

/* ---------- 확인 대화상자 ---------- */
export function confirmDialog({ title, message, ok = '확인', cancel = '취소', danger = false }) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = `<div class="modal glass" role="alertdialog" aria-modal="true">
      <div class="modal-ic">${danger ? I.trash : I.info}</div>
      <h4>${esc(title)}</h4>${message ? `<p>${esc(message)}</p>` : ''}
      <div class="modal-btns"><button class="btn" data-v="0">${esc(cancel)}</button><button class="btn ${danger ? 'danger' : 'primary'}" data-v="1">${esc(ok)}</button></div></div>`;
    const done = (v) => {
      wrap.classList.add('out');
      setTimeout(() => wrap.remove(), 160);
      removeEventListener('keydown', key, true);
      resolve(v);
    };
    const key = (e) => {
      if (e.key === 'Escape') (e.stopPropagation(), done(false));
      if (e.key === 'Enter') (e.preventDefault(), e.stopPropagation(), done(true));
    };
    wrap.onclick = (e) => {
      const b = e.target.closest('button');
      if (b) done(b.dataset.v === '1');
      else if (e.target === wrap) done(false);
    };
    addEventListener('keydown', key, true);
    document.body.appendChild(wrap);
    wrap.querySelector('[data-v="1"]').focus();
  });
}

/* ---------- 알림 ---------- */
export function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast glass';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('out'), 2400);
  setTimeout(() => t.remove(), 2700);
}

/* ---------- 이름 바꾸기 ---------- */
export function startRename(labelEl, n, onDone) {
  if (!labelEl || n.system) return;
  const input = document.createElement('textarea');
  input.className = 'rename';
  input.value = n.name;
  input.rows = 1;
  input.spellcheck = false;
  labelEl.replaceWith(input);
  const fit = () => {
    input.style.height = 'auto';
    input.style.height = input.scrollHeight + 'px';
  };
  fit();
  input.focus();
  const base = n.type === 'folder' ? n.name.length : S.splitExt(n.name)[0].length;
  input.setSelectionRange(0, base);
  let finished = false;
  const finish = (commit) => {
    if (finished) return;
    finished = true;
    const v = input.value.replace(/\n/g, ' ').trim();
    if (commit && v && v !== n.name) S.rename(n.id, v);
    else input.replaceWith(labelEl);
    onDone?.();
  };
  input.addEventListener('input', fit);
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') (e.preventDefault(), finish(true));
    if (e.key === 'Escape') finish(false);
  });
  input.addEventListener('blur', () => finish(true));
  input.addEventListener('pointerdown', (e) => e.stopPropagation());
  input.addEventListener('dblclick', (e) => e.stopPropagation());
}

/* ---------- 드래그 앤 드롭 ---------- */
const MIME = 'application/x-esos';
export function setDragIds(e, ids) {
  e.dataTransfer.setData(MIME, JSON.stringify(ids));
  e.dataTransfer.setData('text/plain', ids.map((i) => S.node(i)?.name).join('\n'));
  e.dataTransfer.effectAllowed = 'move';
}
export const isInternalDrag = (e) => e.dataTransfer?.types?.includes(MIME);
export const isFileDrag = (e) => e.dataTransfer?.types?.includes('Files');
export function getDragIds(e) {
  try { return JSON.parse(e.dataTransfer.getData(MIME)); } catch { return null; }
}
export function canDropInto(e, pid) {
  return isFileDrag(e) || isInternalDrag(e);
}
/** 드롭 대상 요소에 공통 동작을 연결합니다. */
export function makeDropTarget(el, getPid, { onDrop } = {}) {
  let depth = 0;
  el.addEventListener('dragenter', (e) => {
    if (!isInternalDrag(e) && !isFileDrag(e)) return;
    e.preventDefault();
    depth++;
    el.classList.add('drop-over');
  });
  el.addEventListener('dragover', (e) => {
    if (!isInternalDrag(e) && !isFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = isFileDrag(e) ? 'copy' : 'move';
  });
  el.addEventListener('dragleave', () => {
    if (--depth <= 0) (depth = 0, el.classList.remove('drop-over'));
  });
  el.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    depth = 0;
    el.classList.remove('drop-over');
    const pid = getPid();
    if (!pid) return;
    if (isInternalDrag(e)) {
      const ids = getDragIds(e) || [];
      ids.forEach((id) => S.move(id, pid));
      onDrop?.(ids);
    } else if (e.dataTransfer.files.length) {
      const made = await importFiles(e.dataTransfer.files, pid === 'trash' ? 'downloads' : pid);
      onDrop?.(made.map((n) => n.id));
    }
  });
}

/* ---------- 파일 열기 ---------- */
export async function openNode(id) {
  const n = S.node(id);
  if (!n) return;
  if (S.inTrash(id) && n.type !== 'folder') {
    toast('휴지통에 있는 파일은 먼저 되돌려 놓아야 열 수 있어요.');
    return;
  }
  if (n.type === 'folder') return (await import('./apps/finder.js')).openFinder(id);
  if (n.kind === 'text') return (await import('./apps/notes.js')).openNotes(id);
  if (n.kind === 'image') return (await import('./apps/photos.js')).openPhotos(id);
  downloadNode(n);
}
export function downloadNode(n) {
  const a = document.createElement('a');
  a.href = n.kind === 'text' ? URL.createObjectURL(new Blob([n.content], { type: 'text/plain' })) : n.content;
  a.download = n.name;
  a.click();
  if (n.kind === 'text') setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- 파일 가져오기 ---------- */
const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|js|ts|jsx|tsx|html|css|c|h|cpp|py|java|sh|log|xml|ya?ml|ini|conf|sql)$/i;
const readAs = (file, how) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r[how](file);
  });

async function shrinkImage(file) {
  if (/gif|svg/.test(file.type) || file.size < 400 * 1024) return readAs(file, 'readAsDataURL');
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const png = file.type === 'image/png' && file.size < 1.5 * 1024 * 1024;
    return c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.86);
  } catch {
    return readAs(file, 'readAsDataURL');
  }
}

export async function importFiles(fileList, pid) {
  const made = [];
  for (const file of [...fileList]) {
    try {
      if (file.type.startsWith('image/')) {
        made.push(S.create(pid, { name: file.name, kind: 'image', content: await shrinkImage(file) }));
      } else if (file.type.startsWith('text/') || /json/.test(file.type) || TEXT_EXT.test(file.name)) {
        made.push(S.create(pid, { name: file.name, kind: 'text', content: await readAs(file, 'readAsText') }));
      } else if (file.size <= 15 * 1024 * 1024) {
        made.push(S.create(pid, { name: file.name, kind: 'binary', content: await readAs(file, 'readAsDataURL') }));
      } else {
        toast(`${file.name}: 15MB보다 큰 파일은 가져올 수 없어요.`);
      }
    } catch (e) {
      console.error(e);
      toast(`${file.name}을(를) 가져오지 못했어요.`);
    }
  }
  if (made.length) toast(`${made.length}개 항목을 가져왔어요.`);
  return made;
}
export function pickFiles({ accept = '', multiple = true } = {}) {
  return new Promise((res) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = accept;
    inp.multiple = multiple;
    inp.onchange = () => res(inp.files);
    inp.click();
  });
}

/* ---------- 항목 우클릭 메뉴 ---------- */
export function itemMenuItems(ids, { rename } = {}) {
  const nodes = ids.map(S.node).filter(Boolean);
  if (!nodes.length) return [];
  const n = nodes[0];
  const single = nodes.length === 1;
  if (nodes.every((x) => x.parent === 'trash')) {
    return [
      { label: '되돌려 놓기', icon: I.restore, action: () => nodes.forEach((x) => S.restore(x.id)) },
      { sep: true },
      {
        label: '즉시 삭제…', icon: I.trash, danger: true,
        action: async () => {
          if (await confirmDialog({ title: `${single ? `'${n.name}'을(를)` : `${nodes.length}개 항목을`} 영구적으로 삭제할까요?`, message: '이 작업은 되돌릴 수 없어요.', ok: '삭제', danger: true }))
            nodes.forEach((x) => S.destroy(x.id));
        },
      },
    ];
  }
  const folders = nodes.filter((x) => x.type === 'folder' && !x.system);
  return [
    { label: '열기', icon: I.expand, action: () => nodes.forEach((x) => openNode(x.id)) },
    single && n.type === 'file' ? { label: '다운로드', icon: I.download, action: () => downloadNode(n) } : null,
    { sep: true },
    single && rename ? { label: '이름 변경', icon: I.edit, hint: 'Enter', disabled: n.system, action: rename } : null,
    { label: '복제', icon: I.copy, disabled: nodes.some((x) => x.system), action: () => nodes.forEach((x) => S.duplicate(x.id)) },
    { label: '휴지통으로 이동', icon: I.trash, hint: 'Del', disabled: nodes.some((x) => x.system), action: () => nodes.forEach((x) => S.trash(x.id)) },
    { sep: true },
    folders.length
      ? {
          swatches: Object.keys(FOLDER_COLORS).map((k) => ({
            c: FOLDER_COLORS[k][1], title: `${FOLDER_COLOR_NAMES[k]} 폴더`,
            on: folders.every((f) => f.color === k),
            action: () => folders.forEach((f) => S.update(f.id, { color: k })),
          })),
          label: '폴더 색상',
        }
      : null,
    nodes.some((x) => x.system)
      ? null
      : {
          swatches: [
            ...TAGS.map((t) => ({
              c: t.c, title: `${t.name} 태그`,
              on: nodes.every((x) => x.tag === t.key),
              action: () => {
                const off = nodes.every((x) => x.tag === t.key);
                nodes.forEach((x) => S.update(x.id, { tag: off ? null : t.key }));
              },
            })),
          ],
          label: '태그',
        },
  ];
}
