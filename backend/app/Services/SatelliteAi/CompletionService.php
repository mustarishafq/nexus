<?php

namespace App\Services\SatelliteAi;

use App\Models\Application;
use App\Models\User;
use App\Services\Llm\LlmUsageRecorder;
use App\Services\Llm\OpenRouterClient;
use RuntimeException;
use Throwable;

class CompletionService
{
    public const FEATURE = 'satellite_ai';

    public function __construct(
        private OpenRouterClient $client,
        private AttachmentNormalizer $attachments,
    ) {}

    /**
     * @param  list<array<string, mixed>>  $messages
     * @param  list<array<string, mixed>>  $attachments
     * @param  array<string, mixed>  $options
     * @return array<string, mixed>
     */
    public function complete(Application $application, array $messages, array $attachments = [], array $options = [], ?User $user = null): array
    {
        if (! $application->ai_enabled) {
            throw new SatelliteAiException('This application is not enabled to use Brain as an AI provider.', 403);
        }

        if ($messages === []) {
            throw new SatelliteAiException('messages is required.', 422);
        }

        $requestedModel = isset($options['model']) ? trim((string) $options['model']) : '';
        $defaultModel = $this->client->defaultModel();
        if ($requestedModel !== '' && $requestedModel !== $defaultModel) {
            throw new SatelliteAiException('Satellites must use the Brain default model.', 422);
        }

        $messages = $this->attachments->merge($messages, $attachments);

        $chatOptions = [];
        if (isset($options['response_format']) && is_array($options['response_format'])) {
            $chatOptions['response_format'] = $options['response_format'];
        }
        if (array_key_exists('temperature', $options)) {
            $chatOptions['temperature'] = $options['temperature'];
        }
        if (array_key_exists('max_tokens', $options)) {
            $chatOptions['max_tokens'] = $options['max_tokens'];
        }

        $inputText = $this->flattenMessages($messages);

        try {
            $response = $this->client->chat($messages, [], $defaultModel, $chatOptions);
        } catch (SatelliteAiException $e) {
            $this->record($application, [], false, $e->getMessage(), $inputText, null, $user);
            throw $e;
        } catch (Throwable $e) {
            $message = $e instanceof RuntimeException ? $e->getMessage() : 'The AI provider request failed.';
            $this->record($application, [], false, $message, $inputText, null, $user);
            throw new SatelliteAiException($message, 502);
        }

        $output = (string) ($response['choices'][0]['message']['content'] ?? '');
        $usage = LlmUsageRecorder::extractFromResponse($response);
        $this->record($application, $usage, true, null, $inputText, $output, $user);

        return $response;
    }

    /**
     * @param  list<array<string, mixed>>  $messages
     */
    private function flattenMessages(array $messages): string
    {
        $chunks = [];
        foreach ($messages as $message) {
            $role = (string) ($message['role'] ?? 'user');
            $chunks[] = $role.': '.$this->attachments->stringifyContent($message['content'] ?? '');
        }

        return implode("\n\n", $chunks);
    }

    /**
     * @param  array<string, mixed>  $usage
     */
    private function record(
        Application $application,
        array $usage,
        bool $ok,
        ?string $error,
        ?string $input,
        ?string $output,
        ?User $user = null,
    ): void {
        LlmUsageRecorder::record(
            $user,
            $usage,
            self::FEATURE,
            $application->slug,
            $ok,
            $error,
            [
                'input_text' => $input,
                'output_text' => $output,
                'metadata' => ['application_id' => $application->id],
            ],
        );
    }
}
