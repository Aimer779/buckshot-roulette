import type { JevHud } from '@/lib/dealerStrategies';
import { ACTION_LABELS, NOUL_LABELS } from '@/lib/dealerStrategies/jev/types';

interface JevDecisionHudProps {
  hud: JevHud;
}

function bar(probability: number) {
  return Math.round(Math.max(0, Math.min(1, probability)) * 100);
}

/**
 * Compact Jev readout under the dealer. Shows composed action and atomic Nouls.
 */
export default function JevDecisionHud({ hud }: JevDecisionHudProps) {
  const noulEntries = Object.entries(hud.nouls ?? hud.probabilities).sort((a, b) => b[1] - a[1]);
  const actionLabel = ACTION_LABELS[hud.action] ?? hud.action;
  const title =
    hud.ruleFired === 'forced'
      ? `规则层 · ${actionLabel}`
      : hud.fallback
        ? 'Jev 回退均衡型'
        : `Jev · ${actionLabel}`;

  return (
    <div
      className="w-full max-w-sm rounded border px-3 py-2 text-left"
      style={{
        borderColor: 'rgba(212, 165, 32, 0.35)',
        backgroundColor: 'rgba(10, 10, 15, 0.72)',
      }}
    >
      <div className="flex items-baseline justify-between gap-2 font-chinese text-xs">
        <span style={{ color: 'var(--accent-gold)' }}>{title}</span>
        <span style={{ color: 'var(--text-dim)' }}>
          {hud.fallback ? hud.reason ?? 'fallback' : `${hud.latencyMs}ms · ${hud.liveBelief.toFixed(2)}`}
        </span>
      </div>
      {noulEntries.length > 0 && (
        <ul className="mt-1.5 space-y-1">
          {noulEntries.map(([key, probability]) => (
            <li key={key} className="flex items-center gap-2">
              <span
                className="w-16 shrink-0 truncate font-chinese text-[10px]"
                style={{ color: 'var(--text-secondary)' }}
              >
                {NOUL_LABELS[key] ?? ACTION_LABELS[key] ?? key}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${bar(probability)}%`,
                    backgroundColor: 'var(--accent-gold)',
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
    </div>
  );
}
