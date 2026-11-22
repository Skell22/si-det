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

let ctx = null;
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
  synth?.cancel();
  sources.forEach((s) => { try { s.stop(); } catch { /* already stopped */ } });
  sources = [];
}

function playBuffer(buf) {
  return new Promise((resolve) => {
    if (ctx.state === 'suspended') ctx.resume();
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.connect(ctx.destination);
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
    u.onend = u.onerror = () => resolve();
    synth.speak(u);
  });
}

const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));

// parts: [{ text, audio: Blob|null }]
export async function speak(parts, settings, onPart) {
  stop();
  const my = token;
  const useOwn = settings.voiceURI === OWN_VOICE || !settings.voiceURI;
  const canPlay = !!ctx;
  const playable = (p) => canPlay && (p.audio || (useOwn && hasClip(p.text)));

  // Device voice only: one utterance sounds more natural than word by word.
  if (!parts.some(playable)) {
    onPart?.(-1);
    await sayText(parts.map((p) => p.text).join(' '), settings);
    onPart?.(null);
    return;
  }

  for (let i = 0; i < parts.length; i++) {
    if (my !== token) return;
    const p = parts[i];
    onPart?.(i);
    try {
      if (p.audio && canPlay) await playBuffer(await blobBuffer(p.audio));
      else if (useOwn && canPlay && hasClip(p.text)) await playBuffer(await clipBuffer(CLIPS[p.text]));
      else await sayText(p.text, settings);
    } catch {
      await sayText(p.text, settings);
    }
    if (i < parts.length - 1) await wait(GAP_S);
  }
  if (my === token) onPart?.(null);
}
