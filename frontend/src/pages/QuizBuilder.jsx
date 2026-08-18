// @ts-nocheck
import db from '@/api/apiClient';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, Check, Save, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import PageLoader from '@/components/PageLoader';
import GameAudioPicker from '@/components/games/GameAudioPicker';
import { GlassCard, ANSWER_COLORS } from '@/components/games/GameUi';
import { glassDialogMutedText, glassDialogTitleText } from '@/components/layout/glassStyles';
import { cn } from '@/lib/utils';

function emptyQuestion() {
  return {
    prompt: '',
    time_limit_seconds: 20,
    points_base: 1000,
    options: [
      { label: '', is_correct: true },
      { label: '', is_correct: false },
      { label: '', is_correct: false },
      { label: '', is_correct: false },
    ],
  };
}

export default function QuizBuilder() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('draft');
  const [bgmTheme, setBgmTheme] = useState('party');
  const [sfxPack, setSfxPack] = useState('classic');
  const [questions, setQuestions] = useState([emptyQuestion()]);

  const quizQuery = useQuery({
    queryKey: ['quiz', id],
    queryFn: () => db.quizzes.get(id),
    enabled: !isNew,
  });

  useEffect(() => {
    if (!quizQuery.data) return;
    const q = quizQuery.data;
    setTitle(q.title || '');
    setDescription(q.description || '');
    setStatus(q.status || 'draft');
    setBgmTheme(q.bgm_theme || 'party');
    setSfxPack(q.sfx_pack || 'classic');
    setQuestions(
      (q.questions || []).map((question) => ({
        prompt: question.prompt,
        time_limit_seconds: question.time_limit_seconds,
        points_base: question.points_base,
        options: (question.options || []).map((o) => ({
          label: o.label,
          is_correct: !!o.is_correct,
        })),
      })),
    );
  }, [quizQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        status,
        bgm_theme: bgmTheme,
        sfx_pack: sfxPack,
        questions: questions.map((q) => ({
          prompt: q.prompt.trim(),
          time_limit_seconds: Number(q.time_limit_seconds) || 20,
          points_base: Number(q.points_base) || 1000,
          options: q.options
            .filter((o) => o.label.trim())
            .map((o) => ({
              label: o.label.trim(),
              is_correct: !!o.is_correct,
            })),
        })),
      };

      if (!payload.title) throw new Error('Title is required');
      if (payload.questions.length === 0) throw new Error('Add at least one question');
      for (const q of payload.questions) {
        if (!q.prompt) throw new Error('Every question needs a prompt');
        if (q.options.length < 2) throw new Error('Each question needs at least 2 options');
        if (q.options.filter((o) => o.is_correct).length !== 1) {
          throw new Error('Each question needs exactly one correct option');
        }
      }

      if (isNew) return db.quizzes.create(payload);
      return db.quizzes.update(id, payload);
    },
    onSuccess: (quiz) => {
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      toast.success('Quiz saved');
      navigate(`/games/${quiz.id}/edit`, { replace: true });
    },
    onError: (err) => toast.error(err?.data?.message || err.message || 'Save failed'),
  });

  if (!isNew && quizQuery.isLoading) return <PageLoader />;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/games"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className={cn('text-xl font-bold tracking-tight', glassDialogTitleText)}>
            {isNew ? 'New quiz' : 'Edit quiz'}
          </h1>
          <p className={cn('text-sm', glassDialogMutedText)}>
            Build questions, choose audio, then preview.
          </p>
        </div>
        {!isNew && (
          <Button variant="outline" asChild>
            <Link to={`/games/${id}/preview`}>
              <Eye className="h-4 w-4 mr-2" />
              Preview / Test
            </Link>
          </Button>
        )}
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="shadow-md shadow-primary/20"
        >
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <GlassCard className="space-y-4">
        <div className="space-y-2">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Company trivia" />
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </div>
        <div className="space-y-2 max-w-xs">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published (self-paced)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </GlassCard>

      <GlassCard>
        <h2 className={cn('font-semibold mb-1', glassDialogTitleText)}>Sound & music</h2>
        <p className={cn('text-xs mb-3', glassDialogMutedText)}>
          Tap a card to preview. Saved with the quiz for live sessions.
        </p>
        <GameAudioPicker
          bgmTheme={bgmTheme}
          sfxPack={sfxPack}
          onBgmChange={setBgmTheme}
          onSfxChange={setSfxPack}
        />
      </GlassCard>

      <div className="space-y-4">
        {questions.map((question, qi) => (
          <GlassCard key={qi} className="space-y-4">
            <div className="flex items-start justify-between gap-2">
              <Label className="text-base">Question {qi + 1}</Label>
              {questions.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== qi))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Textarea
              value={question.prompt}
              onChange={(e) => {
                const v = e.target.value;
                setQuestions((prev) => prev.map((q, i) => (i === qi ? { ...q, prompt: v } : q)));
              }}
              placeholder="Ask something…"
              rows={2}
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Time (seconds)</Label>
                <Input
                  type="number"
                  min={5}
                  max={120}
                  value={question.time_limit_seconds}
                  onChange={(e) => {
                    const v = e.target.value;
                    setQuestions((prev) => prev.map((q, i) => (i === qi ? { ...q, time_limit_seconds: v } : q)));
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Base points</Label>
                <Input
                  type="number"
                  min={100}
                  max={5000}
                  step={100}
                  value={question.points_base}
                  onChange={(e) => {
                    const v = e.target.value;
                    setQuestions((prev) => prev.map((q, i) => (i === qi ? { ...q, points_base: v } : q)));
                  }}
                />
              </div>
            </div>
            <div className="grid gap-2">
              {question.options.map((option, oi) => (
                <div
                  key={oi}
                  className={cn('flex items-center gap-2 rounded-xl border p-2', ANSWER_COLORS[oi % 4].soft)}
                >
                  <button
                    type="button"
                    title="Mark correct"
                    className={cn(
                      'h-8 w-8 rounded-md flex items-center justify-center shrink-0 border',
                      option.is_correct ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border',
                    )}
                    onClick={() => {
                      setQuestions((prev) => prev.map((q, i) => {
                        if (i !== qi) return q;
                        return {
                          ...q,
                          options: q.options.map((o, j) => ({ ...o, is_correct: j === oi })),
                        };
                      }));
                    }}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <Input
                    value={option.label}
                    placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                    className="bg-background/60"
                    onChange={(e) => {
                      const v = e.target.value;
                      setQuestions((prev) => prev.map((q, i) => {
                        if (i !== qi) return q;
                        return {
                          ...q,
                          options: q.options.map((o, j) => (j === oi ? { ...o, label: v } : o)),
                        };
                      }));
                    }}
                  />
                </div>
              ))}
            </div>
          </GlassCard>
        ))}
      </div>

      <Button
        variant="outline"
        className="w-full"
        onClick={() => setQuestions((prev) => [...prev, emptyQuestion()])}
      >
        <Plus className="h-4 w-4 mr-2" />
        Add question
      </Button>
    </div>
  );
}
