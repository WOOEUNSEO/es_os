// 사진: 이미지 모아보기, 크게 보기, 배경화면 지정
import * as S from '../store.js';
import { openWindow, getWindow, focus, restore } from '../wm.js';
import { I } from '../icons.js';
import { esc, importFiles, pickFiles, toast, downloadNode, showMenu, itemMenuItems } from '../ui.js';

const images = () => S.allNodes((n) => n.type === 'file' && n.kind === 'image').sort((a, b) => b.ctime - a.ctime);

export function openPhotos(imageId) {
  const existing = getWindow('photos');
  if (existing) {
    restore(existing);
    focus(existing);
    if (imageId) existing.photos.view(imageId);
    return existing;
  }
  const win = openWindow({ id: 'photos', app: 'photos', title: '사진', w: 860, h: 560, minW: 460, minH: 320, className: 'photos' });
  let viewing = null;

  win.body.innerHTML = `
    <div class="pane">
      <header class="toolbar pad-lights" data-drag>
        <button class="tb back" aria-label="모든 사진" hidden>${I.left}</button>
        <div class="tb-title"><h3>사진</h3><span class="tb-path"></span></div>
        <div class="tb-spacer"></div>
        <div class="viewer-tools" hidden>
          <button class="tb wp" title="배경화면으로 지정" aria-label="배경화면으로 지정">${I.wallpaper}</button>
          <button class="tb dl" title="다운로드" aria-label="다운로드">${I.download}</button>
          <button class="tb rm" title="휴지통으로 이동" aria-label="휴지통으로 이동">${I.trash}</button>
        </div>
        <button class="btn small add">${I.plus}<span>가져오기</span></button>
      </header>
      <div class="photo-grid"></div>
      <div class="viewer" hidden>
        <button class="nav prev" aria-label="이전 사진">${I.left}</button>
        <img alt="">
        <button class="nav next" aria-label="다음 사진">${I.right}</button>
      </div>
    </div>`;

  const $ = (s) => win.body.querySelector(s);
  const grid = $('.photo-grid'), viewer = $('.viewer'), img = viewer.querySelector('img');

  function renderGrid() {
    const list = images();
    $('.tb-path').textContent = viewing ? '' : `${list.length}장`;
    grid.innerHTML = list.length
      ? list.map((n) => `<button class="ph" data-id="${n.id}" title="${esc(n.name)}"><img src="${n.content}" alt="${esc(n.name)}" loading="lazy" draggable="false"></button>`).join('')
      : `<div class="empty">아직 사진이 없어요.<small>오른쪽 위 '가져오기'를 누르거나 사진을 여기로 끌어다 놓아 보세요.</small></div>`;
  }

  function view(id) {
    const n = S.node(id);
    if (!n || S.inTrash(id)) return close();
    viewing = id;
    img.src = n.content;
    img.alt = n.name;
    viewer.hidden = false;
    grid.hidden = true;
    $('.back').hidden = false;
    $('.viewer-tools').hidden = false;
    $('.add').hidden = true;
    $('.tb-title h3').textContent = n.name;
    const list = images(), i = list.findIndex((x) => x.id === id);
    $('.tb-path').textContent = `${i + 1} / ${list.length}`;
    viewer.classList.remove('pop');
    void viewer.offsetWidth;
    viewer.classList.add('pop');
  }
  function close() {
    viewing = null;
    viewer.hidden = true;
    grid.hidden = false;
    $('.back').hidden = true;
    $('.viewer-tools').hidden = true;
    $('.add').hidden = false;
    $('.tb-title h3').textContent = '사진';
    renderGrid();
  }
  function step(d) {
    const list = images();
    if (!list.length) return;
    const i = list.findIndex((x) => x.id === viewing);
    view(list[(i + d + list.length) % list.length].id);
  }

  grid.addEventListener('click', (e) => {
    const b = e.target.closest('.ph');
    if (b) view(b.dataset.id);
  });
  grid.addEventListener('contextmenu', (e) => {
    const b = e.target.closest('.ph');
    if (!b) return;
    e.preventDefault();
    const id = b.dataset.id;
    showMenu(e.clientX, e.clientY, [
      { label: '배경화면으로 지정', icon: I.wallpaper, action: () => setWallpaper(id) },
      ...itemMenuItems([id]),
    ]);
  });
  $('.back').onclick = close;
  $('.prev').onclick = () => step(-1);
  $('.next').onclick = () => step(1);
  $('.wp').onclick = () => setWallpaper(viewing);
  $('.dl').onclick = () => downloadNode(S.node(viewing));
  $('.rm').onclick = () => {
    const list = images(), i = list.findIndex((x) => x.id === viewing);
    S.trash(viewing);
    const rest = images();
    rest.length ? view(rest[Math.min(i, rest.length - 1)].id) : close();
  };
  $('.add').onclick = async () => {
    const files = await pickFiles({ accept: 'image/*' });
    if (files?.length) importFiles(files, 'pictures');
  };

  // 사진 끌어다 놓기
  const pane = $('.pane');
  pane.addEventListener('dragover', (e) => {
    if (e.dataTransfer.types.includes('Files')) (e.preventDefault(), pane.classList.add('drop-over'));
  });
  pane.addEventListener('dragleave', (e) => !pane.contains(e.relatedTarget) && pane.classList.remove('drop-over'));
  pane.addEventListener('drop', (e) => {
    pane.classList.remove('drop-over');
    if (!e.dataTransfer.files.length) return;
    e.preventDefault();
    const imgs = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
    if (imgs.length) importFiles(imgs, 'pictures');
    else toast('사진 파일만 가져올 수 있어요.');
  });

  win.onKey = (e) => {
    if (!viewing) return;
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'Escape') close();
  };

  win.cleanups.push(S.on('fs', () => (viewing ? S.node(viewing) && !S.inTrash(viewing) ? null : close() : renderGrid())));
  win.photos = { view };
  renderGrid();
  if (imageId) view(imageId);
  return win;
}

export function setWallpaper(id) {
  const n = S.node(id);
  if (!n) return;
  S.state.settings.customWallpaper = n.content;
  S.setSetting('wallpaper', 'custom');
  toast('배경화면을 바꿨어요.');
}
