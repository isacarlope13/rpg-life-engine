// Motor de Audio Procedimental Cozy para RPG Life-Engine
// Utiliza la Web Audio API nativa sin archivos pesados ni dependencias externas.
// Respeta estrictamente el estado silenciado por defecto y las políticas de autoplay.

export type SoundscapeTheme = "silent" | "sunny_breeze" | "gentle_rain" | "autumn_wind" | "night_crickets";

class CozySoundscapeManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private currentTheme: SoundscapeTheme = "silent";
  private isMuted: boolean = true;
  private volume: number = 0.25; // Nivel suave no intrusivo
  private activeNodes: { stop?: () => void; disconnect: () => void }[] = [];

  private initContext() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      try {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          this.ctx = new AudioContextClass();
          this.masterGain = this.ctx.createGain();
          this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
          this.masterGain.connect(this.ctx.destination);
        }
      } catch (err) {
        console.warn("[CozySoundscape] AudioContext no permitido o bloqueado por Safari iOS:", err);
        this.ctx = null;
        this.masterGain = null;
        return;
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
    if (!muted && this.currentTheme === "silent") {
      this.playTheme("sunny_breeze");
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getCurrentTheme(): SoundscapeTheme {
    return this.currentTheme;
  }

  public stopAll() {
    this.activeNodes.forEach((node) => {
      try {
        if (node.stop) node.stop();
        node.disconnect();
      } catch {
        // Ignorar si ya estaba desconectado
      }
    });
    this.activeNodes = [];
  }

  public playTheme(theme: SoundscapeTheme) {
    this.initContext();
    this.stopAll();
    this.currentTheme = theme;

    if (theme === "silent" || !this.ctx || !this.masterGain) {
      return;
    }

    try {
      if (theme === "gentle_rain") {
        this.createRainSound();
      } else if (theme === "sunny_breeze") {
        this.createBreezeSound(260, 0.4);
      } else if (theme === "autumn_wind") {
        this.createBreezeSound(180, 0.7);
      } else if (theme === "night_crickets") {
        this.createNightAmbience();
      }
    } catch (err) {
      console.warn("[CozySoundscape] Error al sintetizar sonido:", err);
    }
  }

  // Generador de lluvia suave mediante buffer de ruido filtrado
  private createRainSound() {
    if (!this.ctx || !this.masterGain) return;

    // Buffer de 3 segundos de ruido blanco suave
    const bufferSize = this.ctx.sampleRate * 3;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    // Filtro paso-bajas para transformar el ruido blanco en lluvia suave
    const lowpass = this.ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(650, this.ctx.currentTime);

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.2, this.ctx.currentTime);

    whiteNoise.connect(lowpass);
    lowpass.connect(gainNode);
    gainNode.connect(this.masterGain);

    whiteNoise.start();
    this.activeNodes.push(whiteNoise, lowpass, gainNode);
  }

  // Generador de brisa suave con oscilador modulado por LFO
  private createBreezeSound(centerFreq: number, intensity: number) {
    if (!this.ctx || !this.masterGain) return;

    // Buffer de ruido suave
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    // Filtro paso banda para dar tono de viento en las ramas
    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.setValueAtTime(centerFreq, this.ctx.currentTime);
    bandpass.Q.setValueAtTime(2.5, this.ctx.currentTime);

    // LFO para oscilar la intensidad del viento suavemente cada ~4 segundos
    const lfo = this.ctx.createOscillator();
    lfo.frequency.setValueAtTime(0.22, this.ctx.currentTime);
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(70 * intensity, this.ctx.currentTime);
    lfo.connect(bandpass.frequency);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18 * intensity, this.ctx.currentTime);

    noise.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(this.masterGain);

    noise.start();
    lfo.start();
    this.activeNodes.push(noise, bandpass, lfo, lfoGain, gain);
  }

  // Generador de ambiente nocturno: viento muy leve + sutil pulso de grillos
  private createNightAmbience() {
    if (!this.ctx || !this.masterGain) return;

    // Base de viento nocturno suave
    this.createBreezeSound(140, 0.3);

    // Pulso muy suave para simular grillos distantes
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(4500, this.ctx.currentTime);

    const mod = this.ctx.createOscillator();
    mod.type = "sawtooth";
    mod.frequency.setValueAtTime(14, this.ctx.currentTime);

    const cricketGain = this.ctx.createGain();
    cricketGain.gain.setValueAtTime(0.015, this.ctx.currentTime);

    const modGain = this.ctx.createGain();
    modGain.gain.setValueAtTime(0.015, this.ctx.currentTime);

    mod.connect(modGain);
    osc.connect(cricketGain);
    cricketGain.connect(this.masterGain);

    osc.start();
    mod.start();
    this.activeNodes.push(osc, mod, cricketGain, modGain);
  }
}

// Instancia singleton para uso en el cliente
export const cozySoundscape = new CozySoundscapeManager();
