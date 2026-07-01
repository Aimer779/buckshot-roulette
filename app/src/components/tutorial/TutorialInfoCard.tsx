import { cn } from '@/lib/utils';

interface TutorialInfoCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Rounded bordered surface card used for repeated tutorial content blocks.
 * Defaults to the standard surface background and elevated border; callers
 * can override via `className` and `style`.
 */
export default function TutorialInfoCard({ children, className, style }: TutorialInfoCardProps) {
  return (
    <div
      className={cn('rounded-lg border', className)}
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--bg-elevated)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
