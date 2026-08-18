// @ts-nocheck
import React, { forwardRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Crown, Medal, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { glassDialogPanelStyles } from '@/components/layout/glassStyles';

/** Kahoot-classic answer palette + geometry (soft = builder, works light+dark) */
export const ANSWER_COLORS = [
	{
		bg: 'bg-[#E21B3C]',
		solid: 'bg-[#E21B3C] text-white',
		soft: 'bg-[#E21B3C]/10 border-[#E21B3C]/35 dark:bg-[#E21B3C]/25 dark:border-[#E21B3C]/45',
		shadow: 'shadow-[0_6px_0_#b0142e]',
		active: 'active:shadow-[0_2px_0_#b0142e] active:translate-y-1',
		shape: 'triangle',
		label: 'A',
	},
	{
		bg: 'bg-[#1368CE]',
		solid: 'bg-[#1368CE] text-white',
		soft: 'bg-[#1368CE]/10 border-[#1368CE]/35 dark:bg-[#1368CE]/25 dark:border-[#1368CE]/45',
		shadow: 'shadow-[0_6px_0_#0d4a94]',
		active: 'active:shadow-[0_2px_0_#0d4a94] active:translate-y-1',
		shape: 'diamond',
		label: 'B',
	},
	{
		bg: 'bg-[#D89E00]',
		solid: 'bg-[#D89E00] text-white',
		soft: 'bg-[#D89E00]/15 border-[#D89E00]/40 dark:bg-[#D89E00]/25 dark:border-[#D89E00]/50',
		shadow: 'shadow-[0_6px_0_#a87800]',
		active: 'active:shadow-[0_2px_0_#a87800] active:translate-y-1',
		shape: 'circle',
		label: 'C',
	},
	{
		bg: 'bg-[#26890C]',
		solid: 'bg-[#26890C] text-white',
		soft: 'bg-[#26890C]/10 border-[#26890C]/35 dark:bg-[#26890C]/25 dark:border-[#26890C]/45',
		shadow: 'shadow-[0_6px_0_#1a5f08]',
		active: 'active:shadow-[0_2px_0_#1a5f08] active:translate-y-1',
		shape: 'square',
		label: 'D',
	},
];

const CHIP_COLORS = [
	'bg-[#E21B3C]',
	'bg-[#1368CE]',
	'bg-[#D89E00]',
	'bg-[#26890C]',
	'bg-[#864CBF]',
	'bg-[#FF8B2D]',
	'bg-[#00A8A8]',
	'bg-[#FF5C8A]',
];

function AnswerShape({ type }) {
	if (type === 'triangle') {
		return (
			<span
				className="inline-block h-0 w-0 border-l-[10px] border-r-[10px] border-b-[18px] border-l-transparent border-r-transparent border-b-white"
				aria-hidden
			/>
		);
	}
	if (type === 'diamond') {
		return <span className="inline-block h-4 w-4 rotate-45 bg-white" aria-hidden />;
	}
	if (type === 'circle') {
		return <span className="inline-block h-4 w-4 rounded-full bg-white" aria-hidden />;
	}
	return <span className="inline-block h-4 w-4 rounded-[3px] bg-white" aria-hidden />;
}

/**
 * Full-bleed game stage — fixed Kahoot palette so light/dark app theme
 * does not wash out contrast (always purple stage + light surfaces).
 */
export const GameStage = forwardRef(function GameStage({ children, phase = 'lobby', className }, ref) {
	const phases = {
		lobby: 'from-[#46178f] via-[#5b21b6] to-[#7c3aed]',
		question: 'from-[#2d0a5e] via-[#46178f] to-[#5b21b6]',
		reveal: 'from-[#1e3a5f] via-[#1368CE] to-[#0d4a94]',
		leaderboard: 'from-[#3b0764] via-[#6b21a8] to-[#86198f]',
		finished: 'from-[#422006] via-[#854d0e] to-[#a16207]',
	};

	return (
		<div
			ref={ref}
			className={cn(
				// Fill under TopBar to screen bottom (behind dock); pad content so dock doesn’t cover UI
				'relative flex-1 min-h-[calc(100dvh-4rem)] w-full px-4 sm:px-6 pt-5 sm:pt-8',
				'pb-[calc(5.25rem+env(safe-area-inset-bottom)+0.75rem)]',
				'bg-gradient-to-br text-white overflow-auto',
				'[&:fullscreen]:min-h-screen [&:fullscreen]:h-screen [&:fullscreen]:w-screen [&:fullscreen]:mx-0 [&:fullscreen]:rounded-none [&:fullscreen]:pb-8',
				'[&:-webkit-full-screen]:min-h-screen [&:-webkit-full-screen]:h-screen [&:-webkit-full-screen]:w-screen [&:-webkit-full-screen]:mx-0 [&:-webkit-full-screen]:pb-8',
				phases[phase] || phases.lobby,
				className,
			)}
		>
			<motion.div
				className="pointer-events-none absolute -top-20 -left-16 h-56 w-56 rounded-full bg-white/10 blur-3xl"
				animate={{ x: [0, 40, 0], y: [0, 20, 0] }}
				transition={{ repeat: Infinity, duration: 10, ease: 'easeInOut' }}
			/>
			<motion.div
				className="pointer-events-none absolute -bottom-24 -right-10 h-64 w-64 rounded-full bg-[#FF8B2D]/20 blur-3xl"
				animate={{ x: [0, -30, 0], y: [0, -25, 0] }}
				transition={{ repeat: Infinity, duration: 12, ease: 'easeInOut' }}
			/>
			<div className="relative z-10 max-w-5xl mx-auto">{children}</div>
		</div>
	);
});

/**
 * @param {'theme'|'stage'} variant
 * theme = Nexus listing/builder (follows light/dark)
 * stage = panels on purple GameStage (light card in light mode, dark card in dark mode)
 */
export function GlassCard({ children, className, variant = 'theme' }) {
	if (variant === 'stage') {
		return (
			<div
				className={cn(
					'rounded-2xl shadow-xl p-4 sm:p-5 border',
					'bg-white text-slate-900 border-white/60',
					'dark:bg-slate-900 dark:text-slate-50 dark:border-slate-700',
					className,
				)}
			>
				{children}
			</div>
		);
	}

	return (
		<div className={cn(glassDialogPanelStyles, 'rounded-2xl border p-4 sm:p-5 text-foreground', className)}>
			{children}
		</div>
	);
}

/** Toolbar chip for game stage controls */
export function GameIconButton({ children, onClick, title, className, active = false }) {
	return (
		<button
			type="button"
			title={title}
			aria-label={title}
			onClick={onClick}
			className={cn(
				'inline-flex h-10 w-10 items-center justify-center rounded-xl border text-white transition-colors',
				active
					? 'bg-white/30 border-white/50'
					: 'bg-white/15 border-white/25 hover:bg-white/25',
				className,
			)}
		>
			{children}
		</button>
	);
}

/** Enter / exit fullscreen for a GameStage element */
export function FullscreenButton({ targetRef, className }) {
	const [active, setActive] = useState(false);

	useEffect(() => {
		const sync = () => {
			const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
			setActive(Boolean(fsEl && (fsEl === targetRef?.current || fsEl.contains?.(targetRef?.current))));
		};
		document.addEventListener('fullscreenchange', sync);
		document.addEventListener('webkitfullscreenchange', sync);
		sync();
		return () => {
			document.removeEventListener('fullscreenchange', sync);
			document.removeEventListener('webkitfullscreenchange', sync);
		};
	}, [targetRef]);

	const toggle = async () => {
		const el = targetRef?.current;
		if (!el) return;
		try {
			const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
			if (!fsEl) {
				if (el.requestFullscreen) await el.requestFullscreen();
				else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
			} else if (document.exitFullscreen) {
				await document.exitFullscreen();
			} else if (document.webkitExitFullscreen) {
				document.webkitExitFullscreen();
			}
		} catch {
			// Browser may block without user gesture / policy
		}
	};

	return (
		<GameIconButton
			title={active ? 'Exit fullscreen' : 'Fullscreen'}
			onClick={toggle}
			active={active}
			className={className}
		>
			{active ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
		</GameIconButton>
	);
}

export function AnswerButton({
	index = 0,
	label,
	letter,
	selected,
	revealed,
	isCorrect,
	disabled,
	onClick,
	delay = 0,
}) {
	const colors = ANSWER_COLORS[index % ANSWER_COLORS.length];
	const showResult = revealed && isCorrect != null;

	return (
		<motion.button
			type="button"
			initial={{ opacity: 0, y: 28, scale: 0.9 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			transition={{ type: 'spring', stiffness: 420, damping: 18, delay }}
			whileHover={disabled ? undefined : { scale: 1.03, y: -3 }}
			whileTap={disabled ? undefined : { scale: 0.97 }}
			disabled={disabled}
			onClick={onClick}
			className={cn(
				'relative flex items-center gap-3 rounded-xl px-4 py-5 sm:py-6 text-left font-bold text-base sm:text-xl text-white',
				'disabled:cursor-default min-h-[72px] transition-transform',
				showResult && isCorrect && 'bg-[#26890C] shadow-[0_6px_0_#1a5f08] ring-4 ring-white/50',
				showResult && !isCorrect && selected && 'bg-slate-500 opacity-50 grayscale',
				showResult && !isCorrect && !selected && 'opacity-40 grayscale',
				!showResult && colors.bg,
				!showResult && colors.shadow,
				!showResult && !disabled && colors.active,
				selected && !revealed && 'ring-4 ring-white scale-[1.02]',
			)}
		>
			<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-black/20">
				<AnswerShape type={colors.shape} />
			</span>
			<span className="flex-1 leading-snug drop-shadow-sm">
				{letter ? `${letter}. ` : ''}
				{label}
			</span>
			{showResult && isCorrect && (
				<motion.span
					initial={{ scale: 0 }}
					animate={{ scale: 1 }}
					className="text-2xl"
				>
					✓
				</motion.span>
			)}
		</motion.button>
	);
}

export function ScorePill({ score, streak }) {
	return (
		<div className="flex items-center gap-2">
			<motion.div
				key={score}
				initial={{ scale: 1.25 }}
				animate={{ scale: 1 }}
				className={cn(
					'rounded-full px-3.5 py-1.5 text-sm font-black tabular-nums shadow-lg border',
					'bg-white text-slate-900 border-white/80',
					'dark:bg-slate-900 dark:text-slate-50 dark:border-slate-600',
				)}
			>
				{score} pts
			</motion.div>
			{streak > 0 && (
				<motion.div
					key={streak}
					initial={{ scale: 0, rotate: -20 }}
					animate={{ scale: 1, rotate: 0 }}
					className="rounded-full bg-[#FF8B2D] text-white px-3 py-1.5 text-xs font-black shadow-lg"
				>
					🔥 {streak}
				</motion.div>
			)}
		</div>
	);
}

export function TimerRing({ seconds, total }) {
	const urgent = seconds <= 5;
	const pct = total > 0 ? Math.max(0, Math.min(1, seconds / total)) : 0;
	const r = 28;
	const c = 2 * Math.PI * r;

	return (
		<motion.div
			animate={urgent ? { scale: [1, 1.12, 1] } : { scale: 1 }}
			transition={urgent ? { repeat: Infinity, duration: 0.55 } : {}}
			className="relative h-[72px] w-[72px]"
			aria-label={`${seconds} seconds remaining`}
		>
			<svg className="h-[72px] w-[72px] -rotate-90" viewBox="0 0 64 64">
				<circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="6" />
				<circle
					cx="32"
					cy="32"
					r={r}
					fill="none"
					strokeWidth="6"
					strokeLinecap="round"
					stroke={urgent ? '#E21B3C' : '#fff'}
					strokeDasharray={c}
					strokeDashoffset={c * (1 - pct)}
					style={{ transition: 'stroke-dashoffset 0.25s linear' }}
				/>
			</svg>
			<div className={cn(
				'absolute inset-0 flex items-center justify-center text-2xl font-black tabular-nums text-white',
				urgent && 'text-[#ffb4b4]',
			)}>
				{seconds}
			</div>
		</motion.div>
	);
}

export function PulsingPin({ pin }) {
	return (
		<div className="relative inline-flex flex-col items-center gap-2">
			<motion.div
				className="absolute inset-0 rounded-3xl bg-white/30 blur-xl"
				animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }}
				transition={{ repeat: Infinity, duration: 2 }}
			/>
			<motion.div
				animate={{ y: [0, -4, 0] }}
				transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
				className={cn(
					'relative rounded-3xl px-8 py-5 shadow-2xl border',
					'bg-white border-white/70',
					'dark:bg-slate-900 dark:border-slate-600',
				)}
			>
				<p className="text-[11px] font-bold uppercase tracking-[0.25em] text-violet-700 dark:text-violet-300 mb-1 text-center">
					Game PIN
				</p>
				<p className="text-5xl sm:text-7xl font-black tracking-[0.18em] tabular-nums text-slate-900 dark:text-slate-50">
					{pin}
				</p>
			</motion.div>
		</div>
	);
}

export function LobbyPlayerChip({ name, index = 0 }) {
	const color = CHIP_COLORS[index % CHIP_COLORS.length];

	return (
		<motion.div
			layout
			initial={{ opacity: 0, scale: 0.3, y: 40, rotate: -8 }}
			animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
			exit={{ opacity: 0, scale: 0.4, y: -10 }}
			transition={{ type: 'spring', stiffness: 480, damping: 16 }}
			whileHover={{ y: -6, scale: 1.08, rotate: 2 }}
			className={cn(
				'rounded-2xl px-3 py-3 text-center text-sm sm:text-base font-black text-white shadow-lg',
				'shadow-black/20',
				color,
			)}
		>
			<motion.span
				animate={{ y: [0, -3, 0] }}
				transition={{ repeat: Infinity, duration: 1.8 + (index % 4) * 0.25, ease: 'easeInOut' }}
				className="inline-block drop-shadow"
			>
				{name}
			</motion.span>
		</motion.div>
	);
}

export function WaitingDots({ label = 'Waiting for players', light = true }) {
	return (
		<div className={cn('flex items-center justify-center gap-2 text-sm font-semibold', light ? 'text-white/80' : 'text-muted-foreground')}>
			<span>{label}</span>
			<span className="flex gap-1.5">
				{[0, 1, 2].map((i) => (
					<motion.span
						key={i}
						className={cn('h-2 w-2 rounded-full', light ? 'bg-white' : 'bg-primary')}
						animate={{ opacity: [0.3, 1, 0.3], y: [0, -5, 0] }}
						transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.15 }}
					/>
				))}
			</span>
		</div>
	);
}

export function AnswerProgress({ answered = 0, total = 0 }) {
	const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
	return (
		<div className="rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 p-3 space-y-2 text-white">
			<div className="flex justify-between text-sm font-bold">
				<span>Answers</span>
				<motion.span key={answered} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="tabular-nums">
					{answered}/{total}
				</motion.span>
			</div>
			<div className="h-3 rounded-full bg-black/25 overflow-hidden">
				<motion.div
					className="h-full rounded-full bg-[#FF8B2D]"
					initial={false}
					animate={{ width: `${pct}%` }}
					transition={{ type: 'spring', stiffness: 120, damping: 18 }}
				/>
			</div>
		</div>
	);
}

export function QuestionTitle({ children }) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 30, scale: 0.94 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			transition={{ type: 'spring', stiffness: 300, damping: 18 }}
			className={cn(
				'rounded-2xl px-5 py-6 sm:px-8 sm:py-8 shadow-2xl border',
				'bg-white border-white/70 text-slate-900',
				'dark:bg-slate-900 dark:border-slate-600 dark:text-slate-50',
			)}
		>
			<h2 className="text-xl sm:text-3xl md:text-4xl font-black text-center leading-snug tracking-tight">
				{children}
			</h2>
		</motion.div>
	);
}

/**
 * Kahoot-style podium: 2nd · 1st · 3rd bars, then remaining ranks.
 * players: [{ user_id, display_name, score, streak? }]
 */
export function PodiumLeaderboard({ players = [], title = 'Leaderboard', highlightUserId = null }) {
	const sorted = [...players];
	const top = sorted.slice(0, 3);
	const rest = sorted.slice(3);
	const first = top[0];
	const second = top[1];
	const third = top[2];

	const podiumSlots = [
		{ player: second, place: 2, height: 'h-28 sm:h-36', color: 'from-slate-300 to-slate-400', delay: 0.15, medal: '🥈' },
		{ player: first, place: 1, height: 'h-40 sm:h-52', color: 'from-amber-300 to-yellow-500', delay: 0, medal: '🥇' },
		{ player: third, place: 3, height: 'h-20 sm:h-28', color: 'from-orange-400 to-amber-700', delay: 0.28, medal: '🥉' },
	];

	return (
		<div className="space-y-6">
			<motion.h2
				initial={{ opacity: 0, y: -12 }}
				animate={{ opacity: 1, y: 0 }}
				className="text-center text-3xl sm:text-4xl font-black text-white drop-shadow-lg flex items-center justify-center gap-2"
			>
				<Crown className="h-8 w-8 text-amber-300" />
				{title}
			</motion.h2>

			{/* Podium */}
			<div className="flex items-end justify-center gap-2 sm:gap-4 min-h-[220px] sm:min-h-[280px] pt-8">
				{podiumSlots.map(({ player, place, height, color, delay, medal }) => {
					if (!player) {
						return <div key={place} className="w-24 sm:w-36" />;
					}
					const isMe = highlightUserId && player.user_id === highlightUserId;
					return (
						<div key={player.user_id || place} className="flex flex-col items-center w-24 sm:w-36">
							<motion.div
								initial={{ opacity: 0, y: 20, scale: 0.8 }}
								animate={{ opacity: 1, y: 0, scale: 1 }}
								transition={{ delay: delay + 0.05, type: 'spring', stiffness: 360, damping: 16 }}
								className="mb-2 text-center px-1"
							>
								<div className="text-2xl sm:text-3xl mb-1">{medal}</div>
								<p className={cn(
									'font-black text-sm sm:text-base text-white truncate max-w-full drop-shadow',
									isMe && 'text-amber-200',
								)}>
									{player.display_name}
								</p>
								<p className="text-xs sm:text-sm font-bold text-white/80 tabular-nums">
									{player.score} pts
								</p>
								{player.streak > 1 && (
									<p className="text-[10px] font-bold text-[#FF8B2D]">🔥 {player.streak}</p>
								)}
							</motion.div>
							<motion.div
								initial={{ scaleY: 0, opacity: 0.6 }}
								animate={{ scaleY: 1, opacity: 1 }}
								transition={{ delay, type: 'spring', stiffness: 220, damping: 16 }}
								style={{ originY: 1 }}
								className={cn(
									'w-full rounded-t-2xl bg-gradient-to-b shadow-lg border border-white/30 flex items-start justify-center pt-3',
									height,
									color,
									place === 1 && 'ring-4 ring-amber-200/60',
								)}
							>
								<span className="text-3xl sm:text-4xl font-black text-black/40">{place}</span>
							</motion.div>
						</div>
					);
				})}
			</div>

			{/* Rest of ranks */}
			{rest.length > 0 && (
				<div className="rounded-2xl bg-black/25 backdrop-blur-md border border-white/15 overflow-hidden divide-y divide-white/10">
					{rest.map((p, i) => {
						const rank = i + 4;
						const isMe = highlightUserId && p.user_id === highlightUserId;
						return (
							<motion.div
								key={p.user_id}
								initial={{ opacity: 0, x: -24 }}
								animate={{ opacity: 1, x: 0 }}
								transition={{ delay: 0.35 + i * 0.05 }}
								className={cn(
									'flex items-center justify-between px-4 py-3 font-bold text-white',
									isMe && 'bg-white/15',
								)}
							>
								<span className="flex items-center gap-3 min-w-0">
									<span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm tabular-nums shrink-0">
										{rank}
									</span>
									<span className="truncate">{p.display_name}</span>
									{p.streak > 1 && <span className="text-xs text-[#FF8B2D]">🔥{p.streak}</span>}
								</span>
								<span className="tabular-nums text-white/90 shrink-0 ml-3">{p.score}</span>
							</motion.div>
						);
					})}
				</div>
			)}

			{players.length === 0 && (
				<p className="text-center text-white/70 font-semibold py-8">No players yet</p>
			)}

			{players.length === 1 && !second && (
				<div className="flex justify-center">
					<Medal className="h-5 w-5 text-white/40" />
				</div>
			)}
		</div>
	);
}

export function GameActionButton({ children, onClick, disabled, variant = 'primary', className }) {
	const variants = {
		primary: 'bg-[#26890C] shadow-[0_5px_0_#1a5f08] hover:brightness-110 text-white',
		secondary: cn(
			'bg-white text-violet-900 shadow-[0_5px_0_#c4b5fd] hover:brightness-95',
			'dark:bg-slate-100 dark:text-violet-950 dark:shadow-[0_5px_0_#64748b]',
		),
		danger: 'bg-[#E21B3C] shadow-[0_5px_0_#b0142e] hover:brightness-110 text-white',
		ghost: 'bg-white/15 text-white border border-white/30 hover:bg-white/25',
	};

	return (
		<motion.button
			type="button"
			whileHover={disabled ? undefined : { y: -2 }}
			whileTap={disabled ? undefined : { y: 3, boxShadow: '0 2px 0 transparent' }}
			disabled={disabled}
			onClick={onClick}
			className={cn(
				'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 font-black text-sm sm:text-base',
				'disabled:opacity-40 disabled:cursor-not-allowed transition-all',
				variants[variant],
				className,
			)}
		>
			{children}
		</motion.button>
	);
}
