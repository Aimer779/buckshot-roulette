import { memo } from 'react';
import { Battery, BatteryMedium, BatteryWarning, Heart, Skull } from 'lucide-react';

interface HealthBarProps {
  current: number;
  max: number;
  label: string;
  isDealer?: boolean;
}

/**
 * Reusable Health Bar Component
 * Shows HP as battery/charge icons with color coding:
 * - Full (green): > 50%
 * - Mid (amber): 25-50%
 * - Low (red): < 25%
 * - Dead: 0
 */
const HealthBar = memo(function HealthBar({ current, max, label }: HealthBarProps) {
  const ratio = current / max;
  const isDead = current <= 0;
  const isLow = ratio <= 0.25 && current > 0;
  const isMid = ratio <= 0.5 && ratio > 0.25;

  const getColorClass = () => {
    if (isDead) return 'text-hp-dead';
    if (isLow) return 'text-hp-low animate-hp-pulse';
    if (isMid) return 'text-hp-mid';
    return 'text-hp-full';
  };

  const getIcon = (index: number) => {
    if (index >= current) {
      return <Skull key={index} className="w-6 h-6 text-hp-dead opacity-50" />;
    }

    if (isLow) {
      return <BatteryWarning key={index} className={`w-6 h-6 ${getColorClass()}`} />;
    }
    if (isMid) {
      return <BatteryMedium key={index} className={`w-6 h-6 ${getColorClass()}`} />;
    }
    return <Battery key={index} className={`w-6 h-6 ${getColorClass()}`} />;
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className="font-chinese text-sm font-medium tracking-wider"
        style={{ color: 'var(--text-secondary)' }}
      >
        {label}
      </span>
      <div className="flex items-center gap-1">
        {isDead && (
          <Heart className="w-5 h-5 text-hp-dead" />
        )}
        {Array.from({ length: max }).map((_, i) => (
          <div key={i} className="transition-all duration-300">
            {getIcon(i)}
          </div>
        ))}
      </div>
      <span
        className="font-pixel text-lg tracking-wider"
        style={{ color: isDead ? 'var(--hp-dead)' : isLow ? 'var(--hp-low)' : 'var(--text-primary)' }}
      >
        {current} / {max}
      </span>
    </div>
  );
});

export default HealthBar;
