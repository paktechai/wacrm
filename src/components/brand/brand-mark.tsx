import { cn } from '@/lib/utils';

interface BrandMarkProps {
  className?: string;
  compact?: boolean;
  inverted?: boolean;
}

export function BrandMark({
  className,
  compact = false,
  inverted = false,
}: BrandMarkProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        aria-hidden
        className={cn(
          'grid shrink-0 place-items-center rounded-[0.7rem] bg-gradient-to-br from-emerald-400 via-primary to-emerald-700 shadow-sm shadow-primary/20',
          compact ? 'size-8' : 'size-10'
        )}
      >
        <svg
          viewBox="0 0 32 32"
          fill="none"
          className={compact ? 'size-5' : 'size-6'}
        >
          <path
            d="M5.5 8.5 10.2 23l5.8-9 5.8 9 4.7-14.5"
            stroke="white"
            strokeWidth="3.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span
        className={cn(
          'font-black tracking-[-0.045em]',
          compact ? 'text-base' : 'text-lg',
          inverted ? 'text-white' : 'text-foreground'
        )}
      >
        Wova<span className="text-primary">8</span>
      </span>
    </span>
  );
}
