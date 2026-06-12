import { cn } from '@/lib/utils';

const SIZE_CONFIG = {
  default: {
    wrap: '-left-7 top-[11px] w-[88px]',
    text: 'py-[3px] text-[8px] tracking-[0.14em]',
    fold: 'size-3.5',
    foldHighlight: 'size-2',
  },
  sm: {
    wrap: '-left-5 top-[7px] w-[56px]',
    text: 'py-[2px] text-[6px] tracking-[0.1em]',
    fold: 'size-2.5',
    foldHighlight: 'size-1.5',
  },
};

export default function CornerRibbon({ label, ribbonClassName, size = 'default' }) {
  const sizeConfig = SIZE_CONFIG[size] ?? SIZE_CONFIG.default;

  return (
    <div className="pointer-events-none absolute inset-0 z-[3] overflow-hidden">
      <div className={cn('absolute origin-center -rotate-45', sizeConfig.wrap)}>
        <div
          className={cn(
            'relative text-center font-bold uppercase text-white',
            'shadow-[0_2px_8px_rgba(0,0,0,0.32)] ring-1 ring-inset ring-white/20',
            sizeConfig.text,
            ribbonClassName
          )}
        >
          <span className="relative z-[1] drop-shadow-sm">{label}</span>
          <span aria-hidden className="absolute inset-x-0 top-0 h-1/2 bg-white/15" />
        </div>
      </div>
      <span
        aria-hidden
        className={cn('absolute left-0 top-0 bg-black/25', sizeConfig.fold)}
        style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
      />
      <span
        aria-hidden
        className={cn('absolute left-0 top-0 bg-white/10', sizeConfig.foldHighlight)}
        style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
      />
    </div>
  );
}
