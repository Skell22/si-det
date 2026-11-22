// Speech. Order of preference for each word:
//   1. a parent's own recording of the word
//   2. the Si det voice: a bundled Norwegian clip (Piper "talesyntese", CC0 data)
//   3. the device's own Norwegian voice (speechSynthesis), for words with no clip
// Clips and recordings play through Web Audio, which starts fast and can play a
// whole sentence after one tap. iPadOS only allows sound after a touch, so
// unlock() runs on the first touch.
import { CLIPS } from './voice-clips.js';

export const OWN_VOICE = 'si-det';

const synth = window.speechSynthesis;
const NORWEGIAN = /^(nb|no|nn)([-_]|$)/i;
const GAP_S = 0.05; // pause between words in a sentence

// Volume levels (Voksen → Innstillinger → Lydstyrke). Above 1 the sound goes
// through a limiter, so it gets louder without crackling.
export const VOLUMES = { normal: 1, hoy: 2.2, maks: 3.5 };
export const DEFAULT_VOLUME = 'hoy';

let ctx = null;
let master = null; // gain -> limiter -> speakers
let unlocked = false;
let sources = [];
let token = 0; // bumps on stop(), so an old sentence stops cleanly
const buffers = new Map(); // clip file or Blob -> AudioBuffer

export function hasClip(text) {
  return Object.hasOwn(CLIPS, text);
}

export function norwegianVoices() {
  const voices = synth ? synth.getVoices() : [];
  return voices
    .filter((v) => NORWEGIAN.test(v.lang) || /nora|norsk|norwegian/i.test(v.name))
    .sort((a, b) => Number(b.localService) - Number(a.localService));
}

export function pickVoice(settings) {
  const nb = norwegianVoices();
  return nb.find((v) => v.voiceURI === settings.voiceURI) || nb[0] || null;
}

export function unlock() {
  if (unlocked) return;
  unlocked = true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) {
    ctx = new AC();
    ctx.resume();
    // Play one silent sample: older iPadOS needs this to really unlock audio.
    const b = ctx.createBuffer(1, 1, 22050);
    const s = ctx.createBufferSource();
    s.buffer = b; s.connect(ctx.destination); s.start(0);
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10; limiter.knee.value = 4; limiter.ratio.value = 20;
    limiter.attack.value = 0.002; limiter.release.value = 0.12;
    master = ctx.createGain();
    master.connect(limiter); limiter.connect(ctx.destination);
    preloadClips();
  }
  if (synth) {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    synth.speak(u);
  }
}

async function decode(key, load) {
  if (buffers.has(key)) return buffers.get(key);
  const p = (async () => ctx.decodeAudioData(await load()))();
  buffers.set(key, p);
  try { return await p; } catch (e) { buffers.delete(key); throw e; }
}

const clipBuffer = (file) => decode(file, async () => (await fetch(`audio/${file}`)).arrayBuffer());
const blobBuffer = (blob) => decode(blob, () => blob.arrayBuffer());

// Decode every clip in the background so the first tap on each word is instant.
function preloadClips() {
  const files = Object.values(CLIPS);
  let i = 0;
  const next = () => {
    if (i >= files.length) return;
    clipBuffer(files[i++]).catch(() => {}).finally(() => setTimeout(next, 0));
  };
  next();
}

export function stop() {
  token++;
  waiting.length = 0;
  busy = false;
  synth?.cancel();
  sources.forEach((s) => { try { s.stop(); } catch { /* already stopped */ } });
  sources = [];
}

function playBuffer(buf, settings) {
  return new Promise((resolve) => {
    if (ctx.state === 'suspended') ctx.resume();
    const s = ctx.createBufferSource();
    s.buffer = buf;
    master.gain.value = VOLUMES[settings.volume] ?? VOLUMES[DEFAULT_VOLUME];
    s.connect(master);
    s.onended = () => { sources = sources.filter((x) => x !== s); resolve(); };
    sources.push(s);
    s.start();
  });
}

function sayText(text, settings) {
  return new Promise((resolve) => {
    if (!synth || !text) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice(settings);
    if (v) u.voice = v;
    u.lang = v?.lang || 'nb-NO';
    u.rate = settings.rate ?? 0.9;
    u.volume = 1; // the device voice can't go above its maximum
    u.onend = u.onerror = () => resolve();
    synth.speak(u);
  });
}

const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));

function canPlayPart(p, settings) {
  const useOwn = settings.voiceURI === OWN_VOICE || !settings.voiceURI;
  return !!ctx && (!!p.audio || (useOwn && hasClip(p.text)));
}

async function speakPart(p, settings) {
  try {
    if (p.audio && ctx) return await playBuffer(await blobBuffer(p.audio), settings);
    if (canPlayPart(p, settings)) return await playBuffer(await clipBuffer(CLIPS[p.text]), settings);
  } catch { /* fall back to the device voice */ }
  return sayText(p.text, settings);
}

// One tap = one word, said at once. Taps that come while a word is still being
// said wait their turn, so "jeg" "vil" "spise" come out in a row and never
// cut each other off. Only the last few taps are kept, so it never lags far behind.
const MAX_WAITING = 3;
const waiting = [];
let busy = false;

export function say(part, settings) {
  if (waiting.length >= MAX_WAITING) waiting.shift();
  waiting.push(part);
  if (busy) return;
  busy = true;
  const my = token;
  (async () => {
    while (waiting.length && my === token) {
      await speakPart(waiting.shift(), settings);
      if (waiting.length) await wait(GAP_S);
    }
    if (my === token) busy = false; // after stop() a newer loop owns busy
  })();
}

// Several parts in one go (the test button). parts: [{ text, audio: Blob|null }]
export async function speak(parts, settings) {
  stop();
  const my = token;
  if (!parts.some((p) => canPlayPart(p, settings))) return sayText(parts.map((p) => p.text).join(' '), settings);
  for (let i = 0; i < parts.length && my === token; i++) {
    await speakPart(parts[i], settings);
    if (i < parts.length - 1) await wait(GAP_S);
  }
}
