<?php

namespace App\Services\Llm;

use App\Support\AppSettings;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

class OpenRouterClient
{
    private const MAX_PROVIDER_RETRIES = 1;

    /**
     * @param  list<array<string, mixed>>  $messages
     * @param  list<array<string, mixed>>  $tools
     * @return array<string, mixed>
     */
    public function chat(array $messages, array $tools = [], ?string $model = null): array
    {
        $apiKey = $this->resolveApiKey();

        if ($apiKey === '') {
            throw new RuntimeException(
                'OpenRouter is not configured. Add an API key in Settings → Admin → AI, or set OPENROUTER_API_KEY.'
            );
        }

        $baseUrl = rtrim((string) config('services.openrouter.base_url', 'https://openrouter.ai/api/v1'), '/');
        $model ??= $this->resolveModel();
        $timeout = max(10, (int) config('services.openrouter.timeout', 90));

        $payload = [
            'model' => $model,
            'messages' => $messages,
        ];

        if ($tools !== []) {
            $payload['tools'] = $tools;
            $payload['tool_choice'] = 'auto';
        }

        $headers = [
            'Authorization' => 'Bearer '.$apiKey,
            'Content-Type' => 'application/json',
        ];

        $referer = trim((string) config('services.openrouter.http_referer'));
        if ($referer !== '') {
            $headers['HTTP-Referer'] = $referer;
        }

        $title = trim((string) config('services.openrouter.app_title'));
        if ($title !== '') {
            $headers['X-Title'] = $title;
        }

        $attempt = 0;
        $lastException = null;

        while ($attempt <= self::MAX_PROVIDER_RETRIES) {
            $attempt++;

            try {
                $response = Http::withHeaders($headers)
                    ->timeout($timeout)
                    ->connectTimeout(min(15, $timeout))
                    ->acceptJson()
                    ->post("{$baseUrl}/chat/completions", $payload);

                if ($response->failed()) {
                    $message = $this->formatErrorMessage($response->json(), $response->status(), $response->body());

                    if ($this->isTransientProviderError($message, $response->status()) && $attempt <= self::MAX_PROVIDER_RETRIES) {
                        Log::warning('OpenRouter transient provider error; retrying.', [
                            'model' => $model,
                            'attempt' => $attempt,
                            'status' => $response->status(),
                            'message' => $message,
                        ]);
                        usleep(400_000 * $attempt);

                        continue;
                    }

                    throw new RuntimeException('OpenRouter request failed: '.$message);
                }

                $json = $response->json();

                if (! is_array($json)) {
                    throw new RuntimeException('OpenRouter returned an invalid response.');
                }

                if (isset($json['error'])) {
                    $message = $this->formatErrorMessage($json, $response->status());

                    if ($this->isTransientProviderError($message, $response->status()) && $attempt <= self::MAX_PROVIDER_RETRIES) {
                        Log::warning('OpenRouter transient provider error in body; retrying.', [
                            'model' => $model,
                            'attempt' => $attempt,
                            'message' => $message,
                        ]);
                        usleep(400_000 * $attempt);

                        continue;
                    }

                    throw new RuntimeException('OpenRouter request failed: '.$message);
                }

                return $json;
            } catch (RequestException $e) {
                $lastException = $e;
                $message = $this->formatErrorMessage($e->response?->json(), $e->response?->status(), $e->response?->body());

                if ($this->isTransientProviderError($message, $e->response?->status()) && $attempt <= self::MAX_PROVIDER_RETRIES) {
                    Log::warning('OpenRouter request exception; retrying.', [
                        'model' => $model,
                        'attempt' => $attempt,
                        'message' => $message,
                    ]);
                    usleep(400_000 * $attempt);

                    continue;
                }

                throw new RuntimeException('OpenRouter request failed: '.$message, previous: $e);
            }
        }

        throw new RuntimeException(
            'OpenRouter request failed after retries.',
            previous: $lastException
        );
    }

    private function resolveApiKey(): string
    {
        try {
            $fromSettings = trim((string) (AppSettings::row()?->openrouter_api_key ?? ''));
            if ($fromSettings !== '') {
                return $fromSettings;
            }
        } catch (Throwable) {
            // Fall back to env/config when settings are unavailable.
        }

        return trim((string) config('services.openrouter.api_key'));
    }

    private function resolveModel(): string
    {
        try {
            $fromSettings = trim((string) (AppSettings::row()?->openrouter_model ?? ''));
            if ($fromSettings !== '') {
                return $fromSettings;
            }
        } catch (Throwable) {
            // Fall back to env/config when settings are unavailable.
        }

        return (string) config('services.openrouter.default_model', 'openai/gpt-4o-mini');
    }

    private function formatErrorMessage(mixed $body, ?int $status = null, ?string $rawBody = null): string
    {
        $parts = [];

        if (is_array($body)) {
            $error = is_array($body['error'] ?? null) ? $body['error'] : $body;
            $message = (string) ($error['message'] ?? $body['message'] ?? '');
            if ($message !== '') {
                $parts[] = $message;
            }

            if (isset($error['code'])) {
                $parts[] = 'code '.$error['code'];
            }

            $metadata = is_array($error['metadata'] ?? null) ? $error['metadata'] : [];
            if (! empty($metadata['provider_name'])) {
                $parts[] = 'provider '.$metadata['provider_name'];
            }
            if (! empty($metadata['raw'])) {
                $raw = is_string($metadata['raw']) ? $metadata['raw'] : json_encode($metadata['raw']);
                $raw = trim((string) $raw);
                if ($raw !== '') {
                    $parts[] = mb_substr($raw, 0, 240);
                }
            }
        } elseif (is_string($rawBody) && trim($rawBody) !== '') {
            $parts[] = mb_substr(trim($rawBody), 0, 240);
        }

        if ($parts === []) {
            $parts[] = $status ? "HTTP {$status}" : 'Unknown error';
        } elseif ($status && $status >= 400) {
            array_unshift($parts, "HTTP {$status}");
        }

        $combined = implode(' — ', array_values(array_unique(array_filter($parts))));

        if (str_contains(strtolower($combined), 'provider returned error')) {
            $combined .= '. This free/provider model often fails on tool calls — try openai/gpt-4o-mini or another tool-capable model in Settings → AI.';
        }

        return $combined;
    }

    private function isTransientProviderError(string $message, ?int $status): bool
    {
        $lower = strtolower($message);

        if (in_array($status, [429, 502, 503, 504], true)) {
            return true;
        }

        return str_contains($lower, 'provider returned error')
            || str_contains($lower, 'temporarily unavailable')
            || str_contains($lower, 'timeout')
            || str_contains($lower, 'overloaded');
    }
}
