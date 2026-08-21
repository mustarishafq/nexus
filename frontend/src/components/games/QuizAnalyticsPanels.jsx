// @ts-nocheck
import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  formatAccuracy,
  formatResponseMs,
  formatPointsDelta,
  formatDifficulty,
  powerUpLabel,
  questionOutcome,
  questionOutcomeMark,
} from '@/lib/quizAnalyticsFormat';

export function QuestionQuality({ rows = [] }) {
  if (!rows.length) return null;

  return (
    <div className="rounded-3xl bg-black/25 border border-white/15 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10">
        <p className="text-sm font-black text-white">Question Quality</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-white/50">
              {['Q', 'Prompt', 'Correct', 'Wrong', 'Missed', 'Accuracy', 'Avg. time', 'Difficulty'].map((h) => (
                <th key={h} className="px-3 py-2 font-bold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.question_id} className="border-t border-white/10 text-white">
                <td className="px-3 py-3 font-black text-white/60">Q{row.index}</td>
                <td className="px-3 py-3 font-semibold max-w-[280px] truncate" title={row.prompt}>{row.prompt}</td>
                <td className="px-3 py-3 tabular-nums">{row.correct}</td>
                <td className="px-3 py-3 tabular-nums">{row.wrong}</td>
                <td className="px-3 py-3 tabular-nums">{row.missed}</td>
                <td className="px-3 py-3">{formatAccuracy(row.accuracy)}</td>
                <td className="px-3 py-3">{formatResponseMs(row.average_response_ms)}</td>
                <td className="px-3 py-3 font-black">{formatDifficulty(row.difficulty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function QuestionBreakdown({ questions = [] }) {
  const [open, setOpen] = useState(null);
  if (!questions.length) {
    return <p className="text-sm font-semibold text-white/60">No question results.</p>;
  }

  return (
    <div className="space-y-2">
      {questions.map((q) => {
        const outcome = questionOutcome(q);
        const expanded = open === q.question_id;
        return (
          <button
            key={q.question_id}
            type="button"
            onClick={() => setOpen(expanded ? null : q.question_id)}
            className="w-full rounded-2xl bg-black/20 border border-white/10 px-3 py-3 text-left text-white"
          >
            <div className="flex items-center gap-3">
              <span className="text-xs font-black text-white/50 w-8">Q{q.index}</span>
              <span className={cn(
                'inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-black',
                outcome === 'correct' && 'bg-[#26890C]',
                outcome === 'wrong' && 'bg-[#E21B3C]',
                outcome === 'missed' && 'bg-slate-500',
              )}
              >
                {questionOutcomeMark(outcome)}
              </span>
              <span className="flex-1 font-bold">{formatResponseMs(q.response_ms)}</span>
              <span className="font-black tabular-nums">{formatPointsDelta(q.points_awarded)}</span>
              <ChevronDown className={cn('h-4 w-4 opacity-60 transition-transform', expanded && 'rotate-180')} />
            </div>
            {expanded ? (
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-white/80">
                <p>Streak after: {q.streak_after || 0}</p>
                <p>Power-up: {q.power_up_used ? powerUpLabel(q.power_up_used) : '—'}</p>
                {q.rank_after != null ? <p>Rank after: #{q.rank_after}</p> : null}
                {q.rank_delta ? <p>Rank change: {q.rank_delta > 0 ? `↑ ${q.rank_delta}` : `↓ ${Math.abs(q.rank_delta)}`}</p> : null}
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function StatCard({ label, value, hint, accent, icon: Icon, className }) {
  const accents = {
    green: 'from-[#26890C] to-[#1a5f08]',
    blue: 'from-[#1368CE] to-[#0d4a94]',
    red: 'from-[#E21B3C] to-[#b0142e]',
    orange: 'from-[#FF8B2D] to-[#d56e12]',
    gold: 'from-amber-400 to-yellow-600',
    slate: 'from-slate-500 to-slate-700',
  };

  return (
    <div className={cn('rounded-3xl bg-gradient-to-br text-white px-4 py-4 shadow-lg', accents[accent] || 'from-white/15 to-black/20', className)}>
      <p className="text-[11px] font-black uppercase tracking-wider opacity-80 flex items-center gap-1">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        {label}
      </p>
      <p className="mt-1 text-xl sm:text-2xl font-black truncate">{value}</p>
      {hint ? <p className="text-xs font-semibold opacity-80">{hint}</p> : null}
    </div>
  );
}
