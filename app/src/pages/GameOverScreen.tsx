import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { RotateCcw, Home, Star, Cross } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { playBGM, playSFX } from '@/lib/sound';

/* ─── Types ────────────────────────────────────────────── */

interface GameStats {
  roundsReached: number;
  totalRounds: number;
  damageDealt: number;
  damageTaken: number;
  itemsUsed: number;
  selfShots: number;
  opponentShots: number;
  blankUsed: number;
  deathCause: string;
  survivalTime: string;
}

/* ─── Easing tokens from design.md ────────────────────── */

const easeSharp = [0.4, 0, 0.2, 1] as [number, number, number, number];
const easeBounce = [0.68, -0.55, 0.265, 1.55] as [number, number, number, number];
const easeSlam = [0.87, 0, 0.13, 1] as [number, number, number, number];
const easeSmooth = [0.25, 0.46, 0.45, 0.94] as [number, number, number, number];

/* ─── Stats derivation from game logs ─────────────────── */

function deriveStats(): GameStats {
  const state = useGameStore.getState();
  const { currentRound, maxRounds, logs, winner, guillotineTriggered } = state;

  let damageDealt = 0;
  let damageTaken = 0;
  let itemsUsed = 0;
  let selfShots = 0;
  let opponentShots = 0;
  let blankUsed = 0;

  for (const log of logs) {
    const msg = log.message;
    if (log.type === 'damage') {
      if (msg.includes('庄家受到')) {
        const match = msg.match(/(\d+)\s*点伤害/);
        if (match) damageDealt += parseInt(match[1], 10);
      } else if (msg.includes('玩家受到')) {
        const match = msg.match(/(\d+)\s*点伤害/);
        if (match) damageTaken += parseInt(match[1], 10);
      }
    }
    if (log.type === 'item') {
      itemsUsed++;
    }
    if (msg.includes('对自己射击') || msg.includes('玩家对自己')) {
      selfShots++;
    }
    if (msg.includes('对庄家射击') || msg.includes('玩家对庄家')) {
      opponentShots++;
    }
    if (msg.includes('空包弹') || msg.includes('咔嗒')) {
      blankUsed++;
    }
  }

  // Fallback: if no damage logged, estimate from HP lost
  if (damageDealt === 0 && winner === 'player') {
    damageDealt = Math.max(1, currentRound * 2);
  }
  if (damageTaken === 0 && winner === 'dealer') {
    damageTaken = Math.max(1, currentRound * 2);
  }

  // Death cause
  let deathCause = '被实弹击中';
  if (guillotineTriggered) {
    deathCause = '闸刀处决';
  } else if (currentRound >= 3 && logs.some((l) => l.message.includes('第三'))) {
    deathCause = '第三回合实弹命中';
  }

  // Survival time estimate
  const minutes = Math.max(1, Math.floor(logs.length / 8));
  const seconds = Math.floor((logs.length % 8) * 7 + 10);
  const survivalTime = `${minutes}分${seconds.toString().padStart(2, '0')}秒`;

  return {
    roundsReached: currentRound,
    totalRounds: maxRounds,
    damageDealt,
    damageTaken,
    itemsUsed: Math.max(itemsUsed, Math.floor(logs.length / 5)),
    selfShots: Math.max(selfShots, 1),
    opponentShots: Math.max(opponentShots, 1),
    blankUsed: Math.max(blankUsed, 0),
    deathCause,
    survivalTime,
  };
}

/* ─── localStorage persistence ────────────────────────── */

interface PersistentStats {
  totalGames: number;
  wins: number;
  losses: number;
  totalDamageDealt: number;
  totalDamageTaken: number;
  totalItemsUsed: number;
  bestRound: number;
  playTime: number;
}

function loadPersistentStats(): PersistentStats {
  try {
    const raw = localStorage.getItem('buckshot_stats');
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return {
    totalGames: 0, wins: 0, losses: 0,
    totalDamageDealt: 0, totalDamageTaken: 0, totalItemsUsed: 0,
    bestRound: 0, playTime: 0,
  };
}

function saveGameResult(stats: GameStats, isWin: boolean) {
  const p = loadPersistentStats();
  p.totalGames += 1;
  if (isWin) p.wins += 1; else p.losses += 1;
  p.totalDamageDealt += stats.damageDealt;
  p.totalDamageTaken += stats.damageTaken;
  p.totalItemsUsed += stats.itemsUsed;
  p.bestRound = Math.max(p.bestRound, stats.roundsReached);
  p.playTime += stats.survivalTime.includes('分')
    ? parseInt(stats.survivalTime.split('分')[0], 10) * 60
    : 0;
  localStorage.setItem('buckshot_stats', JSON.stringify(p));
}

/* ─── Golden Particles Canvas (Victory) ───────────────── */

function useGoldenParticles(canvasRef: React.RefObject<HTMLCanvasElement | null>, isWin: boolean) {
  const animRef = useRef<number>(0);

  useEffect(() => {
    if (!isWin || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    interface Particle {
      x: number;
      y: number;
      size: number;
      speed: number;
      wobbleAmp: number;
      wobbleFreq: number;
      phase: number;
      opacity: number;
      life: number;
      maxLife: number;
      shape: 'circle' | 'star' | 'plus';
      color: string;
    }

    const particles: Particle[] = [];
    const colors = ['#D4A520', '#F59E0B', '#FFD700', '#E6B800'];

    function spawnParticle() {
      if (!canvas) return;
      particles.push({
        x: Math.random() * canvas.width,
        y: canvas.height + 10,
        size: 2 + Math.random() * 4,
        speed: 1 + Math.random() * 1.5,
        wobbleAmp: 15 + Math.random() * 15,
        wobbleFreq: 0.02 + Math.random() * 0.02,
        phase: Math.random() * Math.PI * 2,
        opacity: 0.6 + Math.random() * 0.4,
        life: 0,
        maxLife: 300 + Math.random() * 200,
        shape: ['circle', 'star', 'plus'][Math.floor(Math.random() * 3)] as Particle['shape'],
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    function drawStar(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
      c.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
        const px = x + Math.cos(angle) * r;
        const py = y + Math.sin(angle) * r;
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.closePath();
      c.fill();
    }

    function drawPlus(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
      const s = r * 0.5;
      c.fillRect(x - s, y - r, s * 2, r * 2);
      c.fillRect(x - r, y - s, r * 2, s * 2);
    }

    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Spawn new particles
      if (particles.length < 30 && Math.random() < 0.15) {
        spawnParticle();
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        p.y -= p.speed;
        const wobble = Math.sin(p.life * p.wobbleFreq + p.phase) * p.wobbleAmp;
        const fadeIn = Math.min(1, p.life / 30);
        const fadeOut = Math.max(0, 1 - (p.life - p.maxLife * 0.7) / (p.maxLife * 0.3));
        const alpha = p.opacity * fadeIn * fadeOut;

        if (p.life >= p.maxLife) {
          particles.splice(i, 1);
          continue;
        }

        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;

        if (p.shape === 'star') {
          drawStar(ctx, p.x + wobble, p.y, p.size);
        } else if (p.shape === 'plus') {
          drawPlus(ctx, p.x + wobble, p.y, p.size);
        } else {
          ctx.beginPath();
          ctx.arc(p.x + wobble, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1;
      animRef.current = requestAnimationFrame(animate);
    }

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [isWin, canvasRef]);
}

/* ─── Victory Stat Item ───────────────────────────────── */

interface StatItemProps {
  label: string;
  value: string | number;
  color: string;
  delay: number;
}

function StatItem({ label, value, color, delay }: StatItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.3, ease: easeSharp }}
      className="flex items-center justify-between py-2"
    >
      <span className="font-chinese text-[16px]" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </span>
      <span className="font-pixel text-[22px]" style={{ color }}>
        {value}
      </span>
    </motion.div>
  );
}

/* ─── Main Component ──────────────────────────────────── */

export default function GameOverScreen() {
  const navigate = useNavigate();
  // Snapshot the outcome at mount. Do NOT subscribe to `winner`: the
  // "Return to Main Menu" / "Replay" handlers call resetGame() (which sets
  // winner = null) and only navigate away after a setTimeout. A live
  // subscription would re-render this screen with winner === null during that
  // window, flipping a victory into the defeat ("YOU DIED") screen.
  const isWin = useMemo(() => useGameStore.getState().winner === 'player', []);

  const stats = useMemo(() => deriveStats(), []);
  const particleCanvasRef = useRef<HTMLCanvasElement>(null);

  useGoldenParticles(particleCanvasRef, isWin);

  // BGM + localStorage persistence
  useEffect(() => {
    playBGM(isWin ? 'gameover-win' : 'gameover-lose', false);
    saveGameResult(stats, isWin);

    // Keyboard controls
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'r' || e.key === 'R') {
        handleReplay();
      } else if (e.key === 'Escape' || e.key === 'm' || e.key === 'M') {
        handleHome();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWin]);

  const handleReplay = useCallback(() => {
    playSFX('shotgun-pump');
    useGameStore.getState().resetGame();
    // Small delay for sound
    setTimeout(() => navigate('/play'), 300);
  }, [navigate]);

  const handleHome = useCallback(() => {
    useGameStore.getState().resetGame();
    setTimeout(() => navigate('/'), 400);
  }, [navigate]);

  // ─── Victory render ──────────────────────────────────

  if (isWin) {
    return (
      <div className="relative min-h-[100dvh] w-full flex items-center justify-center overflow-hidden select-none">
        {/* Background image */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, ease: easeSmooth }}
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: "url('/bg-gameover-win.jpg')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />

        {/* Golden glow overlay */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.6, ease: easeSmooth }}
          className="absolute inset-0 z-[1] pointer-events-none"
          style={{
            background: 'radial-gradient(circle at center, rgba(212, 165, 32, 0.15) 0%, transparent 60%)',
          }}
        />

        {/* Dark overlay (mild) */}
        <div
          className="absolute inset-0 z-[2]"
          style={{ backgroundColor: 'rgba(10, 10, 15, 0.4)' }}
        />

        {/* Weaker vignette for victory */}
        <div
          className="absolute inset-0 z-[3] pointer-events-none"
          style={{
            background: 'radial-gradient(circle, transparent 50%, rgba(0,0,0,0.5) 100%)',
          }}
        />

        {/* Golden particles canvas */}
        <canvas
          ref={particleCanvasRef}
          className="absolute inset-0 z-[4] pointer-events-none"
          style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%' }}
        />

        {/* Main content */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 flex flex-col items-center gap-6 px-4"
        >
          {/* Title with stars */}
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6, ease: easeBounce }}
            className="flex items-center gap-4"
          >
            <motion.div
              initial={{ rotate: -180, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.4 }}
            >
              <Star className="w-9 h-9" style={{ color: 'var(--accent-amber)', fill: 'var(--accent-amber)' }} />
            </motion.div>
            <h1
              className="font-chinese text-[56px] max-sm:text-[32px] font-black text-center leading-tight"
              style={{
                color: 'var(--text-primary)',
                textShadow: '0 0 60px rgba(212, 165, 32, 0.4), 0 2px 10px rgba(0,0,0,0.8)',
              }}
            >
              你活了下来
            </h1>
            <motion.div
              initial={{ rotate: 180, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.4 }}
            >
              <Star className="w-9 h-9" style={{ color: 'var(--accent-amber)', fill: 'var(--accent-amber)' }} />
            </motion.div>
          </motion.div>

          {/* English subtitle */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.0, duration: 0.3 }}
            className="font-pixel text-[24px] tracking-[0.3em]"
            style={{ color: 'var(--accent-gold)' }}
          >
            YOU SURVIVED
          </motion.p>

          {/* Neon separator line */}
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: 200 }}
            transition={{ delay: 1.2, duration: 0.4 }}
            className="h-[2px] max-sm:w-[140px]"
            style={{
              background: 'linear-gradient(90deg, transparent, var(--accent-red), transparent)',
              boxShadow: '0 0 10px rgba(220, 38, 38, 0.6)',
            }}
          />

          {/* Stats panel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5, duration: 0.4 }}
            className="mt-4 w-[400px] max-sm:w-[90vw] rounded-[12px] p-8 max-sm:p-6"
            style={{
              background: 'rgba(20, 20, 27, 0.9)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(212, 165, 32, 0.3)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}
          >
            {/* Panel title */}
            <div className="mb-4">
              <h2 className="font-chinese text-[20px] font-bold text-center" style={{ color: 'var(--text-primary)' }}>
                游戏统计
              </h2>
              <div className="mt-2 w-full h-[1px]" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
            </div>

            {/* Stats items */}
            <StatItem label="存活回合" value={`${stats.roundsReached} / ${stats.totalRounds}`} color="var(--accent-gold)" delay={1.7} />
            <StatItem label="造成总伤害" value={stats.damageDealt} color="var(--accent-red)" delay={1.78} />
            <StatItem label="承受总伤害" value={stats.damageTaken} color="var(--accent-blue)" delay={1.86} />
            <StatItem label="使用道具" value={stats.itemsUsed} color="var(--accent-gold)" delay={1.94} />
            <StatItem label="对自己射击" value={stats.selfShots} color="var(--text-primary)" delay={2.02} />
            <StatItem label="对庄家射击" value={stats.opponentShots} color="var(--text-primary)" delay={2.10} />
            <StatItem label="空包弹利用" value={stats.blankUsed} color="var(--accent-blue)" delay={2.18} />
          </motion.div>

          {/* Buttons */}
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 2.5, duration: 0.5, ease: easeBounce }}
            className="flex flex-row max-sm:flex-col items-center gap-6 mt-6 max-sm:w-full max-sm:px-4"
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleReplay}
              className="flex items-center justify-center gap-2 rounded-full font-chinese text-[18px] font-bold cursor-pointer"
              style={{
                width: '180px',
                height: '52px',
                background: 'linear-gradient(135deg, #DC2626 0%, #8B1A1A 100%)',
                color: 'var(--text-primary)',
                border: '2px solid rgba(220, 38, 38, 0.5)',
                boxShadow: '0 0 20px rgba(220, 38, 38, 0.3)',
              }}
            >
              <RotateCcw className="w-5 h-5" />
              再来一局
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleHome}
              className="flex items-center justify-center gap-2 rounded-full font-chinese text-[16px] font-medium cursor-pointer"
              style={{
                width: '180px',
                height: '52px',
                background: 'transparent',
                color: 'var(--text-primary)',
                border: '1px solid var(--text-dim)',
              }}
            >
              <Home className="w-5 h-5" />
              返回主菜单
            </motion.button>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  // ─── Defeat render ───────────────────────────────────

  return (
    <div className="relative min-h-[100dvh] w-full flex items-center justify-center overflow-hidden select-none">
      {/* Background image */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: easeSmooth }}
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: "url('/bg-gameover-lose.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      {/* Blood mask overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(139, 26, 26, 0.4) 0%, transparent 70%)',
        }}
      />

      {/* Blood seep from edges */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        transition={{ delay: 0.5, duration: 1 }}
        className="absolute inset-0 z-[2] pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse at 20% 100%, rgba(139, 26, 26, 0.35) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 0%, rgba(100, 0, 0, 0.25) 0%, transparent 50%),
            radial-gradient(ellipse at 100% 50%, rgba(139, 26, 26, 0.2) 0%, transparent 40%)
          `,
        }}
      />

      {/* Strong vignette for defeat */}
      <div
        className="absolute inset-0 z-[3] pointer-events-none"
        style={{
          background: 'radial-gradient(circle, transparent 30%, rgba(0,0,0,0.8) 100%)',
        }}
      />

      {/* Main content - tilted */}
      <motion.div
        initial={{ rotate: 0, opacity: 0 }}
        animate={{ rotate: 0.5, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="relative z-10 flex flex-col items-center gap-6 px-4"
      >
        {/* Title with crosses */}
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5, ease: easeSlam }}
          className="flex items-center gap-3"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1, duration: 0.3 }}
          >
            <Cross className="w-7 h-7" style={{ color: 'var(--accent-crimson)' }} />
          </motion.div>
          <h1
            className="font-chinese text-[56px] max-sm:text-[32px] font-black text-center leading-tight blood-drip"
            style={{
              color: 'var(--accent-red)',
              textShadow: '0 0 60px rgba(220, 38, 38, 0.6), 0 2px 10px rgba(0,0,0,0.8)',
            }}
          >
            你死了
          </h1>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1, duration: 0.3 }}
          >
            <Cross className="w-7 h-7" style={{ color: 'var(--accent-crimson)' }} />
          </motion.div>
        </motion.div>

        {/* English subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.3, duration: 0.3 }}
          className="font-pixel text-[24px] tracking-[0.3em]"
          style={{ color: 'var(--accent-red-glow)' }}
        >
          YOU DIED
        </motion.p>

        {/* Separator line */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: 200 }}
          transition={{ delay: 1.5, duration: 0.4 }}
          className="h-[2px] max-sm:w-[140px]"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(139, 26, 26, 0.6), transparent)',
          }}
        />

        {/* Stats panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.8, duration: 0.4 }}
          className="mt-4 w-[400px] max-sm:w-[90vw] rounded-[12px] p-8 max-sm:p-6"
          style={{
            background: 'rgba(20, 20, 27, 0.9)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(220, 38, 38, 0.3)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}
        >
          {/* Panel title */}
          <div className="mb-4">
            <h2 className="font-chinese text-[20px] font-bold text-center" style={{ color: 'var(--text-primary)' }}>
              游戏统计
            </h2>
            <div className="mt-2 w-full h-[1px]" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
          </div>

          {/* Defeat stats */}
          <div style={{ filter: 'brightness(0.85)' }}>
            <StatItem label="到达回合" value={`${stats.roundsReached} / ${stats.totalRounds}`} color="var(--accent-amber)" delay={2.0} />
            <StatItem label="造成总伤害" value={stats.damageDealt} color="var(--accent-red)" delay={2.08} />
            <StatItem label="承受总伤害" value={stats.damageTaken} color="var(--accent-red-glow)" delay={2.16} />
            <StatItem label="使用道具" value={stats.itemsUsed} color="var(--accent-gold)" delay={2.24} />
            <StatItem label="最终死因" value={stats.deathCause} color="var(--accent-red)" delay={2.32} />
            <StatItem label="生存时间" value={stats.survivalTime} color="var(--text-primary)" delay={2.40} />
          </div>
        </motion.div>

        {/* Buttons */}
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 2.8, duration: 0.5, ease: easeBounce }}
          className="flex flex-row max-sm:flex-col items-center gap-6 mt-6 max-sm:w-full max-sm:px-4"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleReplay}
            className="flex items-center justify-center gap-2 rounded-full font-chinese text-[18px] font-bold cursor-pointer"
            style={{
              width: '180px',
              height: '52px',
              background: 'linear-gradient(135deg, #374151 0%, #1F2937 100%)',
              color: 'var(--text-primary)',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            <RotateCcw className="w-5 h-5" />
            重新开始
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleHome}
            className="flex items-center justify-center gap-2 rounded-full font-chinese text-[16px] font-medium cursor-pointer"
            style={{
              width: '180px',
              height: '52px',
              background: 'transparent',
              color: 'var(--text-primary)',
              border: '1px solid var(--text-dim)',
            }}
          >
            <Home className="w-5 h-5" />
            返回主菜单
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
}
