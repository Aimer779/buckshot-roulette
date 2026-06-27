import { Howl } from 'howler';

// ─── Sound Registry ──────────────────────────────────────

const soundCache: Map<string, Howl> = new Map();

const SOUND_URLS: Record<string, string> = {
  'shotgun-pump': '/sfx-shotgun-pump.mp3',
  'shotgun-fire': '/sfx-shotgun-fire.mp3',
  'shotgun-click': '/sfx-shotgun-click.mp3',
  'shell-load': '/sfx-shell-load.mp3',
  'shell-eject': '/sfx-shell-eject.mp3',
  'damage': '/sfx-damage.mp3',
  'item-use': '/sfx-item-use.mp3',
  'heartbeat': '/sfx-heartbeat.mp3',
  'metal-clank': '/sfx-metal-clank.mp3',
  'saw': '/sfx-saw.mp3',
  'glass-break': '/sfx-glass-break.mp3',
  'phone-ring': '/sfx-phone-ring.mp3',
  'guillotine-drop': '/sfx-guillotine-drop.mp3',
};

// ─── Utility ─────────────────────────────────────────────

/**
 * Get or create a Howl instance for a sound
 */
export function getSound(name: string): Howl | null {
  if (soundCache.has(name)) {
    return soundCache.get(name)!;
  }

  const url = SOUND_URLS[name];
  if (!url) {
    console.warn(`Sound "${name}" not found in registry`);
    return null;
  }

  const howl = new Howl({
    src: [url],
    volume: 1.0,
    preload: false,
    onloaderror: () => {
      // Silently handle missing audio files
      console.warn(`Failed to load sound: ${url}`);
    },
  });

  soundCache.set(name, howl);
  return howl;
}

/**
 * Preload a sound into memory
 */
export function preloadSound(name: string): void {
  const sound = getSound(name);
  if (sound && sound.state() === 'unloaded') {
    sound.load();
  }
}

/**
 * Play a sound effect
 */
export function playSFX(name: string, volume?: number): void {
  const sound = getSound(name);
  if (!sound) return;

  const id = sound.play();
  if (volume !== undefined) {
    sound.volume(volume, id);
  }
}

/**
 * Stop a playing sound
 */
export function stopSFX(name: string): void {
  const sound = getSound(name);
  if (sound) {
    sound.stop();
  }
}

/**
 * Set global volume for all sounds
 */
export function setGlobalVolume(volume: number): void {
  Howler.volume(Math.max(0, Math.min(1, volume)));
}

/**
 * Mute/unmute all sounds
 */
export function setMute(muted: boolean): void {
  Howler.mute(muted);
}

/**
 * Check if a sound is currently playing
 */
export function isPlaying(name: string): boolean {
  const sound = getSound(name);
  return sound ? sound.playing() : false;
}

/**
 * Preload all game sounds
 */
export function preloadAllSounds(): void {
  Object.keys(SOUND_URLS).forEach(preloadSound);
}

// ─── Background Music ────────────────────────────────────

let currentBGM: Howl | null = null;
let currentBGMName: string | null = null;

export function playBGM(name: 'title' | 'gameplay' | 'gameover-win' | 'gameover-lose', loop = true): void {
  // Stop current BGM
  if (currentBGM) {
    currentBGM.stop();
  }

  const url = `/bgm-${name}.mp3`;
  const bgm = new Howl({
    src: [url],
    loop,
    volume: 0.5,
    preload: true,
    onloaderror: () => {
      console.warn(`Failed to load BGM: ${url}`);
    },
  });

  currentBGM = bgm;
  currentBGMName = name;
  bgm.play();
}

export function stopBGM(): void {
  if (currentBGM) {
    currentBGM.stop();
    currentBGM = null;
    currentBGMName = null;
  }
}

export function pauseBGM(): void {
  if (currentBGM) {
    currentBGM.pause();
  }
}

export function resumeBGM(): void {
  if (currentBGM && !currentBGM.playing()) {
    currentBGM.play();
  }
}

export function setBGMVolume(volume: number): void {
  if (currentBGM) {
    currentBGM.volume(Math.max(0, Math.min(1, volume)));
  }
}

export function getCurrentBGM(): string | null {
  return currentBGMName;
}

/**
 * Fade out and stop current BGM
 */
export function fadeOutBGM(duration: number = 1000): Promise<void> {
  return new Promise((resolve) => {
    if (!currentBGM) {
      resolve();
      return;
    }
    const id = currentBGM.playing() ? 0 : null;
    if (id !== null) {
      currentBGM.fade(currentBGM.volume(), 0, duration);
      setTimeout(() => {
        stopBGM();
        resolve();
      }, duration);
    } else {
      resolve();
    }
  });
}
