import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, X, Settings, HelpCircle, Play } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { playSFX, playBGM } from '@/lib/sound';

// ─── Dust Particle Component ─────────────────────────────

const DustParticles = memo(function DustParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const c = canvas;
    const x = ctx;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    interface Particle {
      x: number;
      y: number;
      size: number;
      speedY: number;
      speedX: number;
      opacity: number;
      life: number;
      maxLife: number;
    }

    const particles: Particle[] = [];
    const PARTICLE_COUNT = 18;

    function spawnParticle(): Particle {
      return {
        x: Math.random() * c.width,
        y: c.height + 10,
        size: 1 + Math.random() * 2,
        speedY: -(0.3 + Math.random() * 0.5),
        speedX: (Math.random() - 0.5) * 0.3,
        opacity: 0.2 + Math.random() * 0.4,
        life: 0,
        maxLife: 600 + Math.random() * 300,
      };
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = spawnParticle();
      p.y = Math.random() * c.height;
      particles.push(p);
    }

    let animId: number;
    function animate() {
      x.clearRect(0, 0, c.width, c.height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.life++;
        p.y += p.speedY;
        p.x += p.speedX + Math.sin(p.life * 0.01) * 0.2;

        const lifeRatio = p.life / p.maxLife;
        const fadeIn = Math.min(1, p.life / 60);
        const fadeOut = lifeRatio > 0.8 ? 1 - (lifeRatio - 0.8) / 0.2 : 1;
        const alpha = p.opacity * fadeIn * fadeOut;

        x.beginPath();
        x.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        x.fillStyle = `rgba(150, 150, 160, ${alpha})`;
        x.fill();

        if (p.life >= p.maxLife || p.y < -10) {
          particles[i] = spawnParticle();
        }
      }

      animId = requestAnimationFrame(animate);
    }

    animate();

    const handleResize = () => {
      c.width = window.innerWidth;
      c.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-[5]"
    />
  );
});

// ─── Settings Panel ──────────────────────────────────────

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { soundEnabled, setSoundEnabled, crtEnabled, setCrtEnabled, musicVolume, setMusicVolume, sfxVolume, setSfxVolume } = useGameStore();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
            className="fixed right-0 top-0 h-full w-80 z-[201] border-l-2 flex flex-col p-6 gap-6"
            style={{
              backgroundColor: 'var(--bg-dark)',
              borderColor: 'var(--bg-elevated)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-chinese text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                设置
              </h2>
              <button
                onClick={onClose}
                className="p-2 rounded-lg transition-colors hover:bg-white/5"
              >
                <X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>

            <div className="w-full h-px" style={{ backgroundColor: 'var(--bg-elevated)' }} />

            {/* Sound toggle */}
            <div className="flex items-center justify-between">
              <span className="font-chinese text-base" style={{ color: 'var(--text-primary)' }}>
                音效
              </span>
              <button
                onClick={() => {
                  setSoundEnabled(!soundEnabled);
                  playSFX('shotgun-click', 0.3);
                }}
                className="p-2 rounded-lg transition-colors hover:bg-white/5"
              >
                {soundEnabled ? (
                  <Volume2 className="w-5 h-5" style={{ color: 'var(--accent-red)' }} />
                ) : (
                  <VolumeX className="w-5 h-5" style={{ color: 'var(--text-dim)' }} />
                )}
              </button>
            </div>

            {/* CRT toggle */}
            <div className="flex items-center justify-between">
              <span className="font-chinese text-base" style={{ color: 'var(--text-primary)' }}>
                CRT 扫描线效果
              </span>
              <button
                onClick={() => {
                  setCrtEnabled(!crtEnabled);
                  playSFX('shotgun-click', 0.3);
                }}
                className={`
                  relative w-12 h-6 rounded-full transition-colors duration-200
                  ${crtEnabled ? 'bg-accent-red' : 'bg-bg-elevated'}
                `}
              >
                <div
                  className={`
                    absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200
                    ${crtEnabled ? 'translate-x-6' : 'translate-x-0.5'}
                  `}
                />
              </button>
            </div>

            {/* Music volume */}
            <div className="flex flex-col gap-2">
              <span className="font-chinese text-base" style={{ color: 'var(--text-primary)' }}>
                音乐音量
              </span>
              <input
                type="range"
                min="0"
                max="100"
                value={musicVolume * 100}
                onChange={(e) => setMusicVolume(Number(e.target.value) / 100)}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{ backgroundColor: 'var(--bg-elevated)' }}
              />
            </div>

            {/* SFX volume */}
            <div className="flex flex-col gap-2">
              <span className="font-chinese text-base" style={{ color: 'var(--text-primary)' }}>
                音效音量
              </span>
              <input
                type="range"
                min="0"
                max="100"
                value={sfxVolume * 100}
                onChange={(e) => setSfxVolume(Number(e.target.value) / 100)}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{ backgroundColor: 'var(--bg-elevated)' }}
              />
            </div>

            <div className="mt-auto">
              <button
                onClick={onClose}
                className="btn-secondary w-full"
              >
                关闭
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Title Screen ────────────────────────────────────────

export default function TitleScreen() {
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [entered, setEntered] = useState(false);

  // Start BGM on mount
  useEffect(() => {
    playBGM('title');
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (settingsOpen) {
        if (e.key === 'Escape') {
          setSettingsOpen(false);
        }
        return;
      }

      if (e.key === 'Enter' || e.key === ' ') {
        playSFX('shotgun-pump');
        navigate('/tutorial');
      } else if (e.key === 'h' || e.key === 'H') {
        navigate('/tutorial');
      } else if (e.key === 's' || e.key === 'S') {
        setSettingsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, settingsOpen]);

  const handleStartGame = useCallback(() => {
    playSFX('shotgun-pump');
    navigate('/tutorial');
  }, [navigate]);

  const handleTutorial = useCallback(() => {
    playSFX('shotgun-click', 0.5);
    navigate('/tutorial');
  }, [navigate]);

  const handleSettings = useCallback(() => {
    playSFX('shotgun-click', 0.5);
    setSettingsOpen(true);
  }, []);

  // Entry sequence
  useEffect(() => {
    const timer = setTimeout(() => setEntered(true), 300);
    return () => clearTimeout(timer);
  }, []);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
    },
  };

  const titleVariants = {
    hidden: { y: 40, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.5,
        ease: [0.68, -0.55, 0.265, 1.55] as [number, number, number, number],
      },
    },
  };

  const subtitleVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.4, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
    },
  };

  const buttonVariants = {
    hidden: { x: -30, opacity: 0 },
    visible: (i: number) => ({
      x: 0,
      opacity: 1,
      transition: {
        duration: 0.4,
        delay: 0.6 + i * 0.2,
        ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
      },
    }),
  };

  const lineVariants = {
    hidden: { scaleX: 0 },
    visible: {
      scaleX: 1,
      transition: { duration: 0.6, delay: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate={entered ? 'visible' : 'hidden'}
      className="relative min-h-[100dvh] w-full flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Background image with breathing scale */}
      <div
        className="absolute inset-0 z-0 animate-[pulse-glow_20s_ease-in-out_infinite]"
        style={{
          backgroundImage: 'url(/bg-title.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          transform: 'scale(1.02)',
        }}
      />

      {/* Dark overlay for readability */}
      <div
        className="absolute inset-0 z-[1]"
        style={{ backgroundColor: 'rgba(10, 10, 15, 0.4)' }}
      />

      {/* Dust particles */}
      <DustParticles />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Neon line top */}
        <motion.div
          variants={lineVariants}
          initial="hidden"
          animate={entered ? 'visible' : 'hidden'}
          className="w-[60%] max-w-[500px] h-[2px]"
          style={{
            background: 'linear-gradient(90deg, transparent, var(--accent-red), transparent)',
            boxShadow: '0 0 8px var(--neon-red)',
          }}
        />

        {/* Chinese title */}
        <motion.h1
          variants={titleVariants}
          initial="hidden"
          animate={entered ? 'visible' : 'hidden'}
          className="font-chinese font-black text-center select-none"
          style={{
            fontSize: 'clamp(36px, 8vw, 64px)',
            letterSpacing: '0.15em',
            color: 'var(--text-primary)',
            textShadow: '0 0 40px rgba(220, 38, 38, 0.5), 0 2px 4px rgba(0,0,0,0.8)',
          }}
        >
          恶魔轮盘
        </motion.h1>

        {/* English subtitle */}
        <motion.p
          variants={subtitleVariants}
          initial="hidden"
          animate={entered ? 'visible' : 'hidden'}
          className="font-pixel text-center tracking-[0.2em] animate-neon-flicker"
          style={{
            fontSize: 'clamp(18px, 3vw, 32px)',
            color: 'var(--accent-red-glow)',
            textShadow: '0 0 10px var(--accent-red), 0 0 20px var(--accent-red), 0 0 40px var(--accent-red-glow)',
          }}
        >
          BUCKSHOT ROULETTE
        </motion.p>

        {/* Neon line bottom */}
        <motion.div
          variants={lineVariants}
          initial="hidden"
          animate={entered ? 'visible' : 'hidden'}
          className="w-[60%] max-w-[500px] h-[2px]"
          style={{
            background: 'linear-gradient(90deg, transparent, var(--accent-red), transparent)',
            boxShadow: '0 0 8px var(--neon-red)',
          }}
        />

        {/* Button group */}
        <div className="flex flex-col items-center gap-4 mt-4">
          {/* Start Game */}
          <motion.button
            custom={0}
            variants={buttonVariants}
            initial="hidden"
            animate={entered ? 'visible' : 'hidden'}
            onClick={handleStartGame}
            onMouseEnter={() => playSFX('metal-clank', 0.15)}
            className="btn-primary light-sweep gap-2"
          >
            <Play className="w-5 h-5" />
            开始游戏
          </motion.button>

          {/* Tutorial */}
          <motion.button
            custom={1}
            variants={buttonVariants}
            initial="hidden"
            animate={entered ? 'visible' : 'hidden'}
            onClick={handleTutorial}
            onMouseEnter={() => playSFX('metal-clank', 0.15)}
            className="btn-secondary gap-2"
          >
            <HelpCircle className="w-5 h-5" />
            游戏说明
          </motion.button>

          {/* Settings */}
          <motion.button
            custom={2}
            variants={buttonVariants}
            initial="hidden"
            animate={entered ? 'visible' : 'hidden'}
            onClick={handleSettings}
            onMouseEnter={() => playSFX('metal-clank', 0.15)}
            className="btn-secondary gap-2"
          >
            <Settings className="w-5 h-5" />
            设置
          </motion.button>
        </div>

        {/* Bottom hint text */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 0.5 }}
          className="font-chinese text-sm animate-breathe mt-4"
          style={{ color: 'var(--text-dim)' }}
        >
          按 Enter 开始游戏...
        </motion.p>
      </div>

      {/* Version info */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.5, duration: 0.5 }}
        className="absolute bottom-4 right-4 font-pixel text-xs z-10"
        style={{ color: 'var(--text-dim)' }}
      >
        v1.0 | 1998 Nightclub Edition
      </motion.p>

      {/* Settings Panel */}
      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </motion.div>
  );
}
