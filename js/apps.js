// 앱 목록과 실행
import { windowsOf, restore, focus } from './wm.js';
import { openFinder } from './apps/finder.js';
import { openNotes } from './apps/notes.js';
import { openPhotos } from './apps/photos.js';
import { openCalendar } from './apps/calendar.js';
import { openSettings } from './apps/settings.js';

export const APPS = {
  finder: { name: 'Finder', keywords: 'finder 파인더 파일 폴더', open: () => openFinder() },
  notes: { name: '메모', keywords: 'notes 메모 노트 텍스트', open: () => openNotes() },
  photos: { name: '사진', keywords: 'photos 사진 이미지 갤러리', open: () => openPhotos() },
  calendar: { name: '캘린더', keywords: 'calendar 캘린더 달력 일정', open: () => openCalendar() },
  settings: { name: '시스템 설정', keywords: 'settings 설정 환경설정', open: () => openSettings() },
};

/** Dock에서 앱을 누를 때: 열려 있으면 앞으로, 없으면 새로 엽니다. */
export function launch(app) {
  const ws = windowsOf(app).sort((a, b) => b.el.style.zIndex - a.el.style.zIndex);
  if (ws.length) {
    const visible = ws.filter((w) => !w.minimized);
    const target = visible[0] || ws[0];
    restore(target);
    focus(target);
    return { reopened: true };
  }
  APPS[app]?.open();
  return { reopened: false };
}
