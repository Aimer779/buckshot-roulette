import { writeFileSync } from 'node:fs';

// Original two-note cue: no third-party recording or runtime synthesis required.
const rate = 22050;
const samples = Math.floor(rate * 0.36);
const wave = Buffer.alloc(44 + samples * 2);
wave.write('RIFF', 0); wave.writeUInt32LE(wave.length - 8, 4); wave.write('WAVEfmt ', 8);
wave.writeUInt32LE(16, 16); wave.writeUInt16LE(1, 20); wave.writeUInt16LE(1, 22);
wave.writeUInt32LE(rate, 24); wave.writeUInt32LE(rate * 2, 28);
wave.writeUInt16LE(2, 32); wave.writeUInt16LE(16, 34);
wave.write('data', 36); wave.writeUInt32LE(samples * 2, 40);
for (let i = 0; i < samples; i++) {
  const time = i / rate;
  const noteTime = time < 0.18 ? time : time - 0.18;
  const frequency = time < 0.18 ? 660 : 880;
  const envelope = Math.min(1, noteTime / 0.008) * Math.max(0, 1 - noteTime / 0.17) ** 2;
  wave.writeInt16LE(Math.round(Math.sin(2 * Math.PI * frequency * noteTime) * envelope * 8000), 44 + i * 2);
}
writeFileSync(new URL('../public/sfx-turn-ready.wav', import.meta.url), wave);
