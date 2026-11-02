// 터미널: es OS 안의 파일(데스크탑 · 문서 …)을 리눅스 명령어처럼 다뤄 보는 연습용 셸.
// 진짜 컴퓨터를 건드리지 않고, 브라우저에 저장된 파일만 바꿔요.
import * as S from '../store.js';
import { openWindow, getWindow, focus, restore, close } from '../wm.js';
import { esc } from '../ui.js';

const HOME = 'home';
const HELP = [
  ['pwd', '지금 있는 위치'],
  ['ls [-l] [경로]', '파일 목록 (-l: 자세히)'],
  ['cd <경로>', '폴더 이동 (cd .. · cd ~ · cd -)'],
  ['mkdir [-p] <이름>', '폴더 만들기'],
  ['touch <이름>', '빈 파일 만들기'],
  ['cat <파일>', '파일 내용 보기'],
  ['echo <글> [> 파일 | >> 파일]', '글 출력 · 파일에 쓰기 / 이어 쓰기'],
  ['cp <원본> <대상>', '복사'],
  ['mv <원본> <대상>', '옮기기 · 이름 바꾸기'],
  ['rm [-r] <경로>', '휴지통으로 보내기'],
  ['rmdir <폴더>', '빈 폴더 지우기'],
  ['head / tail [-n N] <파일>', '앞 · 뒤 N줄'],
  ['wc <파일>', '줄 · 단어 · 글자 수'],
  ['grep [-i] [-n] <글> <파일>', '파일에서 글 찾기'],
  ['find [경로] -name <패턴>', '이름으로 찾기 (* 사용 가능)'],
  ['tree [경로]', '폴더 구조 그리기'],
  ['sort / uniq <파일>', '줄 정렬 · 중복 제거'],
  ['명령 | 명령', '파이프 (예: cat a.txt | grep 사과 | wc -l)'],
  ['date · whoami · hostname · uname', '시스템 정보'],
  ['history · clear · exit', '기록 · 화면 지우기 · 닫기'],
  ['open <파일>', 'es OS 앱으로 열기'],
  ['chmod · sudo · ps · kill', '연습용 흉내 (실제로 바뀌지 않음)'],
];

export function openTerminal() {
  const ex = getWindow('terminal');
  if (ex) { restore(ex); focus(ex); ex.term?.input.focus(); return ex; }
  const win = openWindow({ id: 'terminal', app: 'terminal', title: '터미널', w: 760, h: 480, minW: 420, minH: 260, className: 'terminal' });
  win.body.innerHTML = `
    <header class="term-bar" data-drag><span class="term-title"></span></header>
    <div class="term-out" tabindex="0" aria-live="polite"></div>
    <label class="term-line"><span class="term-ps"></span><input class="term-in" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="명령어 입력"></label>`;
  const out = win.body.querySelector('.term-out');
  const input = win.body.querySelector('.term-in');
  const ps = win.body.querySelector('.term-ps');
  const title = win.body.querySelector('.term-title');
  const user = () => (S.state.settings.name || 'user').trim().toLowerCase().replace(/\s+/g, '') || 'user';
  let cwd = 'desktop';
  let prev = HOME;
  const hist = S.state.termHistory || (S.state.termHistory = []);
  let hi = hist.length;

  const shortPath = (id) => (id === HOME ? '~' : S.pathOf(id));
  const prompt = () => `${user()}@es-os ${shortPath(cwd)} %`;
  const refreshPs = () => { ps.textContent = prompt(); title.textContent = `${user()} — ${shortPath(cwd)} — zsh`; };
  const print = (html, cls = '') => { const d = document.createElement('div'); d.className = `tl ${cls}`; d.innerHTML = html; out.appendChild(d); out.scrollTop = out.scrollHeight; };

  // ---------- 경로 ----------
  const childNamed = (pid, name) => S.children(pid).find((n) => n.name === name);
  function resolve(path, base = cwd) {
    if (!path || path === '~') return HOME;
    let cur = path.startsWith('/') || path.startsWith('~') ? HOME : base;
    const parts = path.replace(/^~\/?/, '').replace(/^\//, '').split('/').filter(Boolean);
    for (const part of parts) {
      if (part === '.') continue;
      if (part === '..') { const n = S.node(cur); cur = n?.parent && n.id !== HOME ? n.parent : HOME; continue; }
      const c = childNamed(cur, part);
      if (!c) return null;
      cur = c.id;
    }
    return cur;
  }
  function parentAndName(path) {
    const i = path.lastIndexOf('/');
    const dir = i >= 0 ? path.slice(0, i) || '/' : '.';
    const name = i >= 0 ? path.slice(i + 1) : path;
    return { pid: resolve(dir), name };
  }
  const isDir = (id) => S.node(id)?.type === 'folder';
  const textOf = (id) => { const n = S.node(id); return n?.kind === 'text' ? String(n.content || '') : `[${n?.kind || '파일'} 파일은 터미널에서 내용을 볼 수 없어요]`; };
  const err = (m) => { throw new Error(m); };
  const need = (id, p) => id || err(`${p}: 그런 파일이나 폴더가 없어요`);
  const linesOf = (t) => (t.endsWith('\n') ? t.slice(0, -1) : t).split('\n');

  // ---------- 명령 ----------
  function tokenize(line) {
    const out = [];
    let cur = '', q = null, has = false;
    for (const ch of line) {
      if (q) { if (ch === q) q = null; else cur += ch; continue; }
      if (ch === '"' || ch === "'") { q = ch; has = true; continue; }
      if (/\s/.test(ch)) { if (cur || has) out.push(cur); cur = ''; has = false; continue; }
      cur += ch;
    }
    if (cur || has) out.push(cur);
    return out;
  }
  const flags = (args) => {
    const f = new Set(); const rest = [];
    args.forEach((a) => (/^-[a-zA-Z]+$/.test(a) ? [...a.slice(1)].forEach((c) => f.add(c)) : rest.push(a)));
    return { f, rest };
  };
  const fmtTime = (t) => new Date(t).toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '');

  function writeFile(path, text, append) {
    let id = resolve(path);
    if (id && isDir(id)) err(`${path}: 폴더에는 쓸 수 없어요`);
    if (!id) {
      const { pid, name } = parentAndName(path);
      if (!pid || !isDir(pid)) err(`${path}: 그런 폴더가 없어요`);
      id = S.create(pid, { name, kind: 'text', content: '' }).id;
    }
    const n = S.node(id);
    S.update(id, { content: append ? (n.content || '') + text : text });
  }

  const CMDS = {
    help: () => HELP.map(([c, d]) => `<span class="t-cmd">${esc(c.padEnd(30))}</span>${esc(d)}`).join('\n'),
    pwd: () => S.pathOf(cwd).replace(/^~/, `/home/${user()}`),
    whoami: () => user(),
    hostname: () => 'es-os',
    uname: (a) => (a.includes('-a') ? 'esOS 1.0 es-os browser-arm64 JavaScript' : 'esOS'),
    date: () => new Date().toString().replace(/ \(.+\)$/, ''),
    echo: (a) => a.join(' '),
    clear: () => { out.innerHTML = ''; return null; },
    exit: () => { setTimeout(() => close(win), 60); return null; },
    history: () => hist.map((h, i) => `${String(i + 1).padStart(4)}  ${esc(h)}`).join('\n'),
    cd: ([p]) => {
      const target = p === '-' ? prev : resolve(p ?? '~');
      need(target, `cd: ${p}`);
      if (!isDir(target)) err(`cd: ${p}: 폴더가 아니에요`);
      prev = cwd; cwd = target; refreshPs(); return null;
    },
    ls: (args) => {
      const { f, rest } = flags(args);
      const id = need(resolve(rest[0] || '.'), `ls: ${rest[0]}`);
      const items = isDir(id) ? S.children(id) : [S.node(id)];
      const vis = items.filter((n) => f.has('a') || !n.name.startsWith('.'));
      if (f.has('l')) {
        return `total ${vis.length}\n` + vis.map((n) => {
          const dir = n.type === 'folder';
          return `${dir ? 'drwxr-xr-x' : '-rw-r--r--'}  ${user()}  ${String(dir ? S.children(n.id).length : S.sizeOf(n)).padStart(7)}  ${fmtTime(n.mtime)}  ${dir ? `<span class="t-dir">${esc(n.name)}/</span>` : esc(n.name)}`;
        }).join('\n');
      }
      return vis.map((n) => (n.type === 'folder' ? `<span class="t-dir">${esc(n.name)}/</span>` : esc(n.name))).join('   ');
    },
    mkdir: (args) => {
      const { f, rest } = flags(args);
      if (!rest.length) err('mkdir: 폴더 이름을 적어 주세요');
      rest.forEach((p) => {
        if (resolve(p)) { if (!f.has('p')) err(`mkdir: ${p}: 이미 있어요`); return; }
        let cur = p.startsWith('/') || p.startsWith('~') ? HOME : cwd;
        const parts = p.replace(/^~\/?/, '').replace(/^\//, '').split('/').filter(Boolean);
        parts.forEach((part, i) => {
          const ex = part === '..' ? S.node(cur)?.parent : childNamed(cur, part)?.id;
          if (ex) { cur = ex; return; }
          if (!f.has('p') && i < parts.length - 1) err(`mkdir: ${p}: 그런 폴더가 없어요 (-p를 쓰면 한 번에 만들어요)`);
          cur = S.create(cur, { type: 'folder', name: part }).id;
        });
      });
      return null;
    },
    touch: (args) => {
      if (!args.length) err('touch: 파일 이름을 적어 주세요');
      args.forEach((p) => { const id = resolve(p); id ? S.update(id, {}) : writeFile(p, '', false); });
      return null;
    },
    cat: (args, stdin) => (args.length ? args.map((p) => { const id = need(resolve(p), `cat: ${p}`); if (isDir(id)) err(`cat: ${p}: 폴더예요`); return esc(textOf(id)); }).join('\n') : esc(stdin ?? '')),
    head: (args, stdin, tail = false) => {
      let n = 10; const rest = [];
      for (let i = 0; i < args.length; i++) { if (args[i] === '-n') n = parseInt(args[++i], 10) || 10; else if (/^-\d+$/.test(args[i])) n = -parseInt(args[i], 10); else rest.push(args[i]); }
      const t = rest.length ? textOf(need(resolve(rest[0]), `${tail ? 'tail' : 'head'}: ${rest[0]}`)) : (stdin ?? '');
      const ls = linesOf(t);
      return esc((tail ? ls.slice(-n) : ls.slice(0, n)).join('\n'));
    },
    tail: (args, stdin) => CMDS.head(args, stdin, true),
    wc: (args, stdin) => {
      const { f, rest } = flags(args);
      const t = rest.length ? textOf(need(resolve(rest[0]), `wc: ${rest[0]}`)) : (stdin ?? '');
      const l = t ? linesOf(t).length : 0, w = t.split(/\s+/).filter(Boolean).length, c = [...t].length;
      if (f.has('l')) return String(l);
      if (f.has('w')) return String(w);
      if (f.has('c') || f.has('m')) return String(c);
      return `${String(l).padStart(7)}${String(w).padStart(8)}${String(c).padStart(8)}${rest[0] ? ' ' + esc(rest[0]) : ''}`;
    },
    grep: (args, stdin) => {
      const { f, rest } = flags(args);
      const [pat, file] = rest;
      if (!pat) err('grep: 찾을 글을 적어 주세요');
      const t = file ? textOf(need(resolve(file), `grep: ${file}`)) : (stdin ?? '');
      const re = new RegExp(pat.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*'), f.has('i') ? 'i' : '');
      const hits = linesOf(t).map((l, i) => [l, i + 1]).filter(([l]) => re.test(l) !== f.has('v'));
      if (f.has('c')) return String(hits.length);
      return hits.map(([l, i]) => `${f.has('n') ? `<span class="t-dim">${i}:</span>` : ''}${esc(l).replace(new RegExp(re.source, re.flags + 'g'), (m) => `<mark>${m}</mark>`)}`).join('\n');
    },
    sort: (args, stdin) => { const { f, rest } = flags(args); const t = rest[0] ? textOf(need(resolve(rest[0]), `sort: ${rest[0]}`)) : (stdin ?? ''); const ls = linesOf(t).sort((a, b) => (f.has('n') ? parseFloat(a) - parseFloat(b) : a.localeCompare(b, 'ko'))); return esc((f.has('r') ? ls.reverse() : ls).join('\n')); },
    uniq: (args, stdin) => { const t = args[0] ? textOf(need(resolve(args[0]), `uniq: ${args[0]}`)) : (stdin ?? ''); return esc(linesOf(t).filter((l, i, a) => i === 0 || l !== a[i - 1]).join('\n')); },
    rm: (args) => {
      const { f, rest } = flags(args);
      if (!rest.length) err('rm: 지울 파일을 적어 주세요');
      rest.forEach((p) => {
        const id = need(resolve(p), `rm: ${p}`);
        if (S.node(id).system) err(`rm: ${p}: 기본 폴더는 지울 수 없어요`);
        if (isDir(id) && !f.has('r')) err(`rm: ${p}: 폴더예요 (rm -r 을 쓰세요)`);
        S.trash(id);
      });
      return null;
    },
    rmdir: ([p]) => { const id = need(resolve(p), `rmdir: ${p}`); if (!isDir(id)) err(`rmdir: ${p}: 폴더가 아니에요`); if (S.children(id).length) err(`rmdir: ${p}: 폴더가 비어 있지 않아요`); S.trash(id); return null; },
    mv: ([a, b]) => {
      if (!a || !b) err('사용법: mv <원본> <대상>');
      const id = need(resolve(a), `mv: ${a}`);
      const t = resolve(b);
      if (t && isDir(t)) { if (!S.move(id, t)) err(`mv: ${a}: 옮길 수 없어요`); return null; }
      const { pid, name } = parentAndName(b);
      if (!pid) err(`mv: ${b}: 그런 폴더가 없어요`);
      if (pid !== S.node(id).parent && !S.move(id, pid)) err(`mv: ${a}: 옮길 수 없어요`);
      if (name && name !== S.node(id).name) S.rename(id, name);
      return null;
    },
    cp: (args) => {
      const { rest } = flags(args);
      const [a, b] = rest;
      if (!a || !b) err('사용법: cp <원본> <대상>');
      const id = need(resolve(a), `cp: ${a}`);
      const c = S.duplicate(id);
      const t = resolve(b);
      if (t && isDir(t)) { S.move(c.id, t); S.rename(c.id, S.node(id).name); return null; }
      const { pid, name } = parentAndName(b);
      if (!pid) err(`cp: ${b}: 그런 폴더가 없어요`);
      if (pid !== c.parent) S.move(c.id, pid);
      S.rename(c.id, name);
      return null;
    },
    find: (args) => {
      let base = '.', pat = '*';
      for (let i = 0; i < args.length; i++) { if (args[i] === '-name') pat = args[++i] || '*'; else base = args[i]; }
      const root = need(resolve(base), `find: ${base}`);
      const re = new RegExp('^' + pat.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$', 'i');
      const outL = [];
      const walk = (id, path) => S.children(id).forEach((n) => { const p = `${path}/${n.name}`; if (re.test(n.name)) outL.push(esc(p)); if (n.type === 'folder') walk(n.id, p); });
      walk(root, base === '.' ? '.' : base.replace(/\/$/, ''));
      return outL.join('\n');
    },
    tree: ([p]) => {
      const root = need(resolve(p || '.'), `tree: ${p}`);
      let dirs = 0, files = 0;
      const lines = [esc(p || '.')];
      const walk = (id, pre) => {
        const kids = S.children(id);
        kids.forEach((n, i) => {
          const last = i === kids.length - 1;
          lines.push(`${pre}${last ? '└── ' : '├── '}${n.type === 'folder' ? `<span class="t-dir">${esc(n.name)}</span>` : esc(n.name)}`);
          if (n.type === 'folder') { dirs++; walk(n.id, pre + (last ? '    ' : '│   ')); } else files++;
        });
      };
      walk(root, '');
      return lines.join('\n') + `\n\n${dirs} directories, ${files} files`;
    },
    open: ([p]) => { const id = need(resolve(p), `open: ${p}`); import('../ui.js').then((m) => m.openNode(id)); return null; },
    chmod: () => '<span class="t-dim">(연습용) 권한 표시는 바뀌지 않아요. 실제 리눅스에서는 chmod 755 파일 처럼 써요.</span>',
    sudo: (a) => (a.length ? `<span class="t-dim">[sudo] ${user()}의 비밀번호: ****</span>\n` + run(a.join(' '), true) : 'usage: sudo 명령'),
    ps: () => `  PID TTY      TIME CMD\n  101 ttys000  0:00.04 zsh\n  ${200 + Math.floor(Math.random() * 99)} ttys000  0:00.01 ps`,
    kill: ([pid]) => (pid ? `<span class="t-dim">(연습용) ${esc(pid)}번 프로세스에 신호를 보냈다고 가정해요.</span>` : 'kill: 사용법: kill <PID>'),
    man: ([c]) => { const h = HELP.find(([x]) => x.split(/[\s/[]/)[0] === c); return h ? `<span class="t-cmd">${esc(h[0])}</span>\n    ${esc(h[1])}` : `${esc(c || '')}: 설명이 없어요. help 로 전체 목록을 볼 수 있어요.`; },
  };

  function runOne(seg, stdin) {
    let redir = null;
    // 따옴표 밖에 있는 > 또는 >> 를 찾는다
    let q = null, at = -1;
    for (let i = 0; i < seg.length; i++) {
      const ch = seg[i];
      if (q) { if (ch === q) q = null; continue; }
      if (ch === '"' || ch === "'") q = ch;
      else if (ch === '>') { at = i; break; }
    }
    if (at >= 0) {
      const op = seg[at + 1] === '>' ? '>>' : '>';
      const file = tokenize(seg.slice(at + op.length))[0];
      if (!file) err('파일 이름을 적어 주세요 (예: echo 안녕 > 인사.txt)');
      redir = { op, file };
      seg = seg.slice(0, at);
    }
    const [cmd, ...args] = tokenize(seg);
    if (!cmd) return '';
    const fn = CMDS[cmd];
    if (!fn) err(`zsh: command not found: ${cmd}  (help 로 쓸 수 있는 명령어를 볼 수 있어요)`);
    let res = fn(args, stdin);
    if (redir) {
      const plain = String(res ?? '').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      writeFile(redir.file, plain + '\n', redir.op === '>>');
      return null;
    }
    return res;
  }
  function run(line, nested = false) {
    const segs = [];
    let q = null, cur = '';
    for (const ch of line) {
      if (q) { if (ch === q) q = null; cur += ch; continue; }
      if (ch === '"' || ch === "'") q = ch;
      if (ch === '|') { segs.push(cur); cur = ''; continue; }
      cur += ch;
    }
    segs.push(cur);
    let data;
    for (let i = 0; i < segs.length; i++) {
      const res = runOne(segs[i], data);
      data = res == null ? '' : String(res).replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      if (i === segs.length - 1) return segs.length > 1 ? esc(data) : res;
    }
    return nested ? '' : null;
  }

  function exec(line) {
    print(`<span class="t-ps">${esc(prompt())}</span> ${esc(line)}`);
    if (!line.trim()) return;
    hist.push(line); if (hist.length > 200) hist.shift(); hi = hist.length; S.persist();
    try {
      const res = run(line);
      if (res != null && res !== '') print(res, 'pre');
    } catch (e) {
      print(esc(e.message), 'err');
    }
  }

  // 탭 자동완성: 명령어 · 파일 이름
  function complete() {
    const v = input.value;
    const parts = v.split(/\s+/);
    const last = parts[parts.length - 1];
    let options;
    if (parts.length === 1) options = Object.keys(CMDS).filter((c) => c.startsWith(last));
    else {
      const i = last.lastIndexOf('/');
      const dir = i >= 0 ? last.slice(0, i + 1) : '';
      const pid = resolve(dir || '.');
      if (!pid) return;
      options = S.children(pid).map((n) => dir + n.name + (n.type === 'folder' ? '/' : '')).filter((n) => n.startsWith(last));
    }
    if (options.length === 1) { parts[parts.length - 1] = options[0].includes(' ') ? `"${options[0]}"` : options[0]; input.value = parts.join(' ') + (options[0].endsWith('/') ? '' : ' '); }
    else if (options.length > 1) print(options.map(esc).join('   '), 'pre dim');
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { exec(input.value); input.value = ''; }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (hi > 0) input.value = hist[--hi] || ''; }
    else if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.min(hist.length, hi + 1); input.value = hist[hi] || ''; }
    else if (e.key === 'Tab') { e.preventDefault(); complete(); }
    else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); out.innerHTML = ''; }
    else if (e.key === 'c' && e.ctrlKey && !window.getSelection()?.toString()) { print(`<span class="t-ps">${esc(prompt())}</span> ${esc(input.value)}^C`); input.value = ''; }
  });
  win.body.addEventListener('pointerup', () => { if (!window.getSelection()?.toString()) input.focus(); });

  refreshPs();
  print(`Last login: ${new Date().toString().slice(0, 24)} on ttys000\n<span class="t-dim">es OS 연습용 터미널이에요. help 를 입력하면 쓸 수 있는 명령어가 나와요.\n여기서 만든 파일 · 폴더는 Finder에도 그대로 보여요. (rm 은 휴지통으로 보내요)</span>`, 'pre');
  setTimeout(() => input.focus(), 50);
  win.term = { input };
  return win;
}
