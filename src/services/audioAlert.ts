import { RiskLevel } from '../types';

/**
 * ADAS Acoustic Warning Synthesizer
 * Generates ISO/SAE compliant automotive audio warning beeps via Web Audio API.
 */
export class AudioAlertSystem {
  private static ctx: AudioContext | null = null;
  private static lastBeepTime: number = 0;

  private static getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Resumes the Web Audio context after a user interaction
   */
  public resume(): void {
    AudioAlertSystem.resume();
  }

  public static resume(): void {
    const ctx = this.getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  /**
   * Plays alert sound corresponding to the specified risk level
   */
  public playAlert(level: RiskLevel, volume: number = 0.6): void {
    AudioAlertSystem.playAlert(level, volume);
  }

  /**
   * Plays appropriate audio alert based on risk level
   */
  public trigger(level: RiskLevel, enabled: boolean = true, volume: number = 0.6): void {
    AudioAlertSystem.trigger(level, enabled, volume);
  }

  /**
   * Static method to play alert sound
   */
  public static playAlert(level: RiskLevel, volume: number = 0.6): void {
    this.trigger(level, true, volume);
  }

  /**
   * Plays appropriate audio alert based on risk level
   */
  public static trigger(level: RiskLevel, enabled: boolean = true, volume: number = 0.6): void {
    if (!enabled || (level !== 'HIGH' && level !== 'CRITICAL')) {
      return;
    }

    const now = Date.now();
    const interval = level === 'CRITICAL' ? 360 : 750; // faster beeps for critical
    if (now - this.lastBeepTime < interval) {
      return;
    }
    this.lastBeepTime = now;

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = level === 'CRITICAL' ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(level === 'CRITICAL' ? 1250 : 880, ctx.currentTime);

      // Pulse frequency modulation for critical urgency
      if (level === 'CRITICAL') {
        osc.frequency.exponentialRampToValueAtTime(1450, ctx.currentTime + 0.08);
        osc.frequency.exponentialRampToValueAtTime(1100, ctx.currentTime + 0.16);
      }

      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(Math.min(0.8, volume), ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (level === 'CRITICAL' ? 0.18 : 0.14));

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    } catch {
      // Ignore audio synthesis errors on locked browsers
    }
  }
}
