// Si det – main app.
import { SIZES, STARTER, FORMS, DEFAULT_SIZE, baseCells, pagesOf } from './vocab.js';
import { SYMBOLS } from './symbols.js';
import { kv, blobs, askToKeepData, exportBackup, importBackup } from './store.js';
import * as speech from './speech.js';

export const VERSION = '0.3.0';

const CLASSES = [
  ['pron', 'Pronomen'], ['verb', 'Verb'], ['desc', 'Beskrivende'], ['noun', 'Ting og folk'],
  ['prep', 'Sted'], ['soc', 'Sosialt'], ['ques', 'Spørsmål'], ['adv', 'Adverb'], ['neg', 'Nei og stopp'],
  ['fras', 'Frase'],
];
const DEFAULTS = { voiceURI: speech.OWN_VOICE, rate: 0.9, volume: speech.DEFAULT_VOLUME, forms: true, lockoutMs: 600, fit: true };
const HOLD_MS = 2000; // grown-up button
const FORM_HOLD_MS = 550; // hold a word to see its other forms

const $ = (sel) => document.querySelector(sel);
const grid = $('#grid');
const formsEl = $('#forms');

const state = {
  profiles: [], // [{ id, name, size, photo }]
  pid: null,
  page: 'core',
  editing: false, // false | 'edit' | 'reveal'
  settings: { ...DEFAULTS },
  overrides: {}, // cell key -> changes made by a grown-up
  cells: [],
  lastTap: new Map(),
  urls: new Map(), // blob key -> object URL
};

const profile = () => state.profiles.find((p) => p.id === state.pid);
const sizeId = () => (SIZES[profile()?.size] ? profile().size : DEFAULT_SIZE);
const pk = (name, id = state.pid) => `p:${id}:${name}`;

// ---------- Vocabulary model ----------

const word = ([label, cls, en]) => ({ label, cls, sym: SYMBOLS[`${label}|${en}`] ?? null });

function cellFrom(base) {
  let cell = base.word ? { key: base.key, folder: base.folder, ...word(base.word) } : { key: base.key, empty: true };
  const ov = state.overrides[base.key];
  if (ov) cell = ov.removed ? { key: base.key, empty: true } : { ...cell, ...ov, empty: false };
  // The child's own photo on "jeg", unless a grown-up chose another picture.
  if (!cell.empty && cell.label === 'jeg' && !cell.img && profile()?.photo) cell = { ...cell, img: profile().photo };
  return cell;
}

async function imgSrc(cell) {
  if (cell.img) {
    if (!state.urls.has(cell.img)) {
      const b = await blobs.get(cell.img);
      if (b) state.urls.set(cell.img, URL.createObjectURL(b));
    }
    return state.urls.get(cell.img) || '';
  }
  if (cell.lib) return `library/${cell.lib}.png`;
  return cell.sym ? `symbols/${cell.sym}.png` : '';
}

// ---------- Picture library: type a word, get its picture ----------

let LIB = null;
const library = async () => (LIB ??= (await import('./library.js')).LIBRARY);
const ENDINGS = ['ene', 'en', 'et', 'er', 'a', 'e', 'r']; // katten → katt, hundene → hund

// Pictures for a word, best first: the hand-picked board pictures, then the library.
async function findPictures(text) {
  const w = text.trim().toLowerCase();
  if (!w) return [];
  const lib = await library();
  const out = [];
  const push = (p) => { if (out.length < 12 && !out.some((o) => o.sym === p.sym && o.lib === p.lib)) out.push(p); };
  const fromLib = (word) => (lib[word] || []).forEach((id) => push({ lib: id }));
  for (const [k, id] of Object.entries(SYMBOLS)) if (k.slice(0, k.indexOf('|')).toLowerCase() === w) push({ sym: id });
  fromLib(w);
  if (!out.length) for (const end of ENDINGS) if (w.endsWith(end) && lib[w.slice(0, -end.length)]) { fromLib(w.slice(0, -end.length)); break; }
  // A phrase ("jeg vil ha katt"): use the last word that has a picture.
  if (!out.length && w.includes(' ')) for (const part of w.split(/\s+/).reverse()) if (lib[part]) { fromLib(part); break; }
  // Still nothing: words that start with what was typed (at least 3 letters).
  if (!out.length && w.length >= 3) for (const [k, ids] of Object.entries(lib)) if (k.startsWith(w)) ids.slice(0, 2).forEach((id) => push({ lib: id }));
  return out;
}

// ---------- Rendering ----------

// "Tilpass til skjermen": when words are hidden, leave out the gaps and let the
// visible keys fill the screen. Keys keep their order column by column, so
// jeg/vil stay on the left and the folders on the right. Grown-ups editing the
// board always see the real fixed grid.
function fitLayout(n) {
  const w = grid.clientWidth || innerWidth;
  const h = grid.clientHeight || innerHeight;
  let best = null;
  for (let rows = 1; rows <= n; rows++) {
    const cols = Math.ceil(n / rows);
    // Biggest key wins; keys may be a little wider than tall, not much taller than wide.
    const score = Math.min(w / cols, (h / rows) * 1.3);
    if (!best || score > best.score + 0.5) best = { rows, cols, score };
  }
  return best;
}

// Only the newest render may draw: a tap during a slow render must not be undone.
let renderToken = 0;
async function renderGrid() {
  const my = ++renderToken;
  const id = sizeId();
  const size = SIZES[id];
  if (!size.pages[state.page]) state.page = 'core';
  const page = state.page;
  const cells = baseCells(id, page).map(cellFrom);
  state.cells = cells;
  let shown = cells;
  let cols = size.cols;
  let rows = size.rows;
  const visible = cells.filter((c) => !c.empty && !c.hidden);
  const fit = state.settings.fit && !state.editing && visible.length && visible.length < cells.length;
  if (fit) {
    // Column by column, as on the full board.
    shown = cells.map((c, i) => ({ c, r: Math.floor(i / size.cols), col: i % size.cols }))
      .filter(({ c }) => !c.empty && !c.hidden)
      .sort((a, b) => a.col - b.col || a.r - b.r)
      .map(({ c }) => c);
    ({ cols, rows } = fitLayout(shown.length));
  }
  const n = cols * rows;
  grid.dataset.size = fit ? (n <= 12 ? 'small' : n <= 24 ? 'medium' : id) : id;
  grid.toggleAttribute('data-fit', !!fit);
  grid.style.setProperty('--cols', cols);
  grid.style.setProperty('--rows', rows);
  const frag = document.createDocumentFragment();
  for (const cell of shown) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'key';
    el.dataset.key = cell.key;
    const hiddenForChild = cell.hidden && !state.editing;
    if (cell.empty || hiddenForChild) {
      el.classList.add('empty');
      el.setAttribute('aria-hidden', 'true');
      const addable = state.editing === 'edit' && cell.empty;
      el.tabIndex = addable ? 0 : -1;
      if (addable) { el.removeAttribute('aria-hidden'); el.setAttribute('aria-label', 'Legg til ord'); }
    } else {
      el.classList.add(`c-${cell.cls || 'noun'}`);
      if (cell.folder) {
        el.classList.add('folder');
        if (cell.folder === page) { el.classList.add('open'); el.setAttribute('aria-current', 'page'); }
      }
      if (cell.hidden) el.classList.add('is-hidden');
      const img = document.createElement('img');
      img.alt = '';
      img.decoding = 'async';
      img.src = await imgSrc(cell);
      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = cell.label;
      el.append(img, label);
    }
    frag.append(el);
  }
  if (my === renderToken) grid.replaceChildren(frag);
}

async function renderWho() {
  const p = profile();
  $('#who-name').textContent = p.name;
  $('#menu-child').textContent = p.name;
  const img = $('#who-photo');
  img.hidden = !p.photo;
  if (p.photo) img.src = await imgSrc({ img: p.photo });
}

// ---------- Speaking ----------

async function partFor(cell) {
  return { text: cell.say || cell.label, audio: cell.audio ? await blobs.get(cell.audio) : null };
}

// ---------- Tapping ----------

const cellByKey = (key) => state.cells.find((c) => c.key === key) || null;

async function activate(key) {
  const cell = cellByKey(key);
  if (!cell) return;
  if (state.editing === 'edit') return openEditor(cell);
  if (state.editing === 'reveal') return cell.empty ? undefined : toggleHidden(cell);
  if (cell.empty || cell.hidden) return;

  const now = performance.now();
  const last = state.lastTap.get(key) ?? -Infinity;
  if (now - last < state.settings.lockoutMs) return;
  state.lastTap.set(key, now);

  if (cell.folder) {
    state.page = state.page === cell.folder ? 'core' : cell.folder;
    renderGrid();
  }
  // Every tap is said straight away. Nothing is collected in a sentence.
  speech.say(await partFor(cell), state.settings);
}

const formsOf = (cell) => (!cell || cell.empty || cell.folder || cell.say ? null : FORMS[cell.label] || null);

// Select on release: a key fires when the finger lifts while still on it.
// Holding a word with other forms (spise → spiser, spiste) opens a small menu.
let pressed = null;
let formTimer = null;
grid.addEventListener('pointerdown', (e) => {
  speech.unlock();
  const el = e.target.closest('.key');
  if (!el || (el.classList.contains('empty') && state.editing !== 'edit')) return;
  pressed = el;
  el.classList.add('pressed');
  const cell = cellByKey(el.dataset.key);
  if (!state.editing && state.settings.forms && formsOf(cell) && !cell.hidden) {
    formTimer = setTimeout(() => {
      formTimer = null;
      el.classList.remove('pressed');
      pressed = null;
      showForms(el, cell);
    }, FORM_HOLD_MS);
  }
});
window.addEventListener('pointerup', (e) => {
  clearTimeout(formTimer); formTimer = null;
  if (!pressed) return;
  const el = pressed;
  pressed = null;
  el.classList.remove('pressed');
  const under = document.elementFromPoint(e.clientX, e.clientY)?.closest('.key');
  if (under === el) activate(el.dataset.key);
});
window.addEventListener('pointercancel', () => {
  clearTimeout(formTimer); formTimer = null;
  pressed?.classList.remove('pressed'); pressed = null;
});
// Keyboard and switch access (Enter/Space on a focused key).
grid.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.key')) { e.preventDefault(); activate(e.target.dataset.key); }
});
grid.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------- Word forms ----------

function showForms(keyEl, cell) {
  formsEl.replaceChildren(...[cell.label, ...formsOf(cell)].map((f, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `form c-${cell.cls || 'noun'}${i === 0 ? ' base' : ''}`;
    b.setAttribute('role', 'menuitem');
    b.textContent = f;
    b.dataset.say = i === 0 ? (cell.say || cell.label) : f;
    return b;
  }));
  formsEl.hidden = false;
  const k = keyEl.getBoundingClientRect();
  const f = formsEl.getBoundingClientRect();
  const left = Math.min(Math.max(8, k.left + k.width / 2 - f.width / 2), innerWidth - f.width - 8);
  const top = k.top - f.height - 8 > 8 ? k.top - f.height - 8 : Math.min(k.bottom + 8, innerHeight - f.height - 8);
  formsEl.style.setProperty('--x', `${left}px`);
  formsEl.style.setProperty('--y', `${top}px`);
}
const hideForms = () => { formsEl.hidden = true; formsEl.replaceChildren(); };

formsEl.addEventListener('click', (e) => {
  const b = e.target.closest('.form');
  if (!b) return;
  speech.unlock();
  // The base word keeps its own recording; the other forms use the voice.
  const cell = b.classList.contains('base') ? state.cells.find((c) => c.label === b.textContent) : null;
  hideForms();
  if (cell?.audio) partFor(cell).then((p) => speech.say(p, state.settings));
  else speech.say({ text: b.dataset.say, audio: null }, state.settings);
});
// A tap outside the forms menu only closes it.
window.addEventListener('pointerdown', (e) => {
  if (formsEl.hidden || formsEl.contains(e.target)) return;
  hideForms();
  e.stopPropagation();
}, true);

// ---------- Hold to open grown-up menu ----------

function holdToFire(btn, ms, fn) {
  let timer = null;
  btn.style.setProperty('--hold-ms', `${ms}ms`);
  const start = () => {
    btn.classList.add('holding');
    timer = setTimeout(() => { timer = null; btn.classList.remove('holding'); fn(); }, ms);
  };
  const cancel = () => { if (timer) clearTimeout(timer); timer = null; btn.classList.remove('holding'); };
  btn.addEventListener('pointerdown', start);
  btn.addEventListener('pointerup', cancel);
  btn.addEventListener('pointerleave', cancel);
  btn.addEventListener('pointercancel', cancel);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
}

const grownBtn = $('#btn-grownup');
holdToFire(grownBtn, HOLD_MS, () => openDialog('dlg-menu'));
grownBtn.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.shiftKey) openDialog('dlg-menu'); });

// ---------- Dialogs ----------

function openDialog(id) {
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
  const d = document.getElementById(id);
  d.dispatchEvent(new Event('beforeopen'));
  d.showModal();
}
document.addEventListener('click', (e) => {
  const close = e.target.closest('[data-close]');
  if (close) close.closest('dialog').close();
  const open = e.target.closest('[data-open]');
  if (open) {
    const target = open.dataset.open;
    if (target === 'edit') { open.closest('dialog').close(); setEditing('edit'); } else openDialog(target);
  }
});

const BANNER = {
  edit: 'Trykk på et ord for å endre det, eller på + for et nytt ord.',
  reveal: 'Trykk på ord for å vise eller skjule dem for barnet.',
};
function setEditing(mode) {
  state.editing = mode;
  document.body.classList.toggle('editing', !!mode);
  document.body.classList.toggle('revealing', mode === 'reveal');
  $('#edit-banner').hidden = !mode;
  $('#edit-banner-text').textContent = BANNER[mode] || '';
  hideForms();
  renderGrid();
}
$('#btn-edit-done').addEventListener('click', () => setEditing(false));

// ---------- Settings (per child) ----------

const saveSettings = () => kv.set(pk('settings'), state.settings);
const saveOverrides = () => kv.set(pk('overrides'), state.overrides);
const saveProfiles = () => kv.set('profiles', state.profiles);

function fillVoices() {
  const sel = $('#set-voice');
  const voices = speech.norwegianVoices();
  sel.replaceChildren(
    new Option('Si det-stemmen (norsk, virker uten nett)', speech.OWN_VOICE),
    ...voices.map((v) => new Option(`Nettbrettets stemme: ${v.name} (${v.lang})${v.localService ? '' : ' – trenger nett'}`, v.voiceURI)),
  );
  const own = !state.settings.voiceURI || state.settings.voiceURI === speech.OWN_VOICE;
  sel.value = own ? speech.OWN_VOICE : (speech.pickVoice(state.settings)?.voiceURI ?? speech.OWN_VOICE);
  $('#set-rate').disabled = own;
  $('#voice-hint').textContent = own
    ? 'Si det-stemmen er den samme på alle nettbrett. Ord du legger til selv, sies med nettbrettets stemme, eller med opptaket ditt. Tempo gjelder bare nettbrettets stemme.'
    : voices.length
      ? 'Last ned «forbedret» norsk stemme i iPad-innstillingene (Tilgjengelighet → Opplest innhold → Stemmer) for bedre lyd.'
      : 'Fant ingen norsk stemme på denne enheten. Legg til en under Innstillinger → Tilgjengelighet → Opplest innhold → Stemmer → Norsk.';
}

$('#dlg-settings').addEventListener('beforeopen', () => {
  fillVoices();
  $('#set-rate').value = state.settings.rate;
  $('#rate-out').textContent = Number(state.settings.rate).toFixed(2).replace('.', ',');
  $('#set-forms').checked = state.settings.forms;
  $('#set-lockout').value = String(state.settings.lockoutMs);
  $('#set-volume').value = state.settings.volume;
});
$('#set-voice').addEventListener('change', (e) => { state.settings.voiceURI = e.target.value; saveSettings(); fillVoices(); });
$('#set-rate').addEventListener('input', (e) => {
  state.settings.rate = Number(e.target.value);
  $('#rate-out').textContent = state.settings.rate.toFixed(2).replace('.', ',');
  saveSettings();
});
$('#set-volume').addEventListener('change', (e) => {
  state.settings.volume = e.target.value;
  saveSettings();
  speech.unlock();
  speech.speak([{ text: 'hei' }], state.settings);
});
$('#set-forms').addEventListener('change', (e) => { state.settings.forms = e.target.checked; saveSettings(); });
$('#set-lockout').addEventListener('change', (e) => { state.settings.lockoutMs = Number(e.target.value); saveSettings(); });
$('#btn-test-voice').addEventListener('click', () => {
  speech.unlock();
  speech.speak(['hei', 'jeg', 'vil', 'leke'].map((text) => ({ text })), state.settings);
});

// ---------- Children (profiles) ----------

$('#pf-sizes').replaceChildren(...Object.entries(SIZES).map(([id, s]) => {
  const l = document.createElement('label');
  l.className = 'size';
  l.innerHTML = `<input type="radio" name="pf-size" value="${id}"><span><b>${s.name}</b> ${s.cols} × ${s.rows}<small>${s.hint}</small></span>`;
  return l;
}));

async function renderProfiles() {
  const p = profile();
  $('#profile-list').replaceChildren(...state.profiles.map((q) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn';
    b.dataset.pid = q.id;
    b.innerHTML = `<span></span><small>${SIZES[q.size]?.name || ''}${q.id === p.id ? ' · valgt nå' : ''}</small>`;
    b.firstChild.textContent = q.name;
    if (q.id === p.id) b.setAttribute('aria-current', 'true');
    return b;
  }));
  $('#pf-title').textContent = p.name;
  $('#pf-name').value = p.name;
  document.querySelectorAll('input[name=pf-size]').forEach((r) => { r.checked = r.value === sizeId(); });
  const img = $('#pf-preview img');
  img.src = p.photo ? await imgSrc({ img: p.photo }) : `symbols/${SYMBOLS['jeg|I']}.png`;
  $('#pf-photo-del').disabled = !p.photo;
  $('#btn-del-child').disabled = state.profiles.length < 2;
}
$('#dlg-profiles').addEventListener('beforeopen', renderProfiles);

$('#profile-list').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-pid]');
  if (!b || b.dataset.pid === state.pid) return;
  state.pid = b.dataset.pid;
  await openProfile();
  renderProfiles();
});
$('#pf-name').addEventListener('input', (e) => {
  profile().name = e.target.value.trim() || 'Barn';
  $('#pf-title').textContent = profile().name;
  saveProfiles();
  renderWho();
});
$('#pf-name').addEventListener('change', renderProfiles);
$('#pf-sizes').addEventListener('change', async (e) => {
  profile().size = e.target.value;
  state.page = 'core';
  await saveProfiles();
  renderGrid();
  renderProfiles();
});
$('#pf-photo').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const p = profile();
  const key = `photo:${p.id}:${Date.now()}`;
  await blobs.set(key, await shrinkImage(file, 400));
  if (p.photo) await dropBlob(p.photo);
  p.photo = key;
  await saveProfiles();
  e.target.value = '';
  renderProfiles(); renderWho(); renderGrid();
});
$('#pf-photo-del').addEventListener('click', async () => {
  const p = profile();
  if (!p.photo) return;
  await dropBlob(p.photo);
  p.photo = null;
  await saveProfiles();
  renderProfiles(); renderWho(); renderGrid();
});
$('#btn-add-child').addEventListener('click', async () => {
  const p = { id: `p${Date.now().toString(36)}`, name: `Barn ${state.profiles.length + 1}`, size: DEFAULT_SIZE, photo: null };
  state.profiles.push(p);
  await saveProfiles();
  state.pid = p.id;
  await openProfile();
  await renderProfiles();
  $('#pf-name').focus();
  $('#pf-name').select();
});
$('#btn-del-child').addEventListener('click', async () => {
  const p = profile();
  if (state.profiles.length < 2) return;
  if (!confirm(`Slette ${p.name}? Ordene, bildene og opptakene til ${p.name} blir borte. Dette kan ikke angres.`)) return;
  for (const ov of Object.values(state.overrides)) { if (ov.img) await dropBlob(ov.img); if (ov.audio) await dropBlob(ov.audio); }
  if (p.photo) await dropBlob(p.photo);
  await kv.del(pk('settings'));
  await kv.del(pk('overrides'));
  state.profiles = state.profiles.filter((q) => q.id !== p.id);
  await saveProfiles();
  state.pid = state.profiles[0].id;
  await openProfile();
  renderProfiles();
});

async function dropBlob(key) {
  await blobs.del(key);
  if (state.urls.has(key)) { URL.revokeObjectURL(state.urls.get(key)); state.urls.delete(key); }
}

// ---------- Vocabulary: reveal step by step ----------

// Every word cell of the current size, on every page.
function allCellsOfSize() {
  const id = sizeId();
  const seen = new Map();
  for (const page of pagesOf(id)) for (const b of baseCells(id, page)) if (!seen.has(b.key)) seen.set(b.key, cellFrom(b));
  return [...seen.values()].filter((c) => !c.empty);
}

function setHidden(key, hidden) {
  const ov = { ...(state.overrides[key] || {}) };
  if (hidden) ov.hidden = true; else delete ov.hidden;
  if (Object.keys(ov).length) state.overrides[key] = ov; else delete state.overrides[key];
}

async function toggleHidden(cell) {
  setHidden(cell.key, !cell.hidden);
  await saveOverrides();
  renderGrid();
}

const revealStatus = $('#reveal-status');
$('#dlg-reveal').addEventListener('beforeopen', () => {
  const cells = allCellsOfSize();
  const shown = cells.filter((c) => !c.hidden).length;
  revealStatus.textContent = `${profile().name} ser ${shown} av ${cells.length} ord og mapper.`;
  $('#set-fit').checked = state.settings.fit;
});
$('#btn-reveal-starter').addEventListener('click', async () => {
  // Folders count too: a folder with only hidden words is hidden as well.
  for (const c of allCellsOfSize()) setHidden(c.key, !STARTER.has(c.label));
  await saveOverrides();
  state.page = 'core';
  renderGrid();
  revealStatus.textContent = 'Nå vises bare startordene. Vis flere med «Velg selv».';
});
$('#btn-reveal-all').addEventListener('click', async () => {
  for (const c of allCellsOfSize()) setHidden(c.key, false);
  await saveOverrides();
  renderGrid();
  revealStatus.textContent = 'Nå vises alle ordene.';
});
$('#set-fit').addEventListener('change', (e) => { state.settings.fit = e.target.checked; saveSettings(); renderGrid(); });
let resizeTimer = null;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(renderGrid, 150); });
$('#btn-reveal-choose').addEventListener('click', () => { $('#dlg-reveal').close(); setEditing('reveal'); });

// ---------- Backup ----------

const backupStatus = $('#backup-status');
$('#btn-export').addEventListener('click', async () => {
  const blob = await exportBackup();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `si-det-kopi-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  backupStatus.textContent = 'Sikkerhetskopien er lagret. Velg «Lagre i Filer» hvis iPad spør.';
});
$('#file-import').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    await importBackup(file);
    await load();
    backupStatus.textContent = 'Sikkerhetskopien er hentet.';
  } catch (err) {
    backupStatus.textContent = err.message || 'Filen kunne ikke leses.';
  }
  e.target.value = '';
});
$('#btn-reset').addEventListener('click', async () => {
  if (!confirm('Fjerne alle barn, endringer, bilder og opptak? Dette kan ikke angres.')) return;
  await kv.clear();
  await blobs.clear();
  await load();
  backupStatus.textContent = 'Startordene er tilbake.';
});

// ---------- Word editor ----------

const ed = {
  cell: null,
  draft: null,
  newImg: null, // Blob
  newAudio: null, // Blob
  dropAudio: false,
  recorder: null,
  pic: null, // { sym } or { lib }: a picture from the board or the library
  picManual: false, // a grown-up chose the picture, so typing doesn't change it
  lookup: 0,
};
const dlgEdit = $('#dlg-edit');

$('#edit-classes').replaceChildren(...CLASSES.map(([id, name]) => {
  const l = document.createElement('label');
  l.className = `c-${id}`;
  l.innerHTML = `<input type="radio" name="cls" value="${id}"> ${name}`;
  return l;
}));

async function updatePreview() {
  const p = $('#edit-preview');
  p.className = `preview c-${ed.draft.cls || 'noun'}`;
  const img = p.querySelector('img');
  if (ed.newImg) img.src = URL.createObjectURL(ed.newImg);
  else img.src = await imgSrc(ed.draft);
  img.hidden = !img.getAttribute('src');
  p.querySelector('span').textContent = $('#edit-label').value || ' ';
}

function updateRecButtons() {
  const has = !!ed.newAudio || (!!ed.draft.audio && !ed.dropAudio);
  $('#btn-play').disabled = !has;
  $('#btn-rec-del').disabled = !has;
}

function openEditor(cell) {
  ed.cell = cell;
  ed.draft = cell.empty ? { key: cell.key, label: '', cls: 'noun' } : { ...cell };
  ed.newImg = null; ed.newAudio = null; ed.dropAudio = false;
  const isFolder = !!cell.folder;
  $('#edit-title').textContent = cell.empty ? 'Nytt ord' : isFolder ? 'Endre mappe' : 'Endre ord';
  $('#edit-label').value = ed.draft.label || '';
  $('#edit-say').value = ed.draft.say || '';
  $('#edit-hidden').checked = !!ed.draft.hidden;
  $('#edit-class-field').hidden = isFolder;
  $('#edit-say-field').hidden = isFolder;
  $('#edit-hidden-field').hidden = isFolder;
  $('#btn-remove').hidden = cell.empty || isFolder;
  dlgEdit.querySelectorAll('input[name=cls]').forEach((r) => { r.checked = r.value === (ed.draft.cls || 'noun'); });
  $('#edit-search').value = ed.draft.label || '';
  $('#search-results').replaceChildren();
  $('#search-status').textContent = '';
  ed.pic = null; ed.picManual = false;
  updatePreview();
  updateRecButtons();
  lookUp();
  dlgEdit.showModal();
}

// Look the typed word up in the picture library. For a new word, or when the word
// is changed, the best picture is chosen straight away; the others are one tap away.
async function lookUp() {
  const my = ++ed.lookup;
  const label = $('#edit-label').value.trim();
  const pics = await findPictures(label);
  if (my !== ed.lookup) return;
  const auto = !ed.picManual && !ed.newImg && (ed.cell.empty || label.toLowerCase() !== (ed.cell.label || '').toLowerCase());
  if (auto && pics.length) choosePicture(pics[0], false);
  const status = $('#lib-status');
  if (!label) status.textContent = 'Skriv ordet, så finner Si det et bilde.';
  else if (!pics.length) status.textContent = `Fant ikke «${label}» i bildebiblioteket. Søk på nett nedenfor, eller bruk eget bilde.`;
  else status.textContent = auto ? 'Bildet ble valgt automatisk. Trykk på et annet hvis du vil.' : 'Trykk på et bilde for å bruke det.';
  $('#lib-results').replaceChildren(...pics.map((p) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.pic = JSON.stringify(p);
    b.setAttribute('aria-label', 'Bruk dette bildet');
    b.setAttribute('aria-pressed', String(!!ed.pic && ed.pic.sym === p.sym && ed.pic.lib === p.lib));
    const img = document.createElement('img');
    img.alt = '';
    img.src = p.lib ? `library/${p.lib}.png` : `symbols/${p.sym}.png`;
    b.append(img);
    return b;
  }));
}

function choosePicture(p, manual) {
  ed.pic = p;
  ed.newImg = null;
  ed.picManual ||= manual;
  ed.draft = { ...ed.draft, sym: p.sym ?? null, lib: p.lib, img: undefined };
  updatePreview();
  $('#lib-results').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pic === JSON.stringify(p))));
}

$('#lib-results').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) choosePicture(JSON.parse(b.dataset.pic), true);
});

let lookTimer = null;
$('#edit-label').addEventListener('input', () => {
  updatePreview();
  clearTimeout(lookTimer);
  lookTimer = setTimeout(lookUp, 250);
});
$('#edit-classes').addEventListener('change', (e) => { ed.draft.cls = e.target.value; updatePreview(); });

$('#edit-photo').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  ed.newImg = await shrinkImage(file, 400);
  ed.picManual = true;
  updatePreview();
  e.target.value = '';
});

async function shrinkImage(file, size) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, size / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
}

// Symbol search (needs internet). Chosen symbol is saved on the device.
async function searchSymbols() {
  const q = $('#edit-search').value.trim();
  const status = $('#search-status');
  const results = $('#search-results');
  if (!q) return;
  if (!navigator.onLine) { status.textContent = 'Søk trenger internett. Du kan bruke eget bilde i stedet.'; return; }
  status.textContent = 'Søker …';
  results.replaceChildren();
  const ids = [];
  for (const lang of ['nb', 'en']) {
    try {
      const res = await fetch(`https://api.arasaac.org/v1/pictograms/${lang}/search/${encodeURIComponent(q)}`);
      if (res.ok) for (const h of await res.json()) if (!ids.includes(h._id)) ids.push(h._id);
    } catch { /* offline or blocked */ }
    if (ids.length >= 12) break;
  }
  status.textContent = ids.length ? 'Trykk på symbolet du vil bruke.' : `Fant ingen symboler for «${q}». Prøv et annet ord, eller bruk eget bilde.`;
  results.replaceChildren(...ids.slice(0, 24).map((id) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.id = id;
    b.setAttribute('aria-label', `Symbol ${id}`);
    b.innerHTML = `<img alt="" loading="lazy" src="https://static.arasaac.org/pictograms/${id}/${id}_300.png">`;
    return b;
  }));
}
$('#btn-search').addEventListener('click', searchSymbols);
$('#edit-search').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); searchSymbols(); } });
$('#search-results').addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const status = $('#search-status');
  try {
    const res = await fetch(`https://static.arasaac.org/pictograms/${b.dataset.id}/${b.dataset.id}_300.png`);
    ed.newImg = await res.blob();
    ed.picManual = true;
    status.textContent = 'Symbolet er valgt.';
    updatePreview();
  } catch {
    status.textContent = 'Symbolet kunne ikke hentes. Sjekk internett og prøv igjen.';
  }
});

// Recording a parent's voice.
$('#btn-rec').addEventListener('click', async () => {
  const rec = $('#rec');
  const hint = $('#rec-hint');
  if (ed.recorder) { ed.recorder.stop(); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const type = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((t) => window.MediaRecorder?.isTypeSupported?.(t));
    const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const chunks = [];
    r.ondataavailable = (ev) => chunks.push(ev.data);
    r.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      ed.newAudio = new Blob(chunks, { type: r.mimeType || 'audio/mp4' });
      ed.dropAudio = false;
      ed.recorder = null;
      rec.classList.remove('recording');
      $('#btn-rec').textContent = 'Ta opp på nytt';
      updateRecButtons();
    };
    ed.recorder = r;
    r.start();
    rec.classList.add('recording');
    $('#btn-rec').textContent = 'Stopp opptak';
    // Stop automatically after 6 seconds; a word or short phrase is enough.
    setTimeout(() => { if (ed.recorder === r) r.stop(); }, 6000);
  } catch {
    hint.textContent = 'Fikk ikke tilgang til mikrofonen. Tillat mikrofon for Si det i iPad-innstillingene.';
  }
});
$('#btn-play').addEventListener('click', async () => {
  const blob = ed.newAudio || (!ed.dropAudio && ed.draft.audio ? await blobs.get(ed.draft.audio) : null);
  if (blob) speech.speak([{ text: '', audio: blob }], state.settings);
});
$('#btn-rec-del').addEventListener('click', () => { ed.newAudio = null; ed.dropAudio = true; updateRecButtons(); });

$('#btn-remove').addEventListener('click', async () => {
  if (!confirm(`Fjerne «${ed.cell.label}»? Plassen blir tom.`)) return;
  state.overrides[ed.cell.key] = { removed: true };
  await saveOverrides();
  dlgEdit.close();
  renderGrid();
});

$('#edit-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const label = $('#edit-label').value.trim();
  if (!label) { $('#edit-label').focus(); return; }
  const key = ed.cell.key;
  const ov = { ...(state.overrides[key] || {}) };
  delete ov.removed;
  ov.label = label;
  if (!ed.cell.folder) {
    ov.cls = ed.draft.cls || 'noun';
    ov.say = $('#edit-say').value.trim() || undefined;
    ov.hidden = $('#edit-hidden').checked || undefined;
  }
  if (ed.newImg) {
    const imgKey = `img:${state.pid}:${key}:${Date.now()}`;
    await blobs.set(imgKey, ed.newImg);
    if (ov.img) await dropBlob(ov.img);
    ov.img = imgKey;
    delete ov.lib;
  } else if (ed.pic) {
    if (ov.img) { await dropBlob(ov.img); delete ov.img; }
    if (ed.pic.lib) { ov.lib = ed.pic.lib; ov.sym = null; } else { ov.sym = ed.pic.sym; delete ov.lib; }
  } else if (ed.cell.empty && !ov.img) {
    ov.sym = null;
  }
  if (ed.newAudio) {
    const audKey = `aud:${state.pid}:${key}:${Date.now()}`;
    await blobs.set(audKey, ed.newAudio);
    if (ov.audio) await blobs.del(ov.audio);
    ov.audio = audKey;
  } else if (ed.dropAudio && ov.audio) {
    await blobs.del(ov.audio);
    delete ov.audio;
  }
  state.overrides[key] = ov;
  await saveOverrides();
  dlgEdit.close();
  renderGrid();
});
dlgEdit.addEventListener('close', () => { if (ed.recorder) ed.recorder.stop(); });

// ---------- Start ----------

// Version 0.2 had one board (keys "settings" and "overrides") in a 10 × 6 grid.
// It becomes the first child, on the big board, with every change kept in place.
async function migrateOldBoard() {
  const p = { id: 'p1', name: 'Barn 1', size: DEFAULT_SIZE, photo: null };
  const oldSettings = await kv.get('settings');
  const old = await kv.get('overrides');
  const ov = {};
  for (const [k, v] of Object.entries(old || {})) {
    const [a, b, c] = k.split(':');
    if (a === 'fixed') ov[`large:frame:${b}:${c}`] = v;
    else if (a === 'folders') ov[`large:frame:${Number(b) + 1}:9`] = v; // "Fraser" now sits on top
    else ov[`large:${k}`] = v;
  }
  if (oldSettings) {
    delete oldSettings.speakOnTap;
    await kv.set(pk('settings', p.id), oldSettings);
  }
  await kv.set(pk('overrides', p.id), ov);
  await kv.del('settings');
  await kv.del('overrides');
  await kv.set('profiles', [p]);
  return [p];
}

async function openProfile() {
  await kv.set('activeProfile', state.pid);
  state.settings = { ...DEFAULTS, ...((await kv.get(pk('settings'))) || {}) };
  state.overrides = (await kv.get(pk('overrides'))) || {};
  state.page = 'core';
  state.lastTap.clear();
  hideForms();
  await renderWho();
  await renderGrid();
}

async function load() {
  let profiles = await kv.get('profiles');
  if (!profiles?.length) profiles = await migrateOldBoard();
  state.profiles = profiles;
  const active = await kv.get('activeProfile');
  state.pid = profiles.some((p) => p.id === active) ? active : profiles[0].id;
  state.urls.forEach((u) => URL.revokeObjectURL(u));
  state.urls.clear();
  await openProfile();
}

$('#app-version').textContent = VERSION;
load();
askToKeepData();

// Offline files. On localhost it only runs with ?sw=1, so edits show up straight away while developing.
const isLocal = location.hostname === 'localhost';
if ('serviceWorker' in navigator && (location.protocol === 'https:' || (isLocal && location.search.includes('sw=1')))) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
