import { cn } from '@/lib/utils';

interface TutorialSectionTitleProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Repeated page heading with the red neon underline.
 */
export default function TutorialSectionTitle({ children, className }: TutorialSectionTitleProps) {
  return (
    <div className={cn('text-center', className)}>
      <h2
        className="font-chinese text-2xl sm:text-[22px] font-bold mb-2"
        style={{ color: 'var(--accent-red)' }}
      >
        {children}
      </h2>
      <div
        className="mx-auto"
        style={{
          width: '120px',
          height: '2px',
          backgroundColor: 'var(--accent-red)',
          boxShadow: '0 0 8px var(--accent-red)',
        }}
      />
    </div>
  );
}
