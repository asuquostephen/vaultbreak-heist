// All sound is procedural Web Audio — no audio files. Short, quiet cues: a
// coin's clink, a loot chime, the soft ticks of a vault being cracked, a
// suspicion sting, the alarm's two-tone bite and the getaway jingle. And
// one long one: the Blackout Mode night bed, a low detuned drone that hums
// under the floor while the lights are out, and stops when they come back.

export function makeAudio() {
  let ctx = null;
  let master = null;
  let bed = null; // the night bed's nodes, while Blackout Mode holds

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

  // The night bed: two low sines a few hertz apart, breathing slowly
  // through a shared gain, so the dark has a sound of its own.
  function startBed() {
    if (!ctx || !master || bed) return;
    try {
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      gain.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 1.2);
      gain.connect(master);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.02;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      const voices = [55, 55.7, 110.4, 120.9].map((freq) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.connect(gain);
        osc.start();
        return osc;
      });
      lfo.start();
      bed = { gain, lfo, voices };
    } catch {
      bed = null;
    }
  }

  function stopBed() {
    if (!bed || !ctx) return;
    try {
      const { gain, lfo, voices } = bed;
      bed = null;
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
      const stopAt = ctx.currentTime + 0.5;
      for (const osc of voices) osc.stop(stopAt);
      lfo.stop(stopAt);
      setTimeout(() => {
        try {
          gain.disconnect();
        } catch {
          /* already gone */
        }
      }, 600);
    } catch {
      bed = null;
    }
  }

  return {
    unlock,
    // The lights die: a low thunk, then the bed comes up underneath.
    blackoutOn() {
      tone(180, 60, 0.25, 'sine', 0, 0.9);
      startBed();
    },
    // The lights come back: the bed fades, a soft click.
    blackoutOff() {
      stopBed();
      tone(520, 520, 0.06, 'triangle', 0, 0.5);
    },
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
    // A job on the card is done: a bright two-note chime, higher than a pickup.
    objective() {
      tone(1046, 1046, 0.09, 'triangle', 0, 0.8);
      tone(1568, 1568, 0.14, 'triangle', 0.08, 0.8);
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
