// @ts-nocheck
import db from '@/api/apiClient';
import React, { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Copy, ImagePlus, Plus, Trash2, Check, Save, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import PageLoader from '@/components/PageLoader';
import GameAudioPicker from '@/components/games/GameAudioPicker';
import { GlassCard, ANSWER_COLORS } from '@/components/games/GameUi';
import { glassDialogMutedText, glassDialogTitleText } from '@/components/layout/glassStyles';
import { extractPublicStoragePath, toPublicFileUrl } from '@/lib/media';
import { cn } from '@/lib/utils';
import { isTrueFalseQuestion, trueFalseOptions } from '@/lib/quizQuestion';
import { formatSelfPacedDeadline } from '@/lib/quizAnalyticsFormat';
import { useAuth } from '@/lib/AuthContext';
import { can } from '@/lib/roles';

const TIME_MIN = 5;
const TIME_MAX = 120;
const POINTS_MIN = 100;
const POINTS_MAX = 5000;
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

function newClientKey() {
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyQuestion() {
  return {
    clientKey: newClientKey(),
    prompt: '',
    image_url: null,
    question_type: 'multiple_choice',
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

function cloneQuestion(question) {
  return {
    clientKey: newClientKey(),
    prompt: question.prompt,
    image_url: question.image_url || null,
    question_type: question.question_type || 'multiple_choice',
    time_limit_seconds: question.time_limit_seconds,
    points_base: question.points_base,
    options: (question.options || []).map((option) => ({
      label: option.label,
      is_correct: !!option.is_correct,
    })),
  };
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function normalizeQuestionText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function questionContentFingerprint(question) {
  const prompt = normalizeQuestionText(question.prompt);
  const type = question.question_type || 'multiple_choice';
  const rawImage = String(question.image_url || '').trim();
  const image = extractPublicStoragePath(rawImage) || rawImage;
  const options = (question.options || [])
    .map((option) => `${normalizeQuestionText(option.label)}|${option.is_correct ? '1' : '0'}`)
    .join('\n');
  return `${type}\n${prompt}\n${image}\n${options}`;
}

function duplicateQuestionMessage(questions) {
  const seen = {};
  for (let i = 0; i < questions.length; i += 1) {
    const key = questionContentFingerprint(questions[i]);
    if (seen[key] !== undefined) {
      return `Questions ${seen[key] + 1} and ${i + 1} are identical. Change the prompt, an option, or the correct answer before saving.`;
    }
    seen[key] = i;
  }
  return null;
}

function firstValidationError(err) {
  if (err?.data?.errors) {
    const joined = Object.values(err.data.errors).flat().filter(Boolean).join(' ');
    if (joined) return joined;
  }
  return err?.data?.message || err.message || 'Save failed';
}

function toDatetimeLocalValue(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function QuizBuilder() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const imageInputRef = useRef(null);
  const [imageTargetIndex, setImageTargetIndex] = useState(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('draft');
  const [bgmTheme, setBgmTheme] = useState('party');
  const [asyncPowerUps, setAsyncPowerUps] = useState(false);
  const [asyncDeadlineLocal, setAsyncDeadlineLocal] = useState('');
  const [questions, setQuestions] = useState([emptyQuestion()]);
  const mcBackupRef = useRef({});
  const [bulkTime, setBulkTime] = useState(20);
  const [bulkPoints, setBulkPoints] = useState(1000);
  const [uploadingQi, setUploadingQi] = useState(null);

  const quizQuery = useQuery({
    queryKey: ['quiz', String(id)],
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
    setAsyncPowerUps(!!q.async_power_ups_enabled);
    setAsyncDeadlineLocal(toDatetimeLocalValue(q.async_deadline_at));
    setQuestions(
      (q.questions || []).map((question) => ({
        clientKey: `saved-${question.id}`,
        prompt: question.prompt,
        image_url: question.image_url || null,
        question_type: question.question_type || 'multiple_choice',
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
        questions: questions.map((q) => ({
          prompt: q.prompt.trim(),
          image_url: extractPublicStoragePath(q.image_url) || q.image_url || null,
          question_type: q.question_type || 'multiple_choice',
          time_limit_seconds: clampInt(q.time_limit_seconds, TIME_MIN, TIME_MAX, 20),
          points_base: clampInt(q.points_base, POINTS_MIN, POINTS_MAX, 1000),
          options: (isTrueFalseQuestion(q) ? q.options : q.options.filter((o) => o.label.trim()))
            .map((o) => ({
              label: isTrueFalseQuestion(q) ? o.label : o.label.trim(),
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

      const duplicateMessage = duplicateQuestionMessage(payload.questions);
      if (duplicateMessage) throw new Error(duplicateMessage);

      if (status === 'published') {
        payload.async_power_ups_enabled = asyncPowerUps;
        payload.async_deadline_at = asyncDeadlineLocal ? new Date(asyncDeadlineLocal).toISOString() : null;
      }

      if (isNew) return db.quizzes.create(payload);
      return db.quizzes.update(id, payload);
    },
    onSuccess: (quiz) => {
      queryClient.setQueryData(['quiz', String(quiz.id)], quiz);
      queryClient.invalidateQueries({ queryKey: ['quiz', String(quiz.id)] });
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      toast.success('Quiz saved');
      navigate('/games', { replace: true });
    },
    onError: (err) => toast.error(firstValidationError(err)),
  });

  const setQuestionType = (qi, type) => {
    setQuestions((prev) => prev.map((q, i) => {
      if (i !== qi) return q;
      if (type === q.question_type) return q;
      if (type === 'true_false') {
        if (q.question_type !== 'true_false') {
          mcBackupRef.current[q.clientKey] = q.options;
        }
        const trueCorrect = (q.options || []).some((o) => o.is_correct && normalizeQuestionText(o.label) === 'true');
        const falseCorrect = (q.options || []).some((o) => o.is_correct && normalizeQuestionText(o.label) === 'false');
        const trueIsCorrect = trueCorrect || !falseCorrect;
        return { ...q, question_type: type, options: trueFalseOptions(trueIsCorrect) };
      }
      const backup = mcBackupRef.current[q.clientKey];
      const options = backup && backup.length >= 2 ? backup : emptyQuestion().options;
      return { ...q, question_type: 'multiple_choice', options };
    }));
  };

  const applyTimeToAll = () => {
    const next = clampInt(bulkTime, TIME_MIN, TIME_MAX, 20);
    setBulkTime(next);
    setQuestions((prev) => prev.map((q) => ({ ...q, time_limit_seconds: next })));
    toast.success(`Applied ${next}s to all questions`);
  };

  const applyPointsToAll = () => {
    const next = clampInt(bulkPoints, POINTS_MIN, POINTS_MAX, 1000);
    setBulkPoints(next);
    setQuestions((prev) => prev.map((q) => ({ ...q, points_base: next })));
    toast.success(`Applied ${next} points to all questions`);
  };

  const duplicateAt = (qi) => {
    setQuestions((prev) => {
      const next = [...prev];
      next.splice(qi + 1, 0, cloneQuestion(prev[qi]));
      return next;
    });
  };

  const pickImage = (qi) => {
    setImageTargetIndex(qi);
    imageInputRef.current?.click();
  };

  const onImageSelected = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    const qi = imageTargetIndex;
    setImageTargetIndex(null);
    if (!file || qi == null) return;
    if (file.size > IMAGE_MAX_BYTES) {
      toast.error('Image must be 10MB or smaller');
      return;
    }
    setUploadingQi(qi);
    try {
      const { file_url } = await db.integrations.Core.UploadFile({
        file,
        folder: 'quiz-question-images',
      });
      const storedUrl = extractPublicStoragePath(file_url) || file_url || null;
      setQuestions((prev) => prev.map((q, i) => (i === qi ? { ...q, image_url: storedUrl } : q)));
    } catch (err) {
      toast.error(firstValidationError(err) || 'Image upload failed');
    } finally {
      setUploadingQi(null);
    }
  };

  if (!isNew && quizQuery.isLoading) return <PageLoader />;

  if (isNew && !can(user, 'quiz.create')) {
    return <Navigate to="/games" replace />;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={onImageSelected}
      />
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
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="(Optional)"
            rows={2}
          />
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
          <p className={cn('text-xs', glassDialogMutedText)}>
            Draft and published quizzes can both be hosted live. Publishing also unlocks one-time self-paced play.
          </p>
        </div>
        {status === 'published' ? (
          <div className="space-y-3 rounded-xl border border-border px-3 py-3">
            <p className={cn('text-sm font-medium', glassDialogTitleText)}>Published / Self-paced</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0 space-y-2">
                <Label>Self-paced power-ups</Label>
                <div className="flex h-10 items-center justify-between gap-3 rounded-md border border-input bg-background px-3">
                  <span className={cn('text-sm', glassDialogMutedText)}>
                    {asyncPowerUps ? 'On' : 'Off'}
                  </span>
                  <Switch checked={asyncPowerUps} onCheckedChange={setAsyncPowerUps} />
                </div>
                <p className={cn('text-xs', glassDialogMutedText)}>
                  Off by default. Same power-ups as live games if enabled.
                </p>
              </div>
              <div className="min-w-0 space-y-2">
                <Label>Deadline (optional)</Label>
                <div className="flex gap-2">
                  <Input
                    type="datetime-local"
                    className="min-w-0 flex-1"
                    value={asyncDeadlineLocal}
                    onChange={(e) => setAsyncDeadlineLocal(e.target.value)}
                  />
                  {asyncDeadlineLocal ? (
                    <Button type="button" variant="outline" className="shrink-0" onClick={() => setAsyncDeadlineLocal('')}>
                      Clear
                    </Button>
                  ) : null}
                </div>
                <p className={cn('text-xs', glassDialogMutedText)}>
                  {asyncDeadlineLocal
                    ? formatSelfPacedDeadline(new Date(asyncDeadlineLocal).toISOString())
                    : 'No deadline'}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </GlassCard>

      <GlassCard>
        <h2 className={cn('font-semibold mb-1', glassDialogTitleText)}>Sound & music</h2>
        <p className={cn('text-xs mb-3', glassDialogMutedText)}>
          Choose a music theme. Saved with the quiz for live sessions.
        </p>
        <GameAudioPicker
          bgmTheme={bgmTheme}
          onBgmChange={setBgmTheme}
          showSfx={false}
        />
      </GlassCard>

      <GlassCard className="space-y-4">
        <div>
          <h2 className={cn('font-semibold', glassDialogTitleText)}>Quiz settings</h2>
          <p className={cn('text-xs mt-1', glassDialogMutedText)}>
            Bulk actions update every question once. You can still change any question afterward.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Time for all</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                min={TIME_MIN}
                max={TIME_MAX}
                value={bulkTime}
                onChange={(e) => setBulkTime(e.target.value)}
              />
              <Button
                type="button"
                className="shrink-0 shadow-md shadow-primary/20"
                onClick={applyTimeToAll}
              >
                Apply
              </Button>
            </div>
            <p className={cn('text-xs', glassDialogMutedText)}>{TIME_MIN}–{TIME_MAX} seconds</p>
          </div>
          <div className="space-y-2">
            <Label>Points for all</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                min={POINTS_MIN}
                max={POINTS_MAX}
                step={100}
                value={bulkPoints}
                onChange={(e) => setBulkPoints(e.target.value)}
              />
              <Button
                type="button"
                className="shrink-0 shadow-md shadow-primary/20"
                onClick={applyPointsToAll}
              >
                Apply
              </Button>
            </div>
            <p className={cn('text-xs', glassDialogMutedText)}>{POINTS_MIN}–{POINTS_MAX} points</p>
          </div>
        </div>
      </GlassCard>

      <div className="space-y-4">
        {questions.map((question, qi) => (
          <GlassCard key={question.clientKey || qi} className="space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-2 min-w-0">
                <Label className="text-base">Question {qi + 1}</Label>
                <div className="max-w-xs">
                  <Select
                    value={question.question_type || 'multiple_choice'}
                    onValueChange={(v) => setQuestionType(qi, v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="multiple_choice">Multiple choice</SelectItem>
                      <SelectItem value="true_false">True / False</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => duplicateAt(qi)}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Duplicate
                </Button>
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
            <div className="flex flex-col gap-3">
              <Label className="text-xs">Optional image</Label>
              {question.image_url ? (
                <div className="space-y-2">
                  <div className="overflow-hidden rounded-xl border border-border bg-muted/40">
                    <img
                      src={toPublicFileUrl(question.image_url)}
                      alt=""
                      className="mx-auto max-h-48 w-full object-contain"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingQi === qi}
                      onClick={() => pickImage(qi)}
                    >
                      Replace image
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setQuestions((prev) => prev.map((q, i) => (i === qi ? { ...q, image_url: null } : q)))}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  disabled={uploadingQi === qi}
                  onClick={() => pickImage(qi)}
                >
                  <ImagePlus className="h-4 w-4 mr-2" />
                  {uploadingQi === qi ? 'Uploading…' : 'Add image'}
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Time (seconds)</Label>
                <Input
                  type="number"
                  min={TIME_MIN}
                  max={TIME_MAX}
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
                  min={POINTS_MIN}
                  max={POINTS_MAX}
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
              {question.options.map((option, oi) => {
                const tf = isTrueFalseQuestion(question);
                return (
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
                    readOnly={tf}
                    onChange={(e) => {
                      if (tf) return;
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
                );
              })}
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
