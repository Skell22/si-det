// Si det – main app.
import { COLS, ROWS, FIXED_LEFT, FOLDERS, CORE, FOLDER_WORDS } from './vocab.js';
import { SYMBOLS } from './symbols.js';
import { kv, blobs, askToKeepData, exportBackup, importBackup } from './store.js';
import * as speech from './speech.js';

export const VERSION = '0.2.0';

const CLASSES = [
  ['pron', 'Pronomen'], ['verb', 'Verb'], ['desc', 'Beskrivende'], ['noun', 'Ting og folk'],
  ['prep', 'Sted'], ['soc', 'Sosialt'], ['ques', 'Spørsmål'], ['adv', 'Adverb'], ['neg', 'Nei og stopp'],
];
const DEFAULTS = { voiceURI: speech.OWN_VOICE, rate: 0.9, speakOnTap: true, lockoutMs: 600 };
const HOLD_MS = 2000;

const $ = (sel) => document.querySelector(sel);
const grid = $('#grid');
const sentenceEl = $('#sentence');

const state = {
  page: 'core',
  editing: false,
  settings: { ...DEFAULTS },
  overrides: {},
  sentence: [],
  lastTap: new Map(),
  urls: new Map(), // blob key -> object URL
};

// ---------- Vocabulary model ----------

const word = ([label, cls, en]) => ({ label, cls, sym: SYMBOLS[`${label}|${en}`] ?? null });

function baseCell(page, r, c) {
  if (c < 2) return { key: `fixed:${r}:${c}`, ...word(FIXED_LEFT[r][c]) };
  if (c === COLS - 1) {
    const f = FOLDERS[r];
    return { key: `folders:${r}`, label: f.label, cls: 'noun', folder: f.id, sym: SYMBOLS[`${f.label}|${f.en}`] ?? null };
  }
  const key = `${page}:${r}:${c}`;
  const src = page === 'core' ? CORE[r]?.[c - 2] : FOLDER_WORDS[page]?.[r * 7 + (c - 2)];
  return src ? { key, ...word(src) } : { key, empty: true };
}

function cellAt(page, r, c) {
  const base = baseCell(page, r, c);
  const ov = state.overrides[base.key];
  if (!ov) return base;
  if (ov.removed) return { key: base.key, empty: true, folder: base.folder };
  return { ...base, ...ov, empty: false };
}

function cellByKey(key) {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const cell = cellAt(state.page, r, c);
    if (cell.key === key) return cell;
  }
  return null;
}

async function imgSrc(cell) {
  if (cell.img) {
    if (!state.urls.has(cell.img)) {
      const b = await blobs.get(cell.img);
      if (b) state.urls.set(cell.img, URL.createObjectURL(b));
    }
    return state.urls.get(cell.img) || '';
  }
  return cell.sym ? `symbols/${cell.sym}.png` : '';
}

// ---------- Rendering ----------

async function renderGrid() {
  grid.style.setProperty('--cols', COLS);
  grid.style.setProperty('--rows', ROWS);
  const frag = document.createDocumentFragment();
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const cell = cellAt(state.page, r, c);
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'key';
    el.dataset.key = cell.key;
    const hiddenForChild = cell.hidden && !state.editing;
    if (cell.empty || hiddenForChild) {
      el.classList.add('empty');
      el.setAttribute('aria-hidden', 'true');
      el.tabIndex = state.editing && cell.empty ? 0 : -1;
      if (state.editing && cell.empty) el.setAttribute('aria-label', 'Legg til ord');
    } else {
      el.classList.add(`c-${cell.cls || 'noun'}`);
      if (cell.folder) {
        el.classList.add('folder');
        if (cell.folder === state.page) { el.classList.add('open'); el.setAttribute('aria-current', 'page'); }
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
  grid.replaceChildren(frag);
}

async function renderSentence() {
  const frag = document.createDocumentFragment();
  for (const w of state.sentence) {
    const chip = document.createElement('div');
    chip.className = `chip c-${w.cls || 'noun'}`;
    const img = document.createElement('img');
    img.alt = '';
    img.src = await imgSrc(w);
    const t = document.createElement('span');
    t.textContent = w.label;
    chip.append(img, t);
    frag.append(chip);
  }
  sentenceEl.replaceChildren(frag);
  sentenceEl.scrollLeft = sentenceEl.scrollWidth;
}

// ---------- Speaking ----------

async function partFor(w) {
  return { text: w.say || w.label, audio: w.audio ? await blobs.get(w.audio) : null };
}

async function speakWords(words) {
  const parts = await Promise.all(words.map(partFor));
  const chips = [...sentenceEl.children];
  await speech.speak(parts, state.settings, (i) => {
    chips.forEach((ch, j) => ch.classList.toggle('speaking', i === -1 ? words === state.sentence : j === i && words === state.sentence));
  });
  chips.forEach((ch) => ch.classList.remove('speaking'));
}

// ---------- Tapping ----------

function activate(key) {
  const cell = cellByKey(key);
  if (!cell) return;
  if (state.editing) return openEditor(cell);
  if (cell.empty || cell.hidden) return;

  const now = performance.now();
  const last = state.lastTap.get(key) ?? -Infinity;
  if (now - last < state.settings.lockoutMs) return;
  state.lastTap.set(key, now);

  if (cell.folder) {
    state.page = state.page === cell.folder ? 'core' : cell.folder;
    renderGrid();
    if (state.settings.speakOnTap) speakWords([cell]);
    return;
  }
  state.sentence.push({ label: cell.label, cls: cell.cls, sym: cell.sym, img: cell.img, say: cell.say, audio: cell.audio });
  renderSentence();
  if (state.settings.speakOnTap) speakWords([cell]);
}

// Select on release: a key fires when the finger lifts while still on it.
let pressed = null;
grid.addEventListener('pointerdown', (e) => {
  speech.unlock();
  const el = e.target.closest('.key');
  if (!el || (el.classList.contains('empty') && !state.editing)) return;
  pressed = el;
  el.classList.add('pressed');
});
window.addEventListener('pointerup', (e) => {
  if (!pressed) return;
  const el = pressed;
  pressed = null;
  el.classList.remove('pressed');
  const under = document.elementFromPoint(e.clientX, e.clientY)?.closest('.key');
  if (under === el) activate(el.dataset.key);
});
window.addEventListener('pointercancel', () => { pressed?.classList.remove('pressed'); pressed = null; });
// Keyboard and switch access (Enter/Space on a focused key).
grid.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.key')) { e.preventDefault(); activate(e.target.dataset.key); }
});
grid.addEventListener('contextmenu', (e) => e.preventDefault());

function pressable(btn, fn) {
  btn.addEventListener('pointerdown', () => { speech.unlock(); btn.classList.add('pressed'); });
  const up = () => btn.classList.remove('pressed');
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointerleave', up);
  btn.addEventListener('click', fn);
}

pressable($('#btn-home'), () => { state.page = 'core'; renderGrid(); });
pressable($('#btn-back'), () => { state.sentence.pop(); renderSentence(); });
pressable($('#btn-say'), () => { if (state.sentence.length) speakWords(state.sentence); });
// Tap the sentence to say it too; hold "Slett" to clear everything.
sentenceEl.addEventListener('click', () => { if (state.sentence.length) speakWords(state.sentence); });
holdToFire($('#btn-back'), 800, () => { state.sentence = []; renderSentence(); });

// ---------- Hold to open grown-up menu ----------

function holdToFire(btn, ms, fn) {
  let timer = null;
  btn.style.setProperty('--hold-ms', `${ms}ms`);
  const start = () => {
    btn.classList.add('holding');
    timer = setTimeout(() => { timer = null; btn.classList.remove('holding'); btn.dataset.fired = '1'; fn(); }, ms);
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
    if (target === 'edit') { open.closest('dialog').close(); setEditing(true); } else openDialog(target);
  }
});

function setEditing(on) {
  state.editing = on;
  document.body.classList.toggle('editing', on);
  $('#edit-banner').hidden = !on;
  renderGrid();
}
$('#btn-edit-done').addEventListener('click', () => setEditing(false));

// ---------- Settings ----------

async function saveSettings() { await kv.set('settings', state.settings); }

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
  $('#set-speak-tap').checked = state.settings.speakOnTap;
  $('#set-lockout').value = String(state.settings.lockoutMs);
});
$('#set-voice').addEventListener('change', (e) => { state.settings.voiceURI = e.target.value; saveSettings(); fillVoices(); });
$('#set-rate').addEventListener('input', (e) => {
  state.settings.rate = Number(e.target.value);
  $('#rate-out').textContent = state.settings.rate.toFixed(2).replace('.', ',');
  saveSettings();
});
$('#set-speak-tap').addEventListener('change', (e) => { state.settings.speakOnTap = e.target.checked; saveSettings(); });
$('#set-lockout').addEventListener('change', (e) => { state.settings.lockoutMs = Number(e.target.value); saveSettings(); });
$('#btn-test-voice').addEventListener('click', () => {
  speech.unlock();
  speech.speak(['hei', 'jeg', 'vil', 'leke'].map((text) => ({ text })), state.settings);
});

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
  if (!confirm('Fjerne alle endringer, bilder og opptak? Dette kan ikke angres.')) return;
  await kv.set('overrides', {});
  await kv.set('settings', { ...DEFAULTS });
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
  updatePreview();
  updateRecButtons();
  dlgEdit.showModal();
}

$('#edit-label').addEventListener('input', updatePreview);
$('#edit-classes').addEventListener('change', (e) => { ed.draft.cls = e.target.value; updatePreview(); });

$('#edit-photo').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  ed.newImg = await shrinkImage(file, 400);
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
  await kv.set('overrides', state.overrides);
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
    const imgKey = `img:${key}:${Date.now()}`;
    await blobs.set(imgKey, ed.newImg);
    if (ov.img) { await blobs.del(ov.img); state.urls.delete(ov.img); }
    ov.img = imgKey;
  } else if (ed.cell.empty && !ov.img) {
    ov.sym = null;
  }
  if (ed.newAudio) {
    const audKey = `aud:${key}:${Date.now()}`;
    await blobs.set(audKey, ed.newAudio);
    if (ov.audio) await blobs.del(ov.audio);
    ov.audio = audKey;
  } else if (ed.dropAudio && ov.audio) {
    await blobs.del(ov.audio);
    delete ov.audio;
  }
  state.overrides[key] = ov;
  await kv.set('overrides', state.overrides);
  dlgEdit.close();
  renderGrid();
});
dlgEdit.addEventListener('close', () => { if (ed.recorder) ed.recorder.stop(); });

// ---------- Start ----------

async function load() {
  state.settings = { ...DEFAULTS, ...((await kv.get('settings')) || {}) };
  state.overrides = (await kv.get('overrides')) || {};
  state.urls.forEach((u) => URL.revokeObjectURL(u));
  state.urls.clear();
  state.sentence = [];
  await renderGrid();
  await renderSentence();
}

$('#app-version').textContent = VERSION;
load();
askToKeepData();

// Offline files. On localhost it only runs with ?sw=1, so edits show up straight away while developing.
const isLocal = location.hostname === 'localhost';
if ('serviceWorker' in navigator && (location.protocol === 'https:' || (isLocal && location.search.includes('sw=1')))) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
