// Centralized Audio Synthesizer for Notifications & Sound Alerts

let audioCtx: AudioContext | null = null;
let currentCustomAudio: HTMLAudioElement | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx) {
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playNotificationSound(soundType: string = 'classic', customUrl?: string | null) {
  if (typeof window === 'undefined') return;

  // Custom uploaded sound (MP3/WAV/AAC)
  if (soundType === 'custom' && customUrl) {
    try {
      if (currentCustomAudio) {
        currentCustomAudio.pause();
        currentCustomAudio.currentTime = 0;
      }
      currentCustomAudio = new Audio(customUrl);
      currentCustomAudio.volume = 0.95;
      currentCustomAudio.play().catch((err) => {
        console.warn('[Audio] Falha na reprodução de áudio customizado:', err);
      });
    } catch (err) {
      console.warn('[Audio] Erro ao criar elemento de áudio:', err);
    }
    return;
  }

  // Web Audio API Synthesizers
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (soundType === 'chime') {
      // 4-note marimba: C5, E5, G5, C6
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);
        gain.gain.setValueAtTime(0.2, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.36);
      });
    } else if (soundType === 'bell') {
      // Crystal bell harmonics
      [880, 1760, 2640].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        const initialGain = 0.22 / (idx + 1);
        gain.gain.setValueAtTime(initialGain, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.86);
      });
    } else if (soundType === 'modern') {
      // Tech double blip
      [1200, 1800].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.11);
        gain.gain.setValueAtTime(0.2, now + i * 0.11);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.11 + 0.09);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.11);
        osc.stop(now + i * 0.11 + 0.1);
      });
    } else if (soundType === 'zen') {
      // 432Hz deep bowl
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(432, now);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.21);
    } else if (soundType === 'cash') {
      // Cash register coin jingle
      [987.77, 1318.51, 1760.00].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.07);
        gain.gain.setValueAtTime(0.22, now + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.07);
        osc.stop(now + i * 0.07 + 0.31);
      });
    } else {
      // Classic D5 -> A5
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(880, now + 0.15);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.46);
    }
  } catch (err) {
    console.warn('[Audio] Erro no Web Audio API:', err);
  }
}
