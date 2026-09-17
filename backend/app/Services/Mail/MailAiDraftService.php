<?php

namespace App\Services\Mail;

use App\Models\User;
use App\Services\Llm\LlmUsageRecorder;
use App\Services\Llm\OpenRouterClient;
use App\Support\AppSettings;
use RuntimeException;
use Throwable;

class MailAiDraftService
{
    public const FEATURE = 'mail_draft';

    public const MODES = ['compose', 'reply', 'forward'];

    public const TONES = ['professional', 'friendly', 'brief'];

    public const LANGUAGES = ['auto', 'en', 'ms'];

    public function __construct(private OpenRouterClient $client) {}

    /**
     * @param  array{
     *     instruction: string,
     *     tone?: ?string,
     *     to?: ?string,
     *     cc?: ?string,
     *     subject?: ?string,
     *     body?: ?string,
     *     mode?: ?string
     * }  $input
     * @return array{subject: string, body: string, to: string}
     */
    public function draft(User $user, array $input): array
    {
        $instruction = trim((string) ($input['instruction'] ?? ''));
        if ($instruction === '') {
            throw new RuntimeException('Describe what the email should say.');
        }

        $messages = [
            ['role' => 'system', 'content' => $this->systemPrompt($user, $input)],
            ['role' => 'user', 'content' => $this->userPrompt($input, $instruction)],
        ];

        try {
            $response = $this->client->chat($messages, []);
        } catch (Throwable $e) {
            $this->recordUsage($user, [], false, $e->getMessage(), $instruction, null);
            throw $e instanceof RuntimeException
                ? $e
                : new RuntimeException($e->getMessage(), 0, $e);
        }

        $raw = trim((string) ($response['choices'][0]['message']['content'] ?? ''));
        $usage = LlmUsageRecorder::extractFromResponse($response);
        $this->recordUsage($user, $usage, true, null, $instruction, $raw);

        $parsed = self::parseDraftJson($raw);
        if ($parsed['body'] === '') {
            throw new RuntimeException('The AI did not return an email draft. Try again with a clearer instruction.');
        }

        return $parsed;
    }

    /**
     * @return array{subject: string, body: string, to: string}
     */
    public static function parseDraftJson(string $raw): array
    {
        $text = trim($raw);
        if ($text === '') {
            return ['subject' => '', 'body' => '', 'to' => ''];
        }

        if (preg_match('/```(?:json)?\s*(.*?)\s*```/is', $text, $matches) === 1) {
            $text = trim((string) $matches[1]);
        }

        $decoded = json_decode($text, true);
        if (! is_array($decoded)) {
            $start = strpos($text, '{');
            $end = strrpos($text, '}');
            if ($start !== false && $end !== false && $end > $start) {
                $decoded = json_decode(substr($text, $start, $end - $start + 1), true);
            }
        }

        if (! is_array($decoded)) {
            return ['subject' => '', 'body' => '', 'to' => ''];
        }

        return [
            'subject' => trim((string) ($decoded['subject'] ?? '')),
            'body' => trim((string) ($decoded['body'] ?? '')),
            'to' => trim((string) ($decoded['to'] ?? '')),
        ];
    }

    /**
     * @param  array<string, mixed>  $input
     */
    private function systemPrompt(User $user, array $input): string
    {
        $systemName = trim((string) (AppSettings::row()?->system_name ?: config('app.name', 'EMZI Nexus Brain')));
        $displayName = trim((string) ($user->full_name ?: $user->name ?: ''));
        $who = $displayName !== '' ? "The sender's name is {$displayName}." : '';
        $mode = $this->normalizeMode($input['mode'] ?? null);
        $tone = $this->normalizeTone($input['tone'] ?? null);
        $toneLine = $tone !== '' ? "Write in a {$tone} tone." : 'Match a professional workplace tone unless the instruction specifies otherwise.';
        $languageLine = self::languageInstruction($input['language'] ?? null);

        $modeLine = match ($mode) {
            'reply' => 'This is a reply. Write only the new reply text. Do not repeat or quote the original thread.',
            'forward' => 'This is a forward. Write only the new covering note. Do not repeat the forwarded message.',
            default => 'This is a new email.',
        };

        return <<<PROMPT
You draft send-ready staff emails inside {$systemName}. {$who}
{$modeLine}
{$toneLine}
{$languageLine}

Hard rules:
- Return JSON only with keys subject, body, and to. No markdown, no code fences, no commentary.
- JSON keys stay in English. subject and body string values must be in the target language — never translate them into English unless that language is English.
- body is plain text. No HTML. Sign with the sender's real name when a sign-off is natural; never invent a name.
- Do not invent facts, dates, amounts, or commitments that the user did not provide.
- Do not include quoted original messages or "On … wrote" blocks in body.
- Do not copy the language of Current subject, Current body, or a quoted original. Those are context only.
- Leave to as an empty string unless the current To field is empty and a recipient is clearly stated in the instruction (an email address).
- subject should be concise. For replies keep a Re: prefix if the current subject already has one. For forwards keep Fwd: if present. Translate the rest of the subject into the target language.
PROMPT;
    }

    /**
     * @param  array<string, mixed>  $input
     */
    private function userPrompt(array $input, string $instruction): string
    {
        $language = $this->normalizeLanguage($input['language'] ?? null);
        $lines = [
            'Instruction: '.$instruction,
            'Mode: '.$this->normalizeMode($input['mode'] ?? null),
            'Language: '.$language,
            'Write subject and body in the target language from the system rules. Do not switch to English because this prompt is in English.',
            'Current To: '.$this->clip((string) ($input['to'] ?? ''), 500),
            'Current Cc: '.$this->clip((string) ($input['cc'] ?? ''), 500),
            'Current subject: '.$this->clip((string) ($input['subject'] ?? ''), 500),
            'Current body (may include a quoted original):',
            $this->clip((string) ($input['body'] ?? ''), 8000),
        ];

        return implode("\n", $lines);
    }

    private function normalizeMode(mixed $mode): string
    {
        $value = strtolower(trim((string) $mode));

        return in_array($value, self::MODES, true) ? $value : 'compose';
    }

    private function normalizeTone(mixed $tone): string
    {
        $value = strtolower(trim((string) $tone));

        return in_array($value, self::TONES, true) ? $value : '';
    }

    public static function languageInstruction(mixed $language): string
    {
        return match (self::normalizeLanguageValue($language)) {
            'en' => 'Write subject and body in English.',
            'ms' => 'Write subject and body in Bahasa Melayu (Malay). Use natural Malaysian workplace Malay. Do not write the email in English.',
            default => 'Write subject and body in the same language as the Instruction. If the instruction is in Bahasa Melayu / Malay, the email must be in Bahasa Melayu. Do not default to English.',
        };
    }

    private function normalizeLanguage(mixed $language): string
    {
        return self::normalizeLanguageValue($language);
    }

    private static function normalizeLanguageValue(mixed $language): string
    {
        $value = strtolower(trim((string) $language));
        $value = match ($value) {
            'malay', 'melayu', 'bahasa', 'bahasa_melayu', 'bm' => 'ms',
            'english' => 'en',
            default => $value,
        };

        return in_array($value, self::LANGUAGES, true) ? $value : 'auto';
    }

    private function clip(string $value, int $max): string
    {
        $text = trim($value);
        if (mb_strlen($text) <= $max) {
            return $text;
        }

        return mb_substr($text, 0, $max)."\n…[truncated]";
    }

    /**
     * @param  array<string, mixed>  $usage
     */
    private function recordUsage(
        User $user,
        array $usage,
        bool $ok,
        ?string $errorMessage,
        ?string $inputText,
        ?string $outputText,
    ): void {
        try {
            LlmUsageRecorder::record(
                $user,
                $usage,
                self::FEATURE,
                null,
                $ok,
                $errorMessage,
                [
                    'provider' => 'openrouter',
                    'input_text' => $inputText,
                    'output_text' => $outputText,
                ],
            );
        } catch (Throwable) {
            // Usage logging must not block the draft.
        }
    }
}
