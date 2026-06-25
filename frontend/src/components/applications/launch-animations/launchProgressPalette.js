/**
 * Color tokens for launch progress indicators.
 * Dark surfaces use white-on-dark; light glass panels use theme foreground tokens.
 */
export function getLaunchProgressPalette(surface = 'dark') {
  if (surface === 'light') {
    return {
      text: 'text-foreground',
      textMuted: 'text-muted-foreground',
      textLarge: 'text-foreground',
      fill: 'bg-foreground',
      track: 'bg-foreground/10',
      trackBorder: 'border-foreground/15',
      spinnerBorder: 'border-foreground/15 border-t-foreground',
      ringTrackStroke: 'hsl(var(--foreground) / 0.12)',
      ringFillStroke: 'hsl(var(--foreground))',
      dotShadow: 'shadow-[0_0_10px_hsl(var(--foreground)/0.25)]',
      segmentActive: 'hsl(var(--foreground) / 0.85)',
      segmentInactive: 'hsl(var(--foreground) / 0.12)',
      ladderInactive: 'hsl(var(--foreground) / 0.15)',
      barFill: 'bg-foreground/80',
      barFillSolid: 'bg-foreground',
      barGradient: 'from-foreground/60 via-foreground to-foreground/70',
      waveGradient: 'from-foreground/50 to-foreground/80',
      stripeGradient:
        'repeating-linear-gradient(-45deg, hsl(var(--foreground)), hsl(var(--foreground)) 6px, hsl(var(--foreground) / 0.35) 6px, hsl(var(--foreground) / 0.35) 12px)',
      scanShine: 'via-foreground/30',
      hexInactive: 'hsl(var(--foreground) / 0.08)',
      holoInactive: 'hsl(var(--foreground) / 0.06)',
      pixelBorder: 'border-foreground/20',
      pixelInactive: 'hsl(var(--foreground) / 0.08)',
      glitchScreen: 'bg-foreground/40',
      prismTrack: 'bg-foreground/10',
      defaultBarGradient: 'from-foreground/70 via-foreground to-foreground/70',
      accentSoft: 'text-foreground/80',
      accentCyan: 'text-cyan-700 dark:text-cyan-100',
      accentEmerald: 'text-emerald-700 dark:text-emerald-100',
    };
  }

  return {
    text: 'text-white',
    textMuted: 'text-white/50',
    textLarge: 'text-white',
    fill: 'bg-white',
    track: 'bg-white/10',
    trackBorder: 'border-white/15',
    spinnerBorder: 'border-white/15 border-t-white',
    ringTrackStroke: 'rgba(255,255,255,0.15)',
    ringFillStroke: 'white',
    dotShadow: 'shadow-[0_0_10px_rgba(255,255,255,0.8)]',
    segmentActive: 'rgba(255,255,255,0.95)',
    segmentInactive: 'rgba(255,255,255,0.12)',
    ladderInactive: 'rgba(255,255,255,0.15)',
    barFill: 'bg-white',
    barFillSolid: 'bg-white',
    barGradient: 'from-white/70 via-white to-white/70',
    waveGradient: 'from-cyan-200/90 to-white',
    stripeGradient:
      'repeating-linear-gradient(-45deg, #fff, #fff 6px, rgba(255,255,255,0.35) 6px, rgba(255,255,255,0.35) 12px)',
    scanShine: 'via-white/50',
    hexInactive: 'rgba(255,255,255,0.08)',
    holoInactive: 'rgba(255,255,255,0.06)',
    pixelBorder: 'border-white/20',
    pixelInactive: 'rgba(255,255,255,0.08)',
    glitchScreen: 'bg-sky-400/60 mix-blend-screen',
    prismTrack: 'bg-white/10',
    defaultBarGradient: 'from-white/70 via-white to-white/70',
    accentSoft: 'text-white/45',
    accentCyan: 'text-cyan-100',
    accentEmerald: 'text-emerald-100',
  };
}
