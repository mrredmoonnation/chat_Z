// Web Audio API Synthesizer for WhatsApp sounds (Zero external MP3 dependencies)

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ringtoneInterval = null;
    this.isRinging = false;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // WhatsApp sent message pop sound
  playMessageSent() {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1000, this.ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.09);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  // WhatsApp incoming message chime
  playMessageReceived() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      [800, 1200].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.25, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.12);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.13);
      });
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  // Start WhatsApp Incoming Call Ringtone
  startIncomingRingtone() {
    this.stopRingtone();
    this.isRinging = true;
    this.init();

    const playNotes = () => {
      if (!this.isRinging || !this.ctx) return;
      const now = this.ctx.currentTime;
      // WhatsApp style melodic marimba notes: E5, G#5, B5, E6
      const melody = [659.25, 830.61, 987.77, 1318.51, 987.77, 1318.51];
      melody.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.15);
        gain.gain.setValueAtTime(0.3, now + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.22);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.15);
        osc.stop(now + i * 0.15 + 0.25);
      });
    };

    playNotes();
    this.ringtoneInterval = setInterval(playNotes, 2400);
  }

  // Start WhatsApp Outgoing Ringing Tone (double beeps: tuut... tuut...)
  startOutgoingTone() {
    this.stopRingtone();
    this.isRinging = true;
    this.init();

    const playBeep = () => {
      if (!this.isRinging || !this.ctx) return;
      const now = this.ctx.currentTime;
      [0, 0.22].forEach(delay => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(425, now + delay);
        gain.gain.setValueAtTime(0.2, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.18);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + 0.19);
      });
    };

    playBeep();
    this.ringtoneInterval = setInterval(playBeep, 2800);
  }

  // Stop any active ringtone or tone
  stopRingtone() {
    this.isRinging = false;
    if (this.ringtoneInterval) {
      clearInterval(this.ringtoneInterval);
      this.ringtoneInterval = null;
    }
  }
}

export const sounds = new AudioEngine();
