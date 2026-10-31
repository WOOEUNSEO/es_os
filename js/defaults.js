// 처음 접속했을 때 들어있는 기본 파일과 설정

function art(c1, c2, c3, shape) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">
<defs><radialGradient id="a" cx=".2" cy=".2" r=".9"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c1}" stop-opacity="0"/></radialGradient>
<radialGradient id="b" cx=".85" cy=".3" r=".8"><stop offset="0" stop-color="${c2}"/><stop offset="1" stop-color="${c2}" stop-opacity="0"/></radialGradient>
<radialGradient id="c" cx=".6" cy="1" r=".9"><stop offset="0" stop-color="${c3}"/><stop offset="1" stop-color="${c3}" stop-opacity="0"/></radialGradient>
<filter id="f"><feGaussianBlur stdDeviation="40"/></filter></defs>
<rect width="1600" height="1000" fill="#f6f1fb"/><rect width="1600" height="1000" fill="url(#a)"/><rect width="1600" height="1000" fill="url(#b)"/><rect width="1600" height="1000" fill="url(#c)"/>
<g filter="url(#f)" opacity=".75">${shape}</g></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

const WELCOME = `es OS에 오신 걸 환영해요 ✨

여기는 브라우저 안에 있는 나만의 작은 컴퓨터예요.

■ 기본 사용법
· 아이콘을 더블클릭하면 열려요.
· 마우스 오른쪽 버튼(또는 두 손가락 클릭)으로 메뉴를 열 수 있어요.
· 파일을 끌어서 폴더, 데스크탑, 휴지통으로 옮길 수 있어요.
· 내 컴퓨터의 사진이나 텍스트 파일을 Finder 창에 끌어다 놓으면 가져와져요.
· Ctrl + K (맥은 ⌘ + K)로 검색창을 열 수 있어요. 간단한 계산도 돼요.
· 창 왼쪽 위 노란 버튼은 Dock으로 내리기, 초록 버튼은 크게 보기예요.

■ 꾸미기
시스템 설정에서 다크 모드, 강조 색상, 배경화면을 바꿀 수 있어요.
사진 앱에서 아무 사진이나 배경화면으로 지정할 수도 있어요.

■ 저장에 대해
모든 파일은 지금 쓰는 브라우저 안에 저장돼요.
다른 기기로 옮기거나 혹시 모를 상황에 대비하려면
시스템 설정 → 데이터 → 백업 내보내기를 해두세요.
`;

const IDEAS = `# 부티크 스케줄러 리디자인 아이디어

- 예약 목록을 Finder처럼 폴더(월별)로 보기
- 캘린더 앱 느낌의 주간 보기
- 고객 카드를 파일 아이콘처럼
- 글래스 패널 + 부드러운 창 애니메이션
`;

export function defaultState() {
  const now = Date.now();
  const sys = (id, name, parent, glyph, color = 'blue') => ({
    id, name, parent, type: 'folder', system: true, glyph, color, ctime: now, mtime: now,
  });
  const f = (id, parent, name, extra) => ({ id, parent, name, type: 'file', kind: 'text', content: '', ctime: now, mtime: now, ...extra });
  const folder = (id, parent, name, color) => ({ id, parent, name, type: 'folder', color, ctime: now, mtime: now });

  const fs = {
    home: sys('home', '홈', null, 'home'),
    desktop: sys('desktop', '데스크탑', 'home', 'desktop'),
    documents: sys('documents', '문서', 'home', 'documents'),
    downloads: sys('downloads', '다운로드', 'home', 'downloads'),
    pictures: sys('pictures', '사진', 'home', 'pictures'),
    trash: { id: 'trash', name: '휴지통', parent: null, type: 'folder', system: true, ctime: now, mtime: now },

    welcome: f('welcome', 'desktop', '시작하기.txt', { content: WELCOME }),
    personal: folder('personal', 'desktop', '개인', 'pink'),

    school: folder('school', 'documents', '학교', 'blue'),
    project: folder('project', 'documents', '프로젝트', 'green'),
    diary: folder('diary', 'documents', '일기', 'purple'),
    ideas: f('ideas', 'project', '스케줄러 아이디어.md', { content: IDEAS, tag: 'orange' }),
    readme: f('readme', 'documents', 'README.txt', { content: '문서 폴더예요. 자유롭게 정리해 보세요.' }),
    wish: f('wish', 'personal', '위시리스트.txt', { content: '· 새 키보드\n· 필름 카메라\n· 제주도 여행' }),

    img1: f('img1', 'pictures', '오로라.svg', {
      kind: 'image',
      content: art('#f7c8d9', '#c6d4ff', '#ffd9b8', '<circle cx="800" cy="520" r="260" fill="#b39dff"/><circle cx="1250" cy="760" r="180" fill="#ff9ec4"/>'),
    }),
    img2: f('img2', 'pictures', '민트 바다.svg', {
      kind: 'image',
      content: art('#bff0e2', '#a9d8ff', '#e5f7c8', '<ellipse cx="700" cy="700" rx="520" ry="160" fill="#7fd6c2"/><circle cx="1200" cy="300" r="150" fill="#ffffff"/>'),
    }),
    img3: f('img3', 'pictures', '노을.svg', {
      kind: 'image',
      content: art('#ffc7a8', '#ff9fb4', '#c7a9ff', '<circle cx="800" cy="640" r="230" fill="#ffb26b"/><rect x="0" y="760" width="1600" height="300" fill="#a18cff"/>'),
    }),
  };

  const today = new Date();
  const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return {
    version: 1,
    fs,
    settings: {
      name: 'Eunseo',
      theme: 'light',
      accent: '#5b7cfa',
      wallpaper: 'aurora',
      customWallpaper: null,
      clock24: false,
      finderView: 'grid',
      showWidgets: true,
    },
    events: [{ id: 'e1', date: key, time: '', title: 'es OS 시작 🎉', color: 'blue' }],
    todos: [
      { id: 't1', text: '배경화면 바꿔보기', done: false },
      { id: 't2', text: '사진 가져오기', done: false },
      { id: 't3', text: '첫 메모 쓰기', done: false },
    ],
  };
}
