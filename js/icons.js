// 아이콘 모음 (모두 직접 그린 SVG)
import { splitExt } from './store.js';

export const FOLDER_COLORS = {
  blue: ['#91b6ff', '#5c85f4', '#6e95fa', '#4b72e4'],
  pink: ['#ffb6d0', '#f17aa6', '#f593b8', '#e0608e'],
  green: ['#a2e7c6', '#4cc795', '#80daaf', '#35b081'],
  purple: ['#cfbcff', '#9b7df2', '#b59dfa', '#8467e5'],
  orange: ['#ffd49e', '#f6a649', '#fbbc6f', '#eb8f30'],
  gray: ['#d5d7e0', '#a2a6b5', '#bdc1cd', '#8e92a2'],
};
export const FOLDER_COLOR_NAMES = { blue: '파랑', pink: '분홍', green: '초록', purple: '보라', orange: '주황', gray: '회색' };

export const TAGS = [
  { key: 'red', name: '빨간색', c: '#ff5f6d' },
  { key: 'orange', name: '주황색', c: '#ff9f43' },
  { key: 'yellow', name: '노란색', c: '#f2c230' },
  { key: 'green', name: '초록색', c: '#36c08a' },
  { key: 'blue', name: '파란색', c: '#4d7cfe' },
  { key: 'purple', name: '보라색', c: '#a26bf5' },
];
export const tagColor = (k) => TAGS.find((t) => t.key === k)?.c;

const GLYPH = {
  desktop: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  documents: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/>',
  downloads: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14"/>',
  pictures: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-8 8"/>',
  home: '<path d="M4 11 12 4l8 7v9H4z"/><path d="M10 20v-5h4v5"/>',
};

export function injectDefs() {
  const grads = Object.entries(FOLDER_COLORS)
    .map(
      ([k, [a, b, c, d]]) => `
    <linearGradient id="g-${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
    <linearGradient id="gb-${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="${d}"/></linearGradient>
    <symbol id="fd-${k}" viewBox="0 0 64 54">
      <path d="M4 8a5 5 0 0 1 5-5h14.5a4 4 0 0 1 2.8 1.2L30 8h25a5 5 0 0 1 5 5v5H4z" fill="url(#gb-${k})"/>
      <rect x="4" y="12.5" width="56" height="38.5" rx="5" fill="url(#g-${k})"/>
      <rect x="4" y="12.5" width="56" height="1.6" rx=".8" fill="#fff" opacity=".45"/>
    </symbol>`
    )
    .join('');
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  el.setAttribute('width', '0');
  el.setAttribute('height', '0');
  el.setAttribute('aria-hidden', 'true');
  el.style.position = 'absolute';
  el.innerHTML = `<defs>${grads}</defs>`;
  document.body.prepend(el);
}

export function folderIcon(color = 'blue', glyph) {
  const g = glyph && GLYPH[glyph]
    ? `<g transform="translate(21.5 20.5) scale(.88)" fill="none" stroke="rgba(20,30,80,.22)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${GLYPH[glyph]}</g>`
    : '';
  return `<svg class="ic" viewBox="0 0 64 54" aria-hidden="true"><use href="#fd-${FOLDER_COLORS[color] ? color : 'blue'}"/>${g}</svg>`;
}

const EXT_COLORS = { md: '#6b7cff', txt: null, json: '#e0a020', csv: '#2fae6b', pdf: '#e5484d', html: '#ef7d3c', js: '#d9b400', c: '#5b7cfa' };

export function docIcon(ext = '') {
  ext = ext.replace('.', '').toLowerCase();
  const color = ext in EXT_COLORS ? EXT_COLORS[ext] : '#8e92a2';
  const badge = ext && ext !== 'txt'
    ? `<rect x="16" y="33" width="${Math.max(18, ext.length * 6.2 + 8)}" height="11" rx="3" fill="${color}"/><text x="${16 + Math.max(18, ext.length * 6.2 + 8) / 2}" y="41.3" font-size="7.6" font-weight="700" fill="#fff" text-anchor="middle" font-family="system-ui,sans-serif">${ext.toUpperCase().slice(0, 5)}</text>`
    : '<g stroke="#cfd0dc" stroke-width="1.8" stroke-linecap="round"><path d="M21 34h22M21 39.5h15"/></g>';
  return `<svg class="ic" viewBox="0 0 64 54" aria-hidden="true">
    <path d="M18 2h19.5L49 13.5V49a3 3 0 0 1-3 3H18a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3z" fill="#fff" stroke="rgba(0,0,0,.09)"/>
    <path d="M37.5 2v8.5a3 3 0 0 0 3 3H49" fill="#eceef5"/>
    <g stroke="#cfd0dc" stroke-width="1.8" stroke-linecap="round"><path d="M21 17h12M21 22.5h22M21 28h22"/></g>${badge}</svg>`;
}

export function fileIcon(n) {
  if (n.type === 'folder') return folderIcon(n.color, n.glyph);
  if (n.kind === 'image') return `<span class="ic thumb"><img src="${n.content}" alt="" loading="lazy" draggable="false"></span>`;
  return docIcon(splitExt(n.name)[1]);
}

/* ---------- UI 아이콘 (선 아이콘) ---------- */
const svg = (p, sw = 2) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;

export const I = {
  left: svg('<path d="m15 18-6-6 6-6"/>', 2.2),
  right: svg('<path d="m9 18 6-6-6-6"/>', 2.2),
  grid: svg('<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>', 1.8),
  list: svg('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r=".6" fill="currentColor"/><circle cx="4.5" cy="12" r=".6" fill="currentColor"/><circle cx="4.5" cy="18" r=".6" fill="currentColor"/>', 1.8),
  folderPlus: svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 10.5v5M9.5 13h5"/>', 1.8),
  upload: svg('<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 20h14"/>', 1.8),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>', 2),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 2),
  x: svg('<path d="M6 6l12 12M18 6 6 18"/>', 2),
  check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>', 2.4),
  trash: svg('<path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13M10 11v5M14 11v5"/>', 1.8),
  restore: svg('<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5"/><path d="M4 4v4.5h4.5"/>', 1.8),
  monitor: svg('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>', 1.8),
  doc: svg('<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/>', 1.8),
  download: svg('<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14"/>', 1.8),
  image: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-8 8"/>', 1.8),
  home: svg('<path d="M4 11 12 4l8 7v9H4z"/>', 1.8),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>', 1.8),
  moon: svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>', 1.8),
  auto: svg('<circle cx="12" cy="12" r="8"/><path d="M12 4v16" /><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>', 1.8),
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/>', 1.8),
  palette: svg('<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 2-2 0-1.5-1.2-1.8-1.2-3 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="14.5" cy="7" r="1.2"/>', 1.6),
  wallpaper: svg('<rect x="3" y="4" width="18" height="16" rx="3"/><path d="m3 16 5-5 4 4 3-3 6 6"/><circle cx="16" cy="9" r="1.5"/>', 1.8),
  database: svg('<ellipse cx="12" cy="5.5" rx="7" ry="2.5"/><path d="M5 5.5v13c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-13M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5"/>', 1.8),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>', 2),
  edit: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/>', 1.8),
  copy: svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>', 1.8),
  calendar: svg('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>', 1.8),
  note: svg('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>', 1.8),
  compose: svg('<path d="M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/><path d="M18.5 3.5a2.1 2.1 0 0 1 3 3L13 15l-4 1 1-4z"/>', 1.8),
  battery: '<svg viewBox="0 0 28 16" aria-hidden="true"><rect x="1" y="2" width="22" height="12" rx="3.5" fill="none" stroke="currentColor" stroke-width="1.3" opacity=".45"/><rect class="bat-fill" x="3" y="4" width="18" height="8" rx="2" fill="currentColor"/><rect x="24.3" y="6" width="2" height="4" rx="1" fill="currentColor" opacity=".45"/></svg>',
  wallpaperFrom: svg('<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M8 12h8M12 8v8"/>', 1.8),
  link: svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>', 1.9),
  globe: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z"/>', 1.7),
  refresh: svg('<path d="M20 12a8 8 0 1 1-2.4-5.7L20 8.5"/><path d="M20 4v4.5h-4.5"/>', 1.8),
  external: svg('<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>', 1.8),
  expand: svg('<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>', 1.8),
};

/* ---------- 앱 아이콘 ---------- */
const appSvg = (p, sw = 2, color = '#fff') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;

export function appIcon(app) {
  switch (app) {
    case 'finder':
      return `<span class="appicon" style="--bg:linear-gradient(160deg,#82b4ff,#4a78f0)">${appSvg('<path d="M3 7.5a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M8.5 13.5c1 1 2.2 1.5 3.5 1.5s2.5-.5 3.5-1.5"/>', 1.9)}</span>`;
    case 'notes':
      return `<span class="appicon" style="--bg:linear-gradient(160deg,#ffe592,#f4b63a)">${appSvg('<rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4"/>', 1.9)}</span>`;
    case 'photos':
      return `<span class="appicon" style="--bg:linear-gradient(160deg,#ffb5cf,#ef6b9b)">${appSvg('<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.7"/><path d="m21 16-5-5-8.5 8"/>', 1.9)}</span>`;
    case 'calendar': {
      const d = new Date();
      return `<span class="appicon cal" style="--bg:linear-gradient(180deg,#ffffff,#eceef4)"><span class="cal-w">${'일월화수목금토'[d.getDay()]}요일</span><span class="cal-d">${d.getDate()}</span></span>`;
    }
    case 'settings':
      return `<span class="appicon" style="--bg:linear-gradient(160deg,#c4c7d2,#7b7f90)">${appSvg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>', 1.6)}</span>`;
    case 'terminal':
      return `<span class="appicon" style="--bg:linear-gradient(160deg,#3b3f4e,#16181f)">${appSvg('<path d="m6 8 4 4-4 4"/><path d="M12.5 16.5H18"/>', 2.1)}</span>`;
    case 'trash':
    case 'trash-full':
      return `<span class="appicon glass" style="--bg:rgba(255,255,255,.45)">${appSvg(
        '<path d="M5 7.5h14l-1.2 12.2a1.5 1.5 0 0 1-1.5 1.3H7.7a1.5 1.5 0 0 1-1.5-1.3z"/><path d="M3.5 7.5h17M9.5 4.5h5"/>' +
          (app === 'trash-full' ? '<path d="M8.5 7.5c.5-2 2-3 3.5-3s3 1 3.5 3" stroke="#a6a9b8"/><path d="M9 12h6M9.5 15.5h5" stroke="#b7bac7"/>' : '<path d="M10 11v6M14 11v6"/>'),
        1.6,
        '#6d7080'
      )}</span>`;
  }
  return '';
}

/** 웹 앱 아이콘: 첫 글자 + 고른 색 */
export function webAppIcon(app) {
  const color = app?.color || '#5b7cfa';
  const letter = String(app?.name || '?').trim().charAt(0).toUpperCase();
  return `<span class="appicon webapp" style="--bg:linear-gradient(160deg,color-mix(in srgb,${color} 70%,white),${color})"><b>${letter.replace(/[<>&"]/g, '')}</b></span>`;
}
