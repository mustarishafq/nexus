<?php

namespace App\Http\Controllers\Api\Nexus\V1;

use App\Http\Controllers\Controller;
use App\Services\Llm\OpenRouterClient;
use App\Services\SatelliteAi\CompletionService;
use App\Services\SatelliteAi\SatelliteAiException;
use App\Support\NexusSatelliteAuth;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;

class AiController extends Controller
{
    public function models(Request $request, OpenRouterClient $client): JsonResponse
    {
        $auth = NexusSatelliteAuth::authenticate($request, ['brain-ai']);
        if ($auth instanceof JsonResponse) {
            return $auth;
        }

        if (! $auth->ai_enabled) {
            return response()->json(['message' => 'This application is not enabled to use Brain as an AI provider.'], 403);
        }

        $id = $client->defaultModel();

        return response()->json([
            'data' => [[
                'id' => $id,
                'owned_by' => 'brain',
            ]],
        ]);
    }

    public function chatCompletions(Request $request, CompletionService $completions): JsonResponse
    {
        $auth = NexusSatelliteAuth::authenticate($request, ['brain-ai']);
        if ($auth instanceof JsonResponse) {
            return $auth;
        }

        try {
            [$payload, $attachments] = $this->parseRequest($request);
            $messages = $payload['messages'] ?? null;
            if (! is_array($messages) || $messages === []) {
                throw new SatelliteAiException('messages is required.', 422);
            }

            $options = [
                'model' => $payload['model'] ?? null,
                'response_format' => $payload['response_format'] ?? null,
                'temperature' => $payload['temperature'] ?? null,
                'max_tokens' => $payload['max_tokens'] ?? null,
            ];

            $inlineAttachments = $payload['attachments'] ?? [];
            if (! is_array($inlineAttachments)) {
                throw new SatelliteAiException('attachments must be an array.', 422);
            }

            $response = $completions->complete(
                $auth,
                array_values($messages),
                array_values([...$inlineAttachments, ...$attachments]),
                $options,
                NexusSatelliteAuth::actingUser($request, $auth, $payload),
            );
        } catch (SatelliteAiException $e) {
            return response()->json(['message' => $e->getMessage()], $e->status());
        }

        return response()->json($response);
    }

    /**
     * @return array{0: array<string, mixed>, 1: list<array<string, mixed>>}
     */
    private function parseRequest(Request $request): array
    {
        if ($request->isJson() || $request->header('Content-Type') === 'application/json') {
            $payload = $request->json()->all();

            return [is_array($payload) ? $payload : [], []];
        }

        $rawPayload = $request->input('payload');
        $payload = [];
        if (is_string($rawPayload) && $rawPayload !== '') {
            $decoded = json_decode($rawPayload, true);
            if (! is_array($decoded)) {
                throw new SatelliteAiException('payload must be JSON.', 422);
            }
            $payload = $decoded;
        } else {
            $payload = $request->except(['files', 'payload']);
        }

        $attachments = [];
        $files = $request->file('files', []);
        if ($files instanceof UploadedFile) {
            $files = [$files];
        }

        foreach ($files as $file) {
            if (! $file instanceof UploadedFile || ! $file->isValid()) {
                throw new SatelliteAiException('One or more uploaded files are invalid.', 422);
            }
            $binary = file_get_contents($file->getRealPath());
            if ($binary === false) {
                throw new SatelliteAiException('Could not read an uploaded file.', 422);
            }
            $attachments[] = [
                'filename' => $file->getClientOriginalName() ?: $file->getFilename(),
                'media_type' => $file->getMimeType() ?: 'application/octet-stream',
                'data' => base64_encode($binary),
            ];
        }

        return [$payload, $attachments];
    }
}
