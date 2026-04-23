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

  // Bass drone on C2 (65.4 Hz) with slow oscillation
  const drones = [65.4, 98.0, 130.8]; // C2, G2, C3
  drones.forEach((freq, i) => {
    const osc = ac.createOscillator();
    const lfo = ac.createOscillator();
    const lfoGain = ac.createGain();
    const vol = ac.createGain();

    osc.type = 'sine';
    osc.frequency.value = freq;

    lfo.type = 'sine';
    lfo.frequency.value = 0.08 + i * 0.03; // very slow wobble
    lfoGain.gain.value = freq * 0.004;

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    vol.gain.value = 0.04 - i * 0.008;
    osc.connect(vol);
    vol.connect(mg);

    osc.start();
    lfo.start();
    _ambientNodes.push(osc, lfo);
  });

  // Subtle high shimmer
  const shimmer = ac.createOscillator();
  const shimmerVol = ac.createGain();
  shimmer.type = 'sine';
  shimmer.frequency.value = 523.25; // C5
  shimmerVol.gain.value = 0.006;
  shimmer.connect(shimmerVol);
  shimmerVol.connect(mg);
  shimmer.start();
  _ambientNodes.push(shimmer);
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
    playAmbientLoop();
  },

  stopAmbient() {
    _ambientRunning = false;
    _ambientNodes.forEach(n => { try { n.stop(); } catch {} });
    _ambientNodes = [];
  },

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
