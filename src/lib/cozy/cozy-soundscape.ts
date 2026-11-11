"use client";

export type SoundscapePreset = "off" | "rain" | "fireplace" | "breeze" | "chimes";

export interface SoundscapeInfo {
  id: SoundscapePreset;
  label: string;
  icon: string;
  description: string;
}

export const SOUNDSCAPE_PRESETS: SoundscapeInfo[] = [
  {
    id: "off",
    label: "Silencio de Calma",
    icon: "🔇",
    description: "Modo silencioso por defecto, respetando la tranquilidad.",
  },
  {
    id: "rain",
    label: "Lluvia en el Tejón",
    icon: "🌧️",
    description: "Gotas suaves golpeando el tejado de madera del santuario.",
  },
  {
    id: "fireplace",
    label: "Fogón Crepitante",
    icon: "🔥",
    description: "Chispas y brasas acogedoras de leña seca de roble.",
  },
  {
    id: "breeze",
    label: "Brisa del Valle",
    icon: "🍃",
    description: "Viento tenue meciendo las ramas del bosque de Oakhaven.",
  },
  {
    id: "chimes",
    label: "Campanas de Viento",
    icon: "🎐",
    description: "Tonos pentatónicos relajantes suspendidos en el aire.",
  },
];

class SoundscapeEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private currentPreset: SoundscapePreset = "off";
  private volume: number = 0.35;
  private loopTimer: NodeJS.Timeout | null = null;
  private activeGenerators: Array<() => void> = [];

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("cozy_soundscape_vol", this.volume.toString());
      } catch {}
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public getCurrentPreset(): SoundscapePreset {
    return this.currentPreset;
  }

  public stop() {
    if (this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
    this.activeGenerators.forEach((stopFn) => stopFn());
    this.activeGenerators = [];
    this.currentPreset = "off";
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("cozy_soundscape_preset", "off");
      } catch {}
    }
  }

  public play(preset: SoundscapePreset) {
    this.stop();
    if (preset === "off") return;

    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    this.currentPreset = preset;
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("cozy_soundscape_preset", preset);
      } catch {}
    }

    switch (preset) {
      case "rain":
        this.startRain(ctx);
        break;
      case "fireplace":
        this.startFireplace(ctx);
        break;
      case "breeze":
        this.startBreeze(ctx);
        break;
      case "chimes":
        this.startChimes(ctx);
        break;
    }
  }

  /** Lluvia Suave: Ruido rosa filtrado paso-bajo + goteo sutil */
  private startRain(ctx: AudioContext) {
    if (!this.masterGain) return;
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.05;
      b6 = white * 0.115926;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(800, ctx.currentTime);

    noise.connect(filter);
    filter.connect(this.masterGain);
    noise.start();

    this.activeGenerators.push(() => {
      try {
        noise.stop();
        noise.disconnect();
        filter.disconnect();
      } catch {}
    });
  }

  /** Fogón Crepitante: Ruido filtrado con micro-impulsos de chasquido aleatorio */
  private startFireplace(ctx: AudioContext) {
    if (!this.masterGain) return;
    // Base de combustión suave (lowpass rumble)
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.03;
    }

    const baseNoise = ctx.createBufferSource();
    baseNoise.buffer = buffer;
    baseNoise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(250, ctx.currentTime);

    baseNoise.connect(filter);
    filter.connect(this.masterGain);
    baseNoise.start();

    // Chasquidos aleatorios (crackles)
    const crackleInterval = setInterval(() => {
      if (!this.ctx || !this.masterGain || Math.random() > 0.4) return;
      const osc = ctx.createOscillator();
      const clickGain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(120 + Math.random() * 300, ctx.currentTime);

      clickGain.gain.setValueAtTime(0.08, ctx.currentTime);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.03);

      osc.connect(clickGain);
      clickGain.connect(this.masterGain);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    }, 150);

    this.activeGenerators.push(() => {
      clearInterval(crackleInterval);
      try {
        baseNoise.stop();
        baseNoise.disconnect();
        filter.disconnect();
      } catch {}
    });
  }

  /** Brisa del Valle: Ruido suave modulado por un oscilador de baja frecuencia (LFO) */
  private startBreeze(ctx: AudioContext) {
    if (!this.masterGain) return;
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.04;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(450, ctx.currentTime);
    filter.Q.setValueAtTime(1.5, ctx.currentTime);

    // LFO para emular ráfagas suaves
    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(0.15, ctx.currentTime); // un ciclo cada ~6 segundos
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(200, ctx.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    noise.connect(filter);
    filter.connect(this.masterGain);

    noise.start();
    lfo.start();

    this.activeGenerators.push(() => {
      try {
        noise.stop();
        lfo.stop();
        noise.disconnect();
        lfo.disconnect();
        filter.disconnect();
      } catch {}
    });
  }

  /** Campanas Zen: Generación de tonos pentatónicos con decaimiento natural cada 4s */
  private startChimes(ctx: AudioContext) {
    if (!this.masterGain) return;
    const pentatonicNotes = [440, 493.88, 554.37, 659.25, 739.99, 880]; // A4, B4, C#5, E5, F#5, A5

    const playChime = () => {
      if (!this.ctx || !this.masterGain) return;
      const freq = pentatonicNotes[Math.floor(Math.random() * pentatonicNotes.length)];
      const osc = ctx.createOscillator();
      const chimeGain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      chimeGain.gain.setValueAtTime(0.06, ctx.currentTime);
      chimeGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 3.2);

      osc.connect(chimeGain);
      chimeGain.connect(this.masterGain);

      osc.start();
      osc.stop(ctx.currentTime + 3.3);
    };

    playChime();
    const chimeTimer = setInterval(playChime, 3800);

    this.activeGenerators.push(() => {
      clearInterval(chimeTimer);
    });
  }
}

// Instancia única (Singleton accesible en cliente)
export const cozySoundscape = new SoundscapeEngine();
