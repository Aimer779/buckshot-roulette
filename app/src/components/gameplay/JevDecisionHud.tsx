import type { JevHud } from '@/lib/dealerStrategies';
import { ACTION_LABELS, LIVE_BELIEF_LEVELS } from '@/lib/dealerStrategies/jev/types';

interface JevDecisionHudProps {
  hud: JevHud;
}

function bar(probability: number) {
  const pct = Math.round(Math.max(0, Math.min(1, probability)) * 100);
  return pct;
}

/**
 * Compact Jev probability readout under the dealer. Only mounted in Jev mode.
 */
export default function JevDecisionHud({ hud }: JevDecisionHudProps) {
  const ranked = Object.entries(hud.probabilities).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const belief = Math.max(0, Math.min(LIVE_BELIEF_LEVELS.length - 1, Math.round(hud.liveBelief)));
  const beliefLabel = LIVE_BELIEF_LEVELS[belief] ?? LIVE_BELIEF_LEVELS[2];
  const actionLabel = ACTION_LABELS[hud.action] ?? hud.action;

  return (
    <div
      className="w-full max-w-sm rounded border px-3 py-2 text-left"
      style={{
        borderColor: 'rgba(212, 165, 32, 0.35)',
        backgroundColor: 'rgba(10, 10, 15, 0.72)',
      }}
    >
      <div className="flex items-baseline justify-between gap-2 font-chinese text-xs">
        <span style={{ color: 'var(--accent-gold)' }}>
          {hud.fallback ? 'Jev 回退均衡型' : `Jev · ${actionLabel}`}
        </span>
        <span style={{ color: 'var(--text-dim)' }}>
          {hud.fallback ? hud.reason ?? 'fallback' : `${hud.latencyMs}ms · ${hud.confidence.toFixed(2)}`}
        </span>
      </div>
      {ranked.length > 0 && (
        <ul className="mt-1.5 space-y-1">
          {ranked.map(([action, probability]) => (
            <li key={action} className="flex items-center gap-2">
              <span
                className="w-16 shrink-0 truncate font-chinese text-[10px]"
                style={{ color: 'var(--text-secondary)' }}
              >
                {ACTION_LABELS[action] ?? action}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${bar(probability)}%`,
                    backgroundColor: action === hud.action && !hud.fallback ? 'var(--accent-gold)' : 'var(--text-dim)',
                  }}
                />
              </div>
              <span className="w-8 text-right font-chinese text-[10px]" style={{ color: 'var(--text-dim)' }}>
                {bar(probability)}%
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1.5 font-chinese text-[10px]" style={{ color: 'var(--text-dim)' }}>
        膛内信念 {hud.liveBelief.toFixed(1)} · {beliefLabel}
      </p>
    </div>
  );
}
