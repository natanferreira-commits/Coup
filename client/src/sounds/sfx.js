/**
 * GOLPE — Sound FX via Web Audio API
 * Todos os sons são gerados sinteticamente por enquanto.
 * Quando tiver os arquivos .mp3, basta trocar cada função por:
 *   const audio = new Audio('/sounds/nome.mp3'); audio.play();
 */

let _ctx = null;
let _muted = false;

let _sfxGain = null;
let _musicGain = null;
let _sfxVolume = 0.8;
let _musicVolume = 0.35;

function ctx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  // Resume if suspended (browsers block audio until user gesture)
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

function getSfxGain() {
  if (!_sfxGain) {
    const ac = ctx();
    _sfxGain = ac.createGain();
    _sfxGain.gain.value = _sfxVolume;
    _sfxGain.connect(ac.destination);
  }
  return _sfxGain;
}

function getMusicGain() {
  if (!_musicGain) {
    const ac = ctx();
    _musicGain = ac.createGain();
    _musicGain.gain.value = _musicVolume;
    _musicGain.connect(ac.destination);
  }
  return _musicGain;
}

// Ambient music state
let _ambientNodes = [];
let _ambientRunning = false;

function playAmbientLoop() {
  if (_ambientRunning) return;
  _ambientRunning = true;
  const ac = ctx();
  const mg = getMusicGain();

  // ── Warm pad chords (Cmaj9 blend: C3, E3, G3, B3, D4) ──
  // Two slightly detuned oscillators per note → chorus warmth
  const padFreqs = [130.81, 164.81, 196.00, 246.94, 293.66]; // C3 E3 G3 B3 D4
  padFreqs.forEach((freq, i) => {
    [-3, 3].forEach((cents, j) => {
      const osc = ac.createOscillator();
      const lfo = ac.createOscillator();
      const lfoG = ac.createGain();
      const vol = ac.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq * Math.pow(2, cents / 1200);

      // Ultra-slow breathing (different rate per voice)
      lfo.type = 'sine';
      lfo.frequency.value = 0.03 + i * 0.013 + j * 0.007;
      lfoG.gain.value = 0.005;
      lfo.connect(lfoG);
      lfoG.connect(vol.gain);

      // High notes softer; detuned pair softer than main
      vol.gain.value = Math.max(0.004, 0.016 - i * 0.0025);
      osc.connect(vol);
      vol.connect(mg);
      osc.start();
      lfo.start();
      _ambientNodes.push(osc, lfo);
    });
  });

  // ── Deep bass: C2 with gentle low-freq wobble ──
  const bass = ac.createOscillator();
  const bassLfo = ac.createOscillator();
  const bassLfoG = ac.createGain();
  const bassVol = ac.createGain();
  bass.type = 'sine';
  bass.frequency.value = 65.41; // C2
  bassLfo.type = 'sine';
  bassLfo.frequency.value = 0.06;
  bassLfoG.gain.value = 0.6; // slight wobble in Hz
  bassLfo.connect(bassLfoG);
  bassLfoG.connect(bass.frequency);
  bassVol.gain.value = 0.038;
  bass.connect(bassVol);
  bassVol.connect(mg);
  bass.start();
  bassLfo.start();
  _ambientNodes.push(bass, bassLfo);

  // ── Gentle pentatonic melody (C major pentatonic: C D E G A) ──
  // Notes span two octaves for variety
  const melNotes = [
    261.63, 293.66, 329.63, 392.00, 440.00,   // C4 D4 E4 G4 A4
    523.25, 587.33, 659.25, 783.99, 880.00,   // C5 D5 E5 G5 A5
    1046.50,                                   // C6 (rare high note)
  ];
  let melIdx = 0;
  let _melTimeout = null;

  const scheduleMel = () => {
    if (!_ambientRunning) return;
    // ~30% chance to skip a beat — creates breathing space
    if (Math.random() < 0.28) {
      _melTimeout = setTimeout(scheduleMel, 300 + Math.random() * 500);
      return;
    }
    const freq = melNotes[melIdx % melNotes.length];
    // Walk mostly up, occasionally jump down
    melIdx = Math.random() < 0.15
      ? Math.floor(Math.random() * melNotes.length)
      : (melIdx + 1) % melNotes.length;

    const osc = ac.createOscillator();
    const vol = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    // Soft attack, long warm tail
    const now = ac.currentTime;
    vol.gain.setValueAtTime(0.001, now);
    vol.gain.linearRampToValueAtTime(0.018, now + 0.1);
    vol.gain.exponentialRampToValueAtTime(0.001, now + 2.2);
    osc.connect(vol);
    vol.connect(mg);
    osc.start(now);
    osc.stop(now + 2.4);

    // Next note: 400–900ms later
    _melTimeout = setTimeout(scheduleMel, 400 + Math.random() * 500);
  };

  // Start melody after short intro pause
  _melTimeout = setTimeout(scheduleMel, 1200);
  // Push a stopper so stopAmbient() can clear the pending timeout
  _ambientNodes.push({ stop() { clearTimeout(_melTimeout); _melTimeout = null; } });
}

// ── Low-level helpers ─────────────────────────────────────────────────────────

function tone({ freq = 440, type = 'sine', start = 0, duration = 0.15, gain = 0.25, pitchEnd = null }) {
  const ac = ctx();
  const osc  = ac.createOscillator();
  const vol  = ac.createGain();
  osc.connect(vol);
  vol.connect(getSfxGain());

  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime + start);
  if (pitchEnd) osc.frequency.linearRampToValueAtTime(pitchEnd, ac.currentTime + start + duration);

  vol.gain.setValueAtTime(gain, ac.currentTime + start);
  vol.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + start + duration);

  osc.start(ac.currentTime + start);
  osc.stop(ac.currentTime + start + duration + 0.01);
}

function noise({ start = 0, duration = 0.08, gain = 0.15 }) {
  const ac       = ctx();
  const bufSize  = ac.sampleRate * duration;
  const buffer   = ac.createBuffer(1, bufSize, ac.sampleRate);
  const data     = buffer.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const vol = ac.createGain();
  src.connect(vol);
  vol.connect(getSfxGain());
  vol.gain.setValueAtTime(gain, ac.currentTime + start);
  vol.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + start + duration);
  src.start(ac.currentTime + start);
}

// ── Music Track List (exportado para a JukeboxModal) ──────────────────────────
export const MUSIC_TRACKS = [
  { id: 'none',      emoji: '🔇', label: 'Sem Música' },
  { id: 'ambient',   emoji: '🌌', label: 'Trilha do Golpe' },
  { id: 'samba',     emoji: '🥁', label: 'Aquarela do Brasil' },
  { id: 'bossanova', emoji: '🎸', label: 'Garota de Ipanema' },
  { id: 'baiao',     emoji: '🪗', label: 'Asa Branca' },
  { id: 'funk',      emoji: '⚡', label: 'Baile de Favela' },
  { id: 'pagode',    emoji: '🎵', label: 'Minha Filosofia' },
];

// ── Music Sequencer Engine ────────────────────────────────────────────────────
let _activeTrackId = null;
let _sequencerStop = null;

function stopAllMusic() {
  if (_sequencerStop) { _sequencerStop(); _sequencerStop = null; }
  _ambientRunning = false;
  _ambientNodes.forEach(n => { try { n.stop(); } catch {} });
  _ambientNodes = [];
  _activeTrackId = null;
}

// Generic 16th-note step sequencer factory
function makeSeq(bpm, steps, onStep) {
  const stepSec = 60 / (bpm * 4);
  const AHEAD = 0.12;
  let nextTime = ctx().currentTime + 0.05;
  let step = 0;
  function tick() {
    const ac = ctx();
    while (nextTime < ac.currentTime + AHEAD) {
      onStep(step % steps, nextTime);
      step++;
      nextTime += stepSec;
    }
  }
  tick();
  const id = setInterval(tick, 50);
  return () => clearInterval(id);
}

// ── Instrument helpers (music bus) ────────────────────────────────────────────
function mKick(t, freq = 65, dur = 0.38, vol = 0.65) {
  const ac = ctx(); const mg = getMusicGain();
  const osc = ac.createOscillator(); const env = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq * 2.8, t);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.45, t + dur * 0.45);
  env.gain.setValueAtTime(vol, t);
  env.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(env); env.connect(mg);
  osc.start(t); osc.stop(t + dur + 0.02);
}

function mSnare(t, vol = 0.22) {
  const ac = ctx(); const mg = getMusicGain();
  const dur = 0.16;
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.8);
  const src = ac.createBufferSource(); src.buffer = buf;
  const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400;
  const env = ac.createGain();
  env.gain.setValueAtTime(vol, t); env.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(hp); hp.connect(env); env.connect(mg); src.start(t);
  const osc = ac.createOscillator(); const te = ac.createGain();
  osc.type = 'triangle'; osc.frequency.value = 190;
  te.gain.setValueAtTime(vol * 0.55, t); te.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  osc.connect(te); te.connect(mg); osc.start(t); osc.stop(t + 0.11);
}

function mHat(t, vol = 0.08, dur = 0.035) {
  const ac = ctx(); const mg = getMusicGain();
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource(); src.buffer = buf;
  const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 9000;
  const env = ac.createGain();
  env.gain.setValueAtTime(vol, t); env.gain.exponentialRampToValueAtTime(0.001, t + dur * 1.5);
  src.connect(hp); hp.connect(env); env.connect(mg); src.start(t);
}

function mBass(t, freq, dur = 0.22, vol = 0.28) {
  const ac = ctx(); const mg = getMusicGain();
  const osc = ac.createOscillator(); const env = ac.createGain();
  osc.type = 'triangle'; osc.frequency.value = freq;
  env.gain.setValueAtTime(vol, t);
  env.gain.setValueAtTime(vol * 0.75, t + dur * 0.75);
  env.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.04);
  osc.connect(env); env.connect(mg);
  osc.start(t); osc.stop(t + dur + 0.06);
}

function mNote(t, freq, dur = 0.22, vol = 0.055, type = 'sine') {
  const ac = ctx(); const mg = getMusicGain();
  const osc = ac.createOscillator(); const env = ac.createGain();
  osc.type = type; osc.frequency.value = freq;
  env.gain.setValueAtTime(vol, t); env.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(env); env.connect(mg);
  osc.start(t); osc.stop(t + dur + 0.02);
}

function mVibNote(t, freq, dur = 0.28, vol = 0.065) {
  const ac = ctx(); const mg = getMusicGain();
  const osc = ac.createOscillator(); const lfo = ac.createOscillator();
  const lfoG = ac.createGain(); const env = ac.createGain();
  osc.type = 'sawtooth'; osc.frequency.value = freq;
  lfo.type = 'sine'; lfo.frequency.value = 5.5;
  lfoG.gain.value = freq * 0.018;
  lfo.connect(lfoG); lfoG.connect(osc.frequency);
  env.gain.setValueAtTime(0.001, t); env.gain.linearRampToValueAtTime(vol, t + 0.04);
  env.gain.setValueAtTime(vol, t + dur - 0.04); env.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(env); env.connect(mg);
  osc.start(t); osc.stop(t + dur + 0.02);
  lfo.start(t); lfo.stop(t + dur + 0.02);
}

// ── Tracks ────────────────────────────────────────────────────────────────────

function playSamba() {
  // 110 BPM — surdo, caixa, tamborim, melodia C maior pentatônica
  const mel  = [130.81,164.81,196.00,220.00,261.63,196.00,164.81,130.81];
  const bass = [65.41, 65.41, 73.42, 65.41, 55.00, 65.41, 73.42, 82.41];
  let bar = 0;
  return makeSeq(110, 16, (s, t) => {
    if (s === 0 || s === 8)          mKick(t, 65, 0.42, 0.68);         // surdo
    if (s === 4 || s === 12)         mSnare(t, 0.24);                   // caixa
    if (s === 6 || s === 14)         mSnare(t, 0.10);                   // ghost
    if ([0,2,5,8,10,13].includes(s)) mHat(t, 0.18, 0.05);              // tamborim
    if (s % 4 === 2)                 mHat(t, 0.07, 0.12);              // open hat
    if (s === 0)  mBass(t, bass[bar % 8], 0.3, 0.30);
    if (s === 4)  mBass(t, bass[(bar+1)%8] * 1.5, 0.2, 0.20);
    if (s === 8)  mBass(t, bass[bar % 8], 0.3, 0.28);
    if (s === 12) mBass(t, 55.00, 0.25, 0.22);
    if (s === 0)  mNote(t, mel[bar % 8], 0.18, 0.045);
    if (s === 5)  mNote(t, mel[(bar+2)%8], 0.14, 0.035);
    if (s === 10) mNote(t, mel[(bar+4)%8], 0.14, 0.035);
    if (s === 15) bar++;
  });
}

function playBossaNova() {
  // 82 BPM — padrão João Gilberto, acordes Am7→Dm7→G7→Cmaj7
  const chords = [
    [110.00,130.81,164.81,196.00], // Am7
    [146.83,174.61,220.00,261.63], // Dm7
    [196.00,233.08,293.66,369.99], // G7
    [261.63,329.63,392.00,493.88], // Cmaj7
  ];
  const bassNotes = [55.00, 73.42, 98.00, 130.81];
  const chordSteps = [0,3,6,7,9,11,13,14];
  let bar = 0;
  return makeSeq(82, 16, (s, t) => {
    const ch = chords[bar % 4];
    if (chordSteps.includes(s)) ch.forEach(f => mNote(t, f, 0.14, 0.038));
    if (s === 0)  mBass(t, bassNotes[bar % 4], 0.28, 0.28);
    if (s === 8)  mBass(t, bassNotes[bar % 4] * 1.5, 0.20, 0.20);
    if (s % 2 === 0) mHat(t, 0.055, 0.04);
    if (s === 4 || s === 12) mSnare(t, 0.12);
    if (s === 15) bar++;
  });
}

function playBaiao() {
  // 118 BPM — zabumba, triângulo, sanfona (vibrato)
  const mel = [164.81,196.00,220.00,246.94,293.66,246.94,220.00,196.00];
  let bar = 0;
  return makeSeq(118, 8, (s, t) => {
    if (s === 0 || s === 3 || s === 5) mKick(t, 72, 0.32, 0.62);      // zabumba
    mHat(t, 0.16, 0.06);                                                // triângulo
    if (s === 2 || s === 6) mSnare(t, 0.14);
    if (s === 0) mVibNote(t, mel[bar % 8], 0.24, 0.07);
    if (s === 2) mVibNote(t, mel[(bar+2)%8], 0.18, 0.055);
    if (s === 4) mVibNote(t, mel[(bar+4)%8], 0.22, 0.065);
    if (s === 6) mVibNote(t, mel[(bar+6)%8], 0.18, 0.050);
    if (s === 0) mBass(t, 82.41, 0.18, 0.30);
    if (s === 4) mBass(t, 98.00, 0.14, 0.22);
    if (s === 7) bar++;
  });
}

function playFunk() {
  // 96 BPM — bumbo pesado, caixa seca, baixo sintetizado
  const bassLine = [41.20,0,41.20,0, 0,55.00,0,0, 41.20,0,49.00,0, 0,0,41.20,0];
  let bar = 0;
  return makeSeq(96, 16, (s, t) => {
    if ([0,4,6,8,12].includes(s)) mKick(t, 58, 0.40, 0.75);
    if (s === 4 || s === 12)      mSnare(t, 0.32);
    mHat(t, 0.10, 0.03);
    if (s === 2 || s === 10) mHat(t, 0.14, 0.10);
    if (bassLine[s]) mBass(t, bassLine[s], 0.18, 0.38);
    if (s === 0)  mNote(t, 164.81, 0.08, 0.060, 'sawtooth');
    if (s === 8)  mNote(t, 196.00, 0.08, 0.050, 'sawtooth');
    if (s === 14) mNote(t, 146.83, 0.12, 0.055, 'sawtooth');
    if (s === 15) bar++;
  });
}

function playPagode() {
  // 88 BPM — tantã, repique, melodia gostosa
  const mel = [146.83,164.81,196.00,220.00,246.94,220.00,196.00,164.83];
  let bar = 0;
  return makeSeq(88, 16, (s, t) => {
    if ([0,3,6,8,11,14].includes(s)) mKick(t, 80, 0.30, 0.52);        // tantã
    if ([2,5,10,13].includes(s))     mSnare(t, 0.16);                  // repique
    if (s % 2 === 0) mHat(t, 0.07, 0.05);
    if (s === 0)  mBass(t, 73.42, 0.30, 0.28);
    if (s === 4)  mBass(t, 98.00, 0.20, 0.20);
    if (s === 8)  mBass(t, 82.41, 0.25, 0.24);
    if (s === 12) mBass(t, 73.42, 0.25, 0.22);
    if (s === 0)  mNote(t, mel[bar % 8], 0.30, 0.060);
    if (s === 4)  mNote(t, mel[(bar+2)%8], 0.25, 0.050);
    if (s === 8)  mNote(t, mel[(bar+4)%8], 0.28, 0.055);
    if (s === 12) mNote(t, mel[(bar+6)%8], 0.22, 0.045);
    if (s === 6 && bar % 2 === 1) mNote(t, mel[(bar+3)%8], 0.12, 0.035);
    if (s === 15) bar++;
  });
}

// ── Game sounds ───────────────────────────────────────────────────────────────

export const sfx = {

  toggleMute() {
    _muted = !_muted;
    return _muted;
  },

  isMuted() {
    return _muted;
  },

  getVolume(type) {
    if (type === 'sfx') return _sfxVolume;
    if (type === 'music') return _musicVolume;
    return 0;
  },

  setVolume(type, value) {
    if (type === 'sfx') {
      _sfxVolume = value;
      if (_sfxGain) _sfxGain.gain.value = value;
      _muted = value === 0;
    }
    if (type === 'music') {
      _musicVolume = value;
      if (_musicGain) _musicGain.gain.value = value;
    }
  },

  startAmbient() {
    if (!_activeTrackId) { _activeTrackId = 'ambient'; playAmbientLoop(); }
  },

  stopAmbient() { stopAllMusic(); },

  /** Jukebox — seleciona trilha sonora */
  playTrack(trackId) {
    stopAllMusic();
    if (!trackId || trackId === 'none') { _activeTrackId = 'none'; return; }
    _activeTrackId = trackId;
    const fns = {
      ambient:   () => playAmbientLoop(),
      samba:     playSamba,
      bossanova: playBossaNova,
      baiao:     playBaiao,
      funk:      playFunk,
      pagode:    playPagode,
    };
    if (trackId === 'ambient') { playAmbientLoop(); return; }
    if (fns[trackId]) _sequencerStop = fns[trackId]();
  },

  stopMusic() { stopAllMusic(); },

  getCurrentTrack() { return _activeTrackId; },

  /** Click — clique rápido de UI */
  click() {
    if (_muted) return;
    tone({ freq: 720, type: 'sine', start: 0, duration: 0.06, gain: 0.12 });
  },

  /** Sua vez — dois bips ascendentes */
  myTurn() {
    if (_muted) return;
    tone({ freq: 523, type: 'sine', start: 0,    duration: 0.12, gain: 0.22 });
    tone({ freq: 784, type: 'sine', start: 0.14, duration: 0.18, gain: 0.18 });
  },

  /** Ação declarada — impacto suave */
  action() {
    if (_muted) return;
    tone({ freq: 380, type: 'triangle', start: 0,   duration: 0.1,  gain: 0.3  });
    tone({ freq: 300, type: 'triangle', start: 0.08, duration: 0.18, gain: 0.15 });
  },

  /** Moedas ganhas — pingue metálico */
  coin() {
    if (_muted) return;
    tone({ freq: 900,  type: 'sine', start: 0,    duration: 0.07, gain: 0.2  });
    tone({ freq: 1400, type: 'sine', start: 0.06, duration: 0.09, gain: 0.15 });
  },

  /** Bloqueio — baque sólido */
  block() {
    if (_muted) return;
    tone({ freq: 180, type: 'square', start: 0,    duration: 0.08, gain: 0.28 });
    tone({ freq: 140, type: 'square', start: 0.07, duration: 0.12, gain: 0.18 });
  },

  /** Duvidou — sting dramático */
  challenge() {
    if (_muted) return;
    tone({ freq: 440, type: 'sawtooth', start: 0,    duration: 0.06, gain: 0.3  });
    tone({ freq: 220, type: 'sawtooth', start: 0.05, duration: 0.08, gain: 0.28 });
    tone({ freq: 160, type: 'sawtooth', start: 0.12, duration: 0.18, gain: 0.22 });
  },

  /** Carta eliminada — descida sombria */
  eliminate() {
    if (_muted) return;
    tone({ freq: 280, type: 'sawtooth', start: 0,    duration: 0.15, gain: 0.3, pitchEnd: 180 });
    tone({ freq: 180, type: 'sawtooth', start: 0.13, duration: 0.2,  gain: 0.2, pitchEnd: 100 });
    noise({ start: 0, duration: 0.12, gain: 0.12 });
  },

  /** X9 espionagem — sussurro eletrônico */
  x9() {
    if (_muted) return;
    tone({ freq: 800,  type: 'sine', start: 0,    duration: 0.08, gain: 0.15 });
    tone({ freq: 1100, type: 'sine', start: 0.07, duration: 0.06, gain: 0.12 });
    tone({ freq: 900,  type: 'sine', start: 0.12, duration: 0.1,  gain: 0.1  });
  },

  /** Vitória — fanfarra ascendente */
  win() {
    if (_muted) return;
    [523, 659, 784, 1047, 1319].forEach((freq, i) =>
      tone({ freq, type: 'sine', start: i * 0.12, duration: 0.18, gain: 0.22 })
    );
  },

  /** Derrota — descida triste */
  lose() {
    if (_muted) return;
    [440, 370, 330, 262].forEach((freq, i) =>
      tone({ freq, type: 'triangle', start: i * 0.14, duration: 0.2, gain: 0.18 })
    );
  },

  /** Carta virada / confirmação */
  cardFlip() {
    if (_muted) return;
    noise({ start: 0, duration: 0.06, gain: 0.18 });
    tone({ freq: 600, type: 'sine', start: 0.03, duration: 0.08, gain: 0.12 });
  },

  /** Chat bubble — ping social */
  chat() {
    if (_muted) return;
    tone({ freq: 1100, type: 'sine', start: 0,    duration: 0.07, gain: 0.1 });
    tone({ freq: 1300, type: 'sine', start: 0.06, duration: 0.09, gain: 0.08 });
  },

  /** Tiro — assassinar / Mandar pro Vasco */
  gunshot() {
    if (_muted) return;
    const ac = ctx();
    // Estalo de tiro (ruído branco filtrado)
    const bufSize = ac.sampleRate * 0.08;
    const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 1.5);
    const src = ac.createBufferSource(); src.buffer = buf;
    const filter = ac.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = 800; filter.Q.value = 0.5;
    const vol = ac.createGain();
    vol.gain.setValueAtTime(1.2, ac.currentTime);
    vol.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.35);
    src.connect(filter); filter.connect(vol); vol.connect(getSfxGain());
    src.start(ac.currentTime);
    // Sub-boom grave
    tone({ freq: 90,  type: 'sine',   start: 0,    duration: 0.35, gain: 0.6, pitchEnd: 30 });
    tone({ freq: 180, type: 'square', start: 0,    duration: 0.08, gain: 0.3 });
    // Eco / reverb
    tone({ freq: 120, type: 'triangle', start: 0.12, duration: 0.28, gain: 0.18, pitchEnd: 50 });
  },

  /** Caixa registradora — taxar / Fazer o L */
  cashRegister() {
    if (_muted) return;
    // Série de moedas cascateando + DING final de caixa
    [880, 1100, 1320, 1540, 1760].forEach((freq, i) =>
      tone({ freq, type: 'sine', start: i * 0.055, duration: 0.07, gain: 0.2 })
    );
    // DING! (sino de caixa registradora)
    tone({ freq: 2637, type: 'sine', start: 0.32, duration: 0.28, gain: 0.22 });
    tone({ freq: 2637, type: 'sine', start: 0.30, duration: 0.06, gain: 0.14 });
  },

  /** Roubo furtivo — roubar / Pegar o Arrego */
  steal() {
    if (_muted) return;
    // Swipe rápido + moeda
    tone({ freq: 600, type: 'sawtooth', start: 0,    duration: 0.06, gain: 0.22, pitchEnd: 300 });
    tone({ freq: 900, type: 'sine',     start: 0.07, duration: 0.09, gain: 0.18 });
    tone({ freq: 1200, type: 'sine',    start: 0.12, duration: 0.07, gain: 0.12 });
    noise({ start: 0.02, duration: 0.05, gain: 0.08 });
  },

  /** Martelo do juiz — veredito */
  gavel() {
    if (_muted) return;
    // Baque seco + reverb
    noise({ start: 0,    duration: 0.035, gain: 0.55 });
    tone({ freq: 220, type: 'sine',     start: 0.01, duration: 0.25, gain: 0.45, pitchEnd: 110 });
    tone({ freq: 440, type: 'triangle', start: 0,    duration: 0.08, gain: 0.22 });
    // Segundo baque (martelo bate duas vezes)
    noise({ start: 0.32, duration: 0.035, gain: 0.4 });
    tone({ freq: 220, type: 'sine',     start: 0.33, duration: 0.2,  gain: 0.32, pitchEnd: 100 });
  },

  /** Explosão — golpe de estado */
  boom() {
    if (_muted) return;
    noise({ start: 0,    duration: 0.3,  gain: 0.65 });
    noise({ start: 0.05, duration: 0.25, gain: 0.4 });
    tone({ freq: 80,  type: 'sine',   start: 0,    duration: 0.35, gain: 0.6, pitchEnd: 25 });
    tone({ freq: 160, type: 'sine',   start: 0.04, duration: 0.28, gain: 0.4, pitchEnd: 50 });
    tone({ freq: 320, type: 'square', start: 0,    duration: 0.08, gain: 0.25 });
  },

  /** Espionagem X9 estendida — meter_x9 */
  spy() {
    if (_muted) return;
    // Beeps eletrônicos de escâner
    [1400, 1100, 1600, 900].forEach((freq, i) =>
      tone({ freq, type: 'sine', start: i * 0.09, duration: 0.06, gain: 0.14 })
    );
    tone({ freq: 800, type: 'triangle', start: 0.38, duration: 0.12, gain: 0.1 });
  },
};
