// 데이터 저장소: 브라우저 IndexedDB에 전체 상태를 저장합니다.
import { defaultState } from './defaults.js';

const DB_NAME = 'es_os';
const KV = 'kv';
const VERSION = 1;

export let state = null;

/* ---------- 이벤트 ---------- */
const listeners = {};
export function on(ev, fn) {
  (listeners[ev] ??= new Set()).add(fn);
  return () => listeners[ev].delete(fn);
}
export function emit(ev, data) {
  listeners[ev]?.forEach((fn) => {
    try { fn(data); } catch (e) { console.error(e); }
  });
  persist();
}

/* ---------- IndexedDB ---------- */
let dbPromise;
function db() {
  dbPromise ??= new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(KV);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbPromise;
}
async function readState() {
  try {
    const d = await db();
    return await new Promise((res) => {
      const q = d.transaction(KV).objectStore(KV).get('state');
      q.onsuccess = () => res(q.result || null);
      q.onerror = () => res(null);
    });
  } catch { return null; }
}
export async function saveNow() {
  clearTimeout(saveTimer);
  try {
    const d = await db();
    await new Promise((res, rej) => {
      const tx = d.transaction(KV, 'readwrite');
      tx.objectStore(KV).put(state, 'state');
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  } catch (e) {
    console.warn('저장 실패', e);
  }
}
let saveTimer;
export function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 300);
}
addEventListener('pagehide', () => saveNow());

export async function init() {
  const saved = await readState();
  state = saved && saved.version === VERSION ? saved : defaultState();
  // 누락된 필드 보정
  const def = defaultState();
  state.settings = { ...def.settings, ...state.settings };
  state.events ??= [];
  state.todos ??= [];
  persist();
}
export async function resetAll() {
  state = defaultState();
  await saveNow();
}
export async function replaceState(next) {
  if (!next || !next.fs || !next.fs.home) throw new Error('올바른 백업 파일이 아니에요.');
  state = { ...defaultState(), ...next, version: VERSION };
  await saveNow();
}

/* ---------- 설정 ---------- */
export function setSetting(key, value) {
  state.settings[key] = value;
  emit('settings');
}

/* ---------- 파일 시스템 ---------- */
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const node = (id) => state.fs[id];

export function children(pid) {
  return Object.values(state.fs)
    .filter((n) => n.parent === pid)
    .sort((a, b) =>
      a.type !== b.type
        ? a.type === 'folder' ? -1 : 1
        : a.name.localeCompare(b.name, 'ko', { numeric: true })
    );
}

export function splitExt(name) {
  const m = name.match(/^(.+?)(\.[^.\s]{1,6})?$/);
  return m ? [m[1], m[2] || ''] : [name, ''];
}

export function uniqueName(pid, name, exceptId) {
  const taken = new Set(children(pid).filter((n) => n.id !== exceptId).map((n) => n.name));
  if (!taken.has(name)) return name;
  const [base, ext] = splitExt(name);
  let i = 2;
  while (taken.has(`${base} ${i}${ext}`)) i++;
  return `${base} ${i}${ext}`;
}

export function isInside(id, ancestorId) {
  let c = node(id);
  while (c) {
    if (c.id === ancestorId) return true;
    c = node(c.parent);
  }
  return false;
}
export const inTrash = (id) => id !== 'trash' && isInside(id, 'trash');

export function create(pid, data) {
  const now = Date.now();
  const n = {
    id: uid(), parent: pid, type: 'file', kind: 'text', content: '',
    ctime: now, mtime: now, ...data,
  };
  if (n.type === 'folder') n.color ??= 'blue';
  n.name = uniqueName(pid, (n.name || '이름 없음').replace(/\//g, '-'), n.id);
  state.fs[n.id] = n;
  emit('fs');
  return n;
}

let quietTimer;
export function update(id, patch, { quiet = false } = {}) {
  const n = node(id);
  if (!n) return;
  Object.assign(n, patch, { mtime: Date.now() });
  if (quiet) {
    // 입력 중에는 다른 화면을 자주 다시 그리지 않도록 묶어서 알립니다.
    persist();
    clearTimeout(quietTimer);
    quietTimer = setTimeout(() => emit('fs'), 500);
  } else emit('fs');
}

export function rename(id, name) {
  const n = node(id);
  name = (name || '').trim().replace(/\//g, '-');
  if (!n || n.system || !name || name === n.name) return false;
  update(id, { name: uniqueName(n.parent, name, id) });
  return true;
}

export function canMove(id, pid) {
  const n = node(id), p = node(pid);
  return !!(n && p && p.type === 'folder' && !n.system && n.parent !== pid && !isInside(pid, id));
}
export function move(id, pid) {
  if (pid === 'trash') return trash(id);
  if (!canMove(id, pid)) return false;
  const n = node(id);
  n.parent = pid;
  delete n.from;
  n.name = uniqueName(pid, n.name, id);
  n.mtime = Date.now();
  emit('fs');
  return true;
}
export function trash(id) {
  const n = node(id);
  if (!n || n.system || n.parent === 'trash') return false;
  n.from = n.parent;
  n.parent = 'trash';
  n.name = uniqueName('trash', n.name, id);
  emit('fs');
  return true;
}
export function restore(id) {
  const n = node(id);
  if (!n) return;
  const back = n.from && node(n.from) && !inTrash(n.from) ? n.from : 'desktop';
  n.parent = back;
  delete n.from;
  n.name = uniqueName(back, n.name, id);
  emit('fs');
}
function destroyTree(id) {
  children(id).forEach((c) => destroyTree(c.id));
  delete state.fs[id];
}
export function destroy(id) {
  if (node(id)?.system) return;
  destroyTree(id);
  emit('fs');
}
export function emptyTrash() {
  children('trash').forEach((c) => destroyTree(c.id));
  emit('fs');
}
export function duplicate(id) {
  const n = node(id);
  if (!n || n.system) return null;
  const copyTree = (src, pid, name) => {
    const { id: _i, parent: _p, ...rest } = src;
    const now = Date.now();
    const c = { ...rest, id: uid(), parent: pid, ctime: now, mtime: now };
    c.name = uniqueName(pid, name ?? src.name, c.id);
    state.fs[c.id] = c;
    children(src.id).forEach((k) => copyTree(k, c.id));
    return c;
  };
  const [base, ext] = splitExt(n.name);
  const c = copyTree(n, n.parent, `${base} 복사본${n.type === 'folder' ? '' : ext}`);
  emit('fs');
  return c;
}

export function pathOf(id) {
  if (id === 'trash') return '휴지통';
  const parts = [];
  let c = node(id);
  while (c && c.id !== 'home') {
    parts.unshift(c.name);
    c = node(c.parent);
  }
  return '~/' + parts.join('/');
}

export function allNodes(pred = () => true) {
  return Object.values(state.fs).filter((n) => !n.system && !inTrash(n.id) && n.id !== 'trash' && pred(n));
}

export function sizeOf(n) {
  if (n.type === 'folder') return null;
  if (n.kind === 'text') return new Blob([n.content || '']).size;
  if (n.content?.startsWith?.('data:')) return Math.round((n.content.length - n.content.indexOf(',') - 1) * 0.75);
  return 0;
}

/* ---------- 일정 & 할 일 ---------- */
export function addEvent(ev) {
  state.events.push({ id: uid(), ...ev });
  emit('events');
}
export function removeEvent(id) {
  state.events = state.events.filter((e) => e.id !== id);
  emit('events');
}
export function updateEvent(id, patch) {
  const e = state.events.find((x) => x.id === id);
  if (e) Object.assign(e, patch);
  emit('events');
}
// 반복 일정에서 이 날 하루만 빼기
export function skipEventOn(id, dateKey) {
  const e = state.events.find((x) => x.id === id);
  if (e) e.skip = [...new Set([...(e.skip || []), dateKey])];
  emit('events');
}
// 반복 일정(repeat.days: 0=일 … 6=토)은 시작일부터 끝나는 날(until)까지 그 요일마다 보여요.
export function occursOn(e, dateKey) {
  if (!e.repeat?.days?.length) return e.date === dateKey;
  if (dateKey < e.date || (e.repeat.until && dateKey > e.repeat.until) || e.skip?.includes(dateKey)) return false;
  const [y, m, d] = dateKey.split('-').map(Number);
  return e.repeat.days.includes(new Date(y, m - 1, d).getDay());
}
export function eventsOn(dateKey) {
  return state.events
    .filter((e) => occursOn(e, dateKey))
    .sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
}
export function addTodo(text) {
  state.todos.push({ id: uid(), text, done: false });
  emit('todos');
}
export function toggleTodo(id) {
  const t = state.todos.find((t) => t.id === id);
  if (t) t.done = !t.done;
  emit('todos');
}
export function removeTodo(id) {
  state.todos = state.todos.filter((t) => t.id !== id);
  emit('todos');
}

export const dateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
