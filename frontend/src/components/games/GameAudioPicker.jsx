// @ts-nocheck
import React from 'react';
import { Headphones, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
	BGM_THEMES, SFX_PACKS, previewBgmTheme, previewSfxPack, unlockAudio,
} from '@/lib/gameAudio';

/**
 * @param {'theme'|'stage'} surface
 * theme = Games/builder pages (follow app light/dark tokens)
 * stage = inside purple GameStage panels (high-contrast on light or dark stage cards)
 */
export default function GameAudioPicker({
	bgmTheme = 'party',
	sfxPack = 'classic',
	onBgmChange,
	onSfxChange,
	compact = false,
	surface = 'theme',
	className,
}) {
	const onStage = surface === 'stage';

	const sectionLabel = cn(
		'flex items-center gap-2 mb-2 text-sm font-semibold',
		onStage
			? 'text-slate-800 dark:text-slate-100'
			: 'text-foreground',
	);

	const chipBase = onStage
		? cn(
			'rounded-xl border p-3 text-left transition-colors',
			'bg-slate-100 border-slate-200 text-slate-900',
			'dark:bg-slate-800 dark:border-slate-600 dark:text-slate-50',
			'hover:bg-slate-200/80 dark:hover:bg-slate-700',
		)
		: cn(
			'rounded-xl border p-3 text-left transition-colors',
			'bg-muted/40 border-border text-foreground',
			'hover:bg-muted/70',
		);

	const chipSelected = onStage
		? 'border-violet-500 bg-violet-50 ring-1 ring-violet-400/40 dark:border-violet-400 dark:bg-violet-500/20 dark:ring-violet-400/30'
		: 'border-primary/50 bg-primary/10 ring-1 ring-primary/20';

	const titleCls = onStage
		? 'text-sm font-semibold text-slate-900 dark:text-slate-50'
		: 'text-sm font-medium text-foreground';

	const hintCls = onStage
		? 'text-[11px] mt-0.5 text-slate-500 dark:text-slate-400'
		: 'text-[11px] mt-0.5 text-muted-foreground';

	const linkCls = onStage
		? 'text-[10px] font-semibold text-violet-700 hover:underline dark:text-violet-300'
		: 'text-[10px] font-medium text-primary hover:underline';

	const iconCls = onStage
		? 'h-4 w-4 text-violet-600 dark:text-violet-300'
		: 'h-4 w-4 text-primary';

	return (
		<div className={cn('space-y-4', className)}>
			<div>
				<div className={sectionLabel}>
					<Headphones className={iconCls} />
					Background music
				</div>
				<div className={cn('grid gap-2', compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4')}>
					{BGM_THEMES.map((theme) => {
						const selected = bgmTheme === theme.id;
						return (
							<button
								key={theme.id}
								type="button"
								onClick={async () => {
									await unlockAudio();
									onBgmChange?.(theme.id);
									previewBgmTheme(theme.id, 'lobby');
								}}
								className={cn(chipBase, selected && chipSelected)}
							>
								<div className="text-base leading-none mb-1">{theme.emoji}</div>
								<div className={titleCls}>{theme.label}</div>
								{!compact && (
									<div className={hintCls}>{theme.hint}</div>
								)}
								{!compact && (
									<div className="mt-1.5 flex gap-2">
										<button
											type="button"
											className={linkCls}
											onClick={async (e) => {
												e.stopPropagation();
												await unlockAudio();
												onBgmChange?.(theme.id);
												previewBgmTheme(theme.id, 'lobby');
											}}
										>
											Lobby
										</button>
										<button
											type="button"
											className={linkCls}
											onClick={async (e) => {
												e.stopPropagation();
												await unlockAudio();
												onBgmChange?.(theme.id);
												previewBgmTheme(theme.id, 'game');
											}}
										>
											In-game
										</button>
									</div>
								)}
							</button>
						);
					})}
				</div>
			</div>

			<div>
				<div className={sectionLabel}>
					<Volume2 className={iconCls} />
					Sound effects
				</div>
				<div className={cn('grid gap-2', compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4')}>
					{SFX_PACKS.map((pack) => {
						const selected = sfxPack === pack.id;
						return (
							<button
								key={pack.id}
								type="button"
								onClick={async () => {
									await unlockAudio();
									onSfxChange?.(pack.id);
									previewSfxPack(pack.id);
								}}
								className={cn(chipBase, selected && chipSelected)}
							>
								<div className="text-base leading-none mb-1">{pack.emoji}</div>
								<div className={titleCls}>{pack.label}</div>
								{!compact && (
									<div className={hintCls}>{pack.hint}</div>
								)}
							</button>
						);
					})}
				</div>
			</div>
		</div>
	);
}
