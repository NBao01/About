'use strict';

(() => {

const reader = document.querySelector('.document');
const vertical = reader.classList.contains('vertical-reader');
const links = [...document.querySelectorAll('nav a')];
const expand = document.querySelector('.expand');
const zh = document.documentElement.lang.startsWith('zh');
expand.addEventListener('click', () => {
  const expanded = document.querySelector('.window').classList.toggle('expanded');
  const label = zh ? (expanded ? '還原視窗大小' : '展開視窗') : (expanded ? 'Restore window size' : 'Expand window');
  expand.setAttribute('aria-pressed', String(expanded));
  expand.setAttribute('aria-label', label);
  expand.title = label;
  updateNavigation();
});
function readBy(distance) {
  const limit = Math.max(0, reader.scrollWidth - reader.clientWidth);
  const before = reader.scrollLeft;
  reader.scrollLeft = Math.max(-limit, Math.min(0, before - distance));
  return Math.abs(reader.scrollLeft - before) > 0.01;
}
if (vertical) {
  reader.addEventListener('wheel', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.deltaY) return;
    const unit = event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? reader.clientWidth : 1;
    if (readBy(event.deltaY * unit)) event.preventDefault();
  }, {passive:false});
  reader.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.target.closest('input,textarea,select,button,[contenteditable="true"]')) return;
    const distances = {ArrowDown:60,ArrowUp:-60,PageDown:reader.clientWidth*.8,PageUp:-reader.clientWidth*.8};
    if (event.key in distances && readBy(distances[event.key])) event.preventDefault();
  });
}
reader.setAttribute('tabindex','0');
let navigationTarget = null;
function goTo(link) {
  const section = document.querySelector(link.hash);
  if (!section) return;
  const pane = reader.getBoundingClientRect();
  const rect = section.getBoundingClientRect();
  if (vertical) reader.scrollLeft += rect.right - pane.right + reader.clientLeft;
  else reader.scrollTop += rect.top - pane.top - reader.clientTop - 20;
  navigationTarget = {link, top:reader.scrollTop, left:reader.scrollLeft};
  updateNavigation();
}
for (const link of links) {
  link.addEventListener('click', event => {
    event.preventDefault();
    goTo(link);
    history.replaceState(null, '', link.hash);
  });
}
for (const link of document.querySelectorAll('a[href="#top"]')) {
  link.addEventListener('click', event => {
    event.preventDefault();
    navigationTarget = null;
    reader.scrollTop = 0;
    reader.scrollLeft = 0;
    history.replaceState(null, '', location.pathname + location.search);
    updateNavigation();
  });
}
function updateNavigation() {
  const pane = reader.getBoundingClientRect();
  const position = vertical ? -reader.scrollLeft : reader.scrollTop;
  const extent = Math.max(0, vertical ? reader.scrollWidth - reader.clientWidth : reader.scrollHeight - reader.clientHeight);
  if (navigationTarget && (Math.abs(reader.scrollTop - navigationTarget.top) > 1 || Math.abs(reader.scrollLeft - navigationTarget.left) > 1)) navigationTarget = null;
  const starts = links.map(link => {
    const rect = document.querySelector(link.hash).getBoundingClientRect();
    const start = vertical ? position + pane.right - reader.clientLeft - rect.right : position + rect.top - pane.top - reader.clientTop;
    return Math.max(0, start - (vertical ? 40 : 80));
  });
  // Fit unreachable section starts into the actual scroll range, preserving their order.
  const lastStart = starts[starts.length - 1];
  const scale = lastStart > extent && lastStart > 0 ? extent / lastStart : 1;
  let current = links[0];
  if (navigationTarget) current = navigationTarget.link;
  else if (extent > 2 && position >= extent - 1) current = links[links.length - 1];
  else if (extent > 2 && position > 1) {
    for (let i = 1; i < links.length; i++) {
      if (position >= starts[i] * scale) current = links[i];
    }
  }
  for (const link of links) {
    if (link === current) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
}
// A deliberate navigation click stays selected until the reader moves or scrolls manually.
function resumeScrollTracking() {
  navigationTarget = null;
  requestAnimationFrame(updateNavigation);
}
reader.addEventListener('wheel', resumeScrollTracking, {passive:true});
reader.addEventListener('touchstart', resumeScrollTracking, {passive:true});
reader.addEventListener('pointerdown', resumeScrollTracking, {passive:true});
reader.addEventListener('keydown', event => {
  if (['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','PageDown','PageUp','Home','End',' '].includes(event.key)) resumeScrollTracking();
});
let queued = false;
reader.addEventListener('scroll', () => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {updateNavigation(); queued = false;});
}, {passive:true});
window.addEventListener('resize', updateNavigation);
window.addEventListener('load', () => {
  const initial = links.find(link => link.hash === location.hash);
  if (initial) goTo(initial);
  else {reader.scrollLeft = 0; reader.scrollTop = 0; updateNavigation();}
});

// Resolve language routes against this script, for custom domains and project Pages alike.
const siteRoot = new URL('../', document.currentScript.src);
if ((location.protocol === 'http:' || location.protocol === 'https:') && location.pathname.endsWith('/index.html')) {
  history.replaceState(null, '', location.pathname.slice(0, -10) + location.search + location.hash);
}
const editions = [
  {path:'', label:'English', language:'en'},
  {path:'zh/', label:'中文', language:'zh-Hant'}
];
const editionSelect = document.querySelector('#edition-select');
editionSelect.replaceChildren(...editions.map(edition => {
  const option = document.createElement('option');
  option.value = edition.path; option.textContent = edition.label;
  option.selected = edition.language === document.documentElement.lang;
  return option;
}));
editionSelect.addEventListener('change', event => {
  updateNavigation();
  const active = document.querySelector('nav a[aria-current="location"]');
  const section = active ? active.hash : '#about';
  const destination = new URL(event.target.value, siteRoot);
  destination.hash = section === '#about' ? '' : section;
  location.href = destination.href;
});

// Assemble the mail link on activation instead of embedding a complete address.
for (const link of document.querySelectorAll('[data-email-user][data-email-domain]')) {
  link.addEventListener('click', event => {
    event.preventDefault();
    const address = link.dataset.emailUser + String.fromCharCode(64) + link.dataset.emailDomain;
    location.href = 'mailto:' + address;
  });
}

const pageWindow = document.querySelector('.window');
const closeFallback = document.querySelector('.closed-state');
const reopenLink = document.querySelector('.reopen-link');
const minimizedBar = document.querySelector('.minimized-titlebar');
const minimizeButton = document.querySelector('.minimize-window');
const closeButton = document.querySelector('.close-window');
let windowState = 'open';
let focusBeforeMinimize = null;
function setWindowState(nextState) {
  if (windowState === 'open' && nextState !== 'open') focusBeforeMinimize = document.activeElement;
  windowState = nextState;
  const open = nextState === 'open';
  pageWindow.hidden = !open;
  document.querySelector('.desktop-toy').hidden = nextState !== 'minimized';
  closeFallback.hidden = nextState !== 'closed';
  minimizedBar.hidden = nextState !== 'minimized';
  if (open) requestAnimationFrame(() => {
    updateNavigation();
    const target = focusBeforeMinimize && pageWindow.contains(focusBeforeMinimize) ? focusBeforeMinimize : document.querySelector('.document');
    target.focus({preventScroll:true});
  });
  else if (nextState === 'minimized') minimizedBar.focus();
  else reopenLink.focus();
}
minimizeButton.addEventListener('click', () => setWindowState('minimized'));
closeButton.addEventListener('click', () => {
  try { window.close(); } catch (_) { /* Fall back if this tab cannot be closed. */ }
  setTimeout(() => { if (!window.closed) setWindowState('closed'); }, 200);
});
reopenLink.addEventListener('click', () => setWindowState('open'));
minimizedBar.addEventListener('click', () => setWindowState('open'));
document.querySelector('.window-title').addEventListener('dblclick', () => expand.click());

const strings = {
  en:{moves:'Moves: ',solved:'Signal recovered. Nicely done!',pixel:'Pixel',green:'green',dark:'dark'},
  'zh-Hant':{moves:'步數：',solved:'訊號已復原，做得好！',pixel:'格子',green:'已亮起',dark:'未亮起'}
};
const text = strings[document.documentElement.lang] || strings.en;

const toy = document.querySelector('.desktop-toy');
const board = document.querySelector('.signal-board');
const movesLabel = document.querySelector('.toy-moves');
const resultLabel = document.querySelector('.toy-result');
let pixels = [], startingPixels = [], moves = 0;
function toggleSignal(state, index) {
  const next = state.slice();
  const row = Math.floor(index / 4), col = index % 4;
  for (const [dr,dc] of [[0,0],[-1,0],[1,0],[0,-1],[0,1]]) {
    const r = row + dr, c = col + dc;
    if (r >= 0 && r < 4 && c >= 0 && c < 4) next[r*4+c] = !next[r*4+c];
  }
  return next;
}
function renderSignal() {
  for (let i=0;i<16;i++) {
    board.children[i].setAttribute('aria-pressed', String(pixels[i]));
    board.children[i].setAttribute('aria-label', text.pixel+' '+(Math.floor(i/4)+1)+', '+(i%4+1)+': '+(pixels[i]?text.green:text.dark));
  }
  movesLabel.textContent = text.moves + moves;
  resultLabel.textContent = pixels.every(Boolean) ? text.solved : '';
}
function newSignalPuzzle() {
  pixels = Array(16).fill(true);
  for (let i=0;i<8;i++) pixels = toggleSignal(pixels, Math.floor(Math.random()*16));
  if (pixels.every(Boolean)) pixels = toggleSignal(pixels, 5);
  startingPixels = pixels.slice(); moves = 0; renderSignal();
}
for (let i=0;i<16;i++) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'signal-pixel';
  button.addEventListener('click', () => {pixels = toggleSignal(pixels,i); moves++; renderSignal();});
  board.append(button);
}
document.querySelector('.toy-reset').addEventListener('click', () => {pixels=startingPixels.slice();moves=0;renderSignal();});
document.querySelector('.toy-new').addEventListener('click', newSignalPuzzle);
document.querySelector('.toy-return').addEventListener('click', () => setWindowState('open'));
newSignalPuzzle();

})();



