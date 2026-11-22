// All sound is procedural Web Audio — no audio files. Short, quiet cues: a
// coin's clink, a loot chime, the soft ticks of a vault being cracked, a
// suspicion sting, the alarm's two-tone bite and the getaway jingle.

export function makeAudio() {
  let ctx = null;
  let master = null;

  function unlock() {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.16;
        master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
    } catch {
      ctx = null;
    }
  }

  function tone(freqA, freqB, seconds, type, delay = 0, gainScale = 1) {
    if (!ctx || !master) return;
    try {
      const t0 = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freqA, t0);
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqB), t0 + seconds);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.5 * gainScale, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t0);
      osc.stop(t0 + seconds + 0.05);
    } catch {
      /* sound is decoration; never break the game for it */
    }
  }

  return {
    unlock,
    click() {
      tone(660, 660, 0.05, 'square', 0, 0.4);
    },
    coin() {
      tone(2093, 1568, 0.09, 'sine', 0, 0.7);
      tone(2637, 2093, 0.12, 'sine', 0.07, 0.5);
    },
    pickup() {
      tone(880, 880, 0.07, 'triangle', 0, 0.8);
      tone(1318, 1318, 0.1, 'triangle', 0.06, 0.8);
    },
    crackTick() {
      tone(340, 240, 0.03, 'square', 0, 0.25);
    },
    panel() {
      tone(520, 780, 0.12, 'sine', 0, 0.6);
    },
    emp() {
      tone(1200, 90, 0.35, 'sawtooth', 0, 0.5);
    },
    wary() {
      tone(392, 370, 0.16, 'triangle', 0, 0.9);
    },
    alert() {
      tone(587, 587, 0.1, 'square', 0, 0.7);
      tone(587, 587, 0.1, 'square', 0.13, 0.7);
    },
    lockdown() {
      tone(440, 440, 0.14, 'sawtooth', 0, 0.8);
      tone(440, 440, 0.14, 'sawtooth', 0.2, 0.8);
      tone(440, 440, 0.2, 'sawtooth', 0.4, 0.8);
    },
    caught() {
      tone(330, 55, 0.7, 'sawtooth', 0, 0.9);
    },
    escape() {
      tone(523, 523, 0.1, 'triangle', 0, 0.8);
      tone(659, 659, 0.1, 'triangle', 0.09, 0.8);
      tone(784, 784, 0.1, 'triangle', 0.18, 0.8);
      tone(1046, 1046, 0.22, 'triangle', 0.27, 0.9);
    },
  };
}
