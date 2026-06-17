// Web Audio API Shutter Sound Synthesizer
// Unlocks and plays without loading external audio assets, works perfectly offline.

class AudioManager {
  constructor() {
    this.ctx = null;
  }

  // Initialize and unlock the audio context (must be called inside a user gesture handler)
  init() {
    if (this.ctx) return;
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtxClass();
      
      // Resume if suspended (common iOS restriction)
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().then(() => {
          console.log('AudioContext successfully resumed');
          // Play a silent note to fully activate the speaker
          this.playSilentNotification();
        }).catch(err => {
          console.warn('Failed to resume AudioContext:', err);
        });
      } else {
        this.playSilentNotification();
      }
    } catch (e) {
      console.error('Web Audio API is not supported on this browser', e);
    }
  }

  playSilentNotification() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    osc.start(0);
    osc.stop(0.01);
  }

  // Synthesize a retro mechanical camera shutter "click" sound
  playClick() {
    // Lazy initialization in case init() wasn't triggered
    if (!this.ctx) {
      this.init();
    }
    
    if (!this.ctx) return;
    
    // Ensure context is running (especially on iOS/Chrome power saver modes)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const now = this.ctx.currentTime;
    
    // 1. Shutter High Click (Metallic transient)
    // Create a 0.05-second white noise buffer
    const clickDuration = 0.05;
    const clickBuffer = this.createNoiseBuffer(clickDuration);
    
    const clickSource = this.ctx.createBufferSource();
    clickSource.buffer = clickBuffer;
    
    const clickFilter = this.ctx.createBiquadFilter();
    clickFilter.type = 'bandpass';
    clickFilter.frequency.setValueAtTime(2500, now); // mid-high frequency for metallic click
    clickFilter.Q.setValueAtTime(3, now);
    
    const clickGain = this.ctx.createGain();
    clickGain.gain.setValueAtTime(0.8, now);
    clickGain.gain.exponentialRampToValueAtTime(0.01, now + clickDuration);
    
    clickSource.connect(clickFilter);
    clickFilter.connect(clickGain);
    clickGain.connect(this.ctx.destination);
    
    // 2. Mirror Flap / Body Clack (Low mechanical sound)
    const clackDuration = 0.15;
    const clackBuffer = this.createNoiseBuffer(clackDuration);
    
    const clackSource = this.ctx.createBufferSource();
    clackSource.buffer = clackBuffer;
    
    const clackFilter = this.ctx.createBiquadFilter();
    clackFilter.type = 'lowpass';
    clackFilter.frequency.setValueAtTime(400, now); // Low frequency thud
    
    const clackGain = this.ctx.createGain();
    clackGain.gain.setValueAtTime(0.6, now);
    clackGain.gain.exponentialRampToValueAtTime(0.01, now + clackDuration);
    
    clackSource.connect(clackFilter);
    clackFilter.connect(clackGain);
    clackGain.connect(this.ctx.destination);
    
    // Start both sounds
    clickSource.start(now);
    clackSource.start(now + 0.005); // slight offset for realistic physical double click
    
    clickSource.stop(now + clickDuration + 0.05);
    clackSource.stop(now + clackDuration + 0.05);
  }

  // Helper to create a mono noise buffer
  createNoiseBuffer(duration) {
    const sampleRate = this.ctx.sampleRate;
    const bufferSize = sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }
}

export const audioManager = new AudioManager();
