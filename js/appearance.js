// 테마, 강조 색상, 배경화면 적용
import * as S from './store.js';

export const WALLPAPERS = {
  aurora: {
    name: '오로라',
    css: `radial-gradient(900px 600px at 15% 20%, #f7c8d9 0%, transparent 60%),
      radial-gradient(800px 600px at 85% 15%, #c6d4ff 0%, transparent 60%),
      radial-gradient(900px 700px at 70% 90%, #ffd9b8 0%, transparent 60%),
      radial-gradient(700px 600px at 10% 95%, #c9f0e4 0%, transparent 60%),
      radial-gradient(500px 500px at 45% 50%, #d9cbff 0%, transparent 70%),
      linear-gradient(135deg, #e9e3ff, #fbe9f1)`,
  },
  mint: {
    name: '민트',
    css: `radial-gradient(900px 700px at 20% 15%, #bff0e2 0%, transparent 60%),
      radial-gradient(800px 600px at 85% 25%, #b4dcff 0%, transparent 60%),
      radial-gradient(900px 700px at 60% 100%, #e8f7c8 0%, transparent 60%),
      linear-gradient(160deg, #e6fbf5, #eef4ff)`,
  },
  peach: {
    name: '복숭아',
    css: `radial-gradient(900px 700px at 15% 25%, #ffd3bf 0%, transparent 60%),
      radial-gradient(800px 600px at 90% 20%, #ffc2d4 0%, transparent 60%),
      radial-gradient(900px 700px at 50% 100%, #fff0c4 0%, transparent 60%),
      linear-gradient(150deg, #fff1ea, #ffeaf2)`,
  },
  lilac: {
    name: '라일락',
    css: `radial-gradient(900px 700px at 25% 20%, #d4c4ff 0%, transparent 60%),
      radial-gradient(800px 600px at 85% 70%, #c4d9ff 0%, transparent 60%),
      radial-gradient(700px 600px at 10% 90%, #f3c9f0 0%, transparent 60%),
      linear-gradient(140deg, #efe9ff, #e9f0ff)`,
  },
  dusk: {
    name: '해질녘',
    dark: true,
    css: `radial-gradient(900px 700px at 20% 25%, #5a3f8f 0%, transparent 60%),
      radial-gradient(800px 600px at 85% 20%, #2f4f9b 0%, transparent 60%),
      radial-gradient(900px 700px at 70% 100%, #a1466f 0%, transparent 60%),
      linear-gradient(150deg, #1d1a33, #251a2e)`,
  },
  night: {
    name: '밤하늘',
    dark: true,
    css: `radial-gradient(900px 700px at 80% 10%, #233b6e 0%, transparent 60%),
      radial-gradient(700px 600px at 10% 90%, #3b2a5e 0%, transparent 60%),
      radial-gradient(600px 400px at 50% 50%, #1b2a4a 0%, transparent 70%),
      linear-gradient(170deg, #0e1322, #141127)`,
  },
};

export const ACCENTS = ['#5b7cfa', '#9a6cf2', '#ef5f97', '#f2852e', '#2fb57f', '#2aa7c9', '#6d7080'];

const mq = matchMedia('(prefers-color-scheme: dark)');
mq.addEventListener?.('change', () => applyAppearance());

export function resolvedTheme() {
  const t = S.state.settings.theme;
  return t === 'auto' ? (mq.matches ? 'dark' : 'light') : t;
}

export function wallpaperCss(key = S.state.settings.wallpaper) {
  if (key === 'custom' && S.state.settings.customWallpaper)
    return `center / cover no-repeat url("${S.state.settings.customWallpaper.replace(/"/g, '%22')}")`;
  return (WALLPAPERS[key] || WALLPAPERS.aurora).css;
}

export function applyAppearance() {
  const s = S.state.settings;
  const root = document.documentElement;
  const theme = resolvedTheme();
  root.dataset.theme = theme;
  root.style.setProperty('--accent', s.accent);
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#1d1a2b' : '#efe7fb');
  const wp = document.getElementById('wallpaper');
  if (wp && wp.dataset.k !== s.wallpaper + (s.wallpaper === 'custom' ? s.customWallpaper?.length : '')) {
    wp.dataset.k = s.wallpaper + (s.wallpaper === 'custom' ? s.customWallpaper?.length : '');
    wp.style.background = wallpaperCss();
  }
  document.body.classList.toggle('no-widgets', !s.showWidgets);
  document.body.classList.toggle('wp-dark', s.wallpaper === 'custom' || !!WALLPAPERS[s.wallpaper]?.dark);
}
