import * as S from './store.js';
import { injectDefs } from './icons.js';
import { applyAppearance } from './appearance.js';
import { initShell } from './shell.js';
import { openNotes } from './apps/notes.js';

await S.init();
injectDefs();
applyAppearance();
S.on('settings', applyAppearance);

initShell({
  afterUnlock: () => {
    // 처음 방문했다면 안내 메모를 열어 둡니다.
    if (!S.state.settings.welcomed) {
      S.setSetting('welcomed', true);
      if (S.node('welcome')) openNotes('welcome');
    }
  },
});

document.body.classList.add('ready');

// 브라우저 기본 우클릭 메뉴는 입력칸에서만 허용합니다.
addEventListener('contextmenu', (e) => {
  if (!e.target.closest('input, textarea')) e.preventDefault();
});
