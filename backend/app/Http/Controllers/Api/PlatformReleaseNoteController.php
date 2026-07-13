<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AppliesIndexQuery;
use App\Http\Controllers\Controller;
use App\Models\PlatformReleaseNote;
use App\Models\User;
use App\Support\ApiTokenAuth;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PlatformReleaseNoteController extends Controller
{
    use AppliesIndexQuery;

    public function index(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $canEdit = $this->canManage($user);
        $query = PlatformReleaseNote::query()
            ->with(['creator:id,name,full_name,email', 'items']);

        if (! $canEdit || $request->boolean('published_only')) {
            $query->where('is_published', true)
                ->whereNotNull('published_at')
                ->where('published_at', '<=', now());
        }

        $items = $this->applyIndexQuery(
            $request,
            $query,
            ['is_published', 'version'],
            '-published_at'
        )->get();

        $this->attachReadState($items, $user);

        return response()->json($items);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $readNoteIds = DB::table('user_platform_release_note_reads')
            ->where('user_id', $user->id)
            ->pluck('release_note_id')
            ->all();

        $count = PlatformReleaseNote::query()
            ->where('is_published', true)
            ->whereNotNull('published_at')
            ->where('published_at', '<=', now())
            ->when($readNoteIds !== [], fn ($q) => $q->whereNotIn('id', $readNoteIds))
            ->count();

        return response()->json(['count' => $count]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (! $this->canManage($user)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'version' => ['nullable', 'string', 'max:64'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.category' => ['required', Rule::in(PlatformReleaseNote::CATEGORIES)],
            'items.*.body' => ['required', 'string'],
            'is_published' => ['sometimes', 'boolean'],
            'published_at' => ['nullable', 'date'],
        ]);

        $isPublished = array_key_exists('is_published', $validated)
            ? (bool) $validated['is_published']
            : true;

        $publishedAt = $validated['published_at'] ?? null;
        if ($isPublished && ! $publishedAt) {
            $publishedAt = now();
        }
        if (! $isPublished) {
            $publishedAt = $validated['published_at'] ?? null;
        }

        $items = PlatformReleaseNote::normalizeItems($validated['items']);
        if ($items === []) {
            return response()->json([
                'message' => 'Add at least one detail with text.',
                'errors' => ['items' => ['Add at least one detail with text.']],
            ], 422);
        }

        $note = PlatformReleaseNote::create([
            'created_by_user_id' => $user->id,
            'title' => $validated['title'],
            'version' => $validated['version'] ?? null,
            'is_published' => $isPublished,
            'published_at' => $publishedAt,
        ]);
        $note->syncItems($items);

        $note->load(['creator:id,name,full_name,email', 'items']);
        $note->setAttribute('is_read', false);

        return response()->json($note, 201);
    }

    public function show(Request $request, PlatformReleaseNote $platformReleaseNote): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $canEdit = $this->canManage($user);
        if (! $canEdit && ! $this->isVisibleToReaders($platformReleaseNote)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $platformReleaseNote->load(['creator:id,name,full_name,email', 'items']);
        $this->attachReadState(collect([$platformReleaseNote]), $user);

        return response()->json($platformReleaseNote);
    }

    public function update(Request $request, PlatformReleaseNote $platformReleaseNote): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (! $this->canManage($user)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'version' => ['nullable', 'string', 'max:64'],
            'items' => ['sometimes', 'array', 'min:1'],
            'items.*.category' => ['required_with:items', Rule::in(PlatformReleaseNote::CATEGORIES)],
            'items.*.body' => ['required_with:items', 'string'],
            'is_published' => ['sometimes', 'boolean'],
            'published_at' => ['nullable', 'date'],
        ]);

        $items = null;
        if (array_key_exists('items', $validated)) {
            $items = PlatformReleaseNote::normalizeItems($validated['items']);
            if ($items === []) {
                return response()->json([
                    'message' => 'Add at least one detail with text.',
                    'errors' => ['items' => ['Add at least one detail with text.']],
                ], 422);
            }
            unset($validated['items']);
        }

        if (array_key_exists('is_published', $validated)) {
            $isPublished = (bool) $validated['is_published'];
            $validated['is_published'] = $isPublished;

            if ($isPublished && empty($validated['published_at']) && ! $platformReleaseNote->published_at) {
                $validated['published_at'] = now();
            }
        }

        $platformReleaseNote->update($validated);
        if ($items !== null) {
            $platformReleaseNote->syncItems($items);
        }

        $platformReleaseNote->load(['creator:id,name,full_name,email', 'items']);
        $this->attachReadState(collect([$platformReleaseNote]), $user);

        return response()->json($platformReleaseNote);
    }

    public function destroy(Request $request, PlatformReleaseNote $platformReleaseNote): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (! $this->canManage($user)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $platformReleaseNote->delete();

        return response()->json(null, 204);
    }

    public function markRead(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'release_note_ids' => ['nullable', 'array', 'min:1'],
            'release_note_ids.*' => ['integer', 'exists:platform_release_notes,id'],
        ]);

        $query = PlatformReleaseNote::query()
            ->where('is_published', true)
            ->whereNotNull('published_at')
            ->where('published_at', '<=', now());

        if (! empty($validated['release_note_ids'])) {
            $query->whereIn('id', $validated['release_note_ids']);
        }

        $notes = $query->get();
        $now = now();
        $marked = 0;

        foreach ($notes as $note) {
            $attached = $note->readers()->syncWithoutDetaching([
                $user->id => ['read_at' => $now],
            ]);

            if (($attached['attached'] ?? []) !== [] || ($attached['updated'] ?? []) !== []) {
                $marked++;
            }
        }

        return response()->json(['marked' => $marked]);
    }

    /**
     * @param  \Illuminate\Support\Collection<int, PlatformReleaseNote>  $notes
     */
    private function attachReadState($notes, User $user): void
    {
        if ($notes->isEmpty()) {
            return;
        }

        $readIds = DB::table('user_platform_release_note_reads')
            ->where('user_id', $user->id)
            ->whereIn('release_note_id', $notes->pluck('id')->all())
            ->pluck('release_note_id')
            ->map(fn ($id) => (int) $id)
            ->all();

        $readLookup = array_fill_keys($readIds, true);

        foreach ($notes as $note) {
            $note->setAttribute('is_read', isset($readLookup[(int) $note->id]));
        }
    }

    private function isVisibleToReaders(PlatformReleaseNote $note): bool
    {
        return $note->is_published
            && $note->published_at
            && $note->published_at->lte(now());
    }

    private function canManage(User $user): bool
    {
        return $user->role === 'admin';
    }
}
