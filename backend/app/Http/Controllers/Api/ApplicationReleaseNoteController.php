<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AppliesIndexQuery;
use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\ApplicationReleaseNote;
use App\Models\User;
use App\Support\ApiTokenAuth;
use App\Support\UserApplicationAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ApplicationReleaseNoteController extends Controller
{
    use AppliesIndexQuery;

    public function index(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $applicationId = $request->query('application_id');

        if (! $applicationId) {
            return response()->json(['message' => 'application_id is required.'], 422);
        }

        $application = Application::query()->find($applicationId);

        if (! $application) {
            return response()->json(['message' => 'Application not found.'], 404);
        }

        if (! $this->canViewSystem($user, $application)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $canEdit = $this->canEditSystem($user, $application);
        $query = ApplicationReleaseNote::query()
            ->with(['creator:id,name,full_name,email', 'items'])
            ->where('application_id', $application->id);

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

    public function unreadCounts(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $visibleApplicationIds = $this->visibleApplicationIds($user);

        if ($visibleApplicationIds === []) {
            return response()->json(['counts' => (object) []]);
        }

        $readNoteIds = DB::table('user_application_release_note_reads')
            ->where('user_id', $user->id)
            ->pluck('release_note_id')
            ->all();

        $rows = ApplicationReleaseNote::query()
            ->selectRaw('application_id, COUNT(*) as unread_count')
            ->whereIn('application_id', $visibleApplicationIds)
            ->where('is_published', true)
            ->whereNotNull('published_at')
            ->where('published_at', '<=', now())
            ->when($readNoteIds !== [], fn ($q) => $q->whereNotIn('id', $readNoteIds))
            ->groupBy('application_id')
            ->get();

        $counts = [];
        foreach ($rows as $row) {
            $counts[(string) $row->application_id] = (int) $row->unread_count;
        }

        return response()->json(['counts' => $counts]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'application_id' => ['required', 'integer', 'exists:applications,id'],
            'title' => ['required', 'string', 'max:255'],
            'version' => ['nullable', 'string', 'max:64'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.category' => ['required', Rule::in(ApplicationReleaseNote::CATEGORIES)],
            'items.*.body' => ['required', 'string'],
            'is_published' => ['sometimes', 'boolean'],
            'published_at' => ['nullable', 'date'],
        ]);

        $application = Application::query()->findOrFail($validated['application_id']);

        if (! $this->canEditSystem($user, $application)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

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

        $items = ApplicationReleaseNote::normalizeItems($validated['items']);
        if ($items === []) {
            return response()->json([
                'message' => 'Add at least one detail with text.',
                'errors' => ['items' => ['Add at least one detail with text.']],
            ], 422);
        }

        $note = ApplicationReleaseNote::create([
            'application_id' => $application->id,
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

    public function show(Request $request, ApplicationReleaseNote $applicationReleaseNote): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $application = $applicationReleaseNote->application;

        if (! $application || ! $this->canViewSystem($user, $application)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $canEdit = $this->canEditSystem($user, $application);
        if (! $canEdit && ! $this->isVisibleToReaders($applicationReleaseNote)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $applicationReleaseNote->load(['creator:id,name,full_name,email', 'application:id,name,slug', 'items']);
        $this->attachReadState(collect([$applicationReleaseNote]), $user);

        return response()->json($applicationReleaseNote);
    }

    public function update(Request $request, ApplicationReleaseNote $applicationReleaseNote): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $application = $applicationReleaseNote->application;

        if (! $application || ! $this->canEditSystem($user, $application)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'version' => ['nullable', 'string', 'max:64'],
            'items' => ['sometimes', 'array', 'min:1'],
            'items.*.category' => ['required_with:items', Rule::in(ApplicationReleaseNote::CATEGORIES)],
            'items.*.body' => ['required_with:items', 'string'],
            'is_published' => ['sometimes', 'boolean'],
            'published_at' => ['nullable', 'date'],
        ]);

        $items = null;
        if (array_key_exists('items', $validated)) {
            $items = ApplicationReleaseNote::normalizeItems($validated['items']);
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

            if ($isPublished && empty($validated['published_at']) && ! $applicationReleaseNote->published_at) {
                $validated['published_at'] = now();
            }

            if (! $isPublished && ! array_key_exists('published_at', $validated)) {
                // Keep existing published_at for draft history; visibility uses is_published.
            }
        }

        $applicationReleaseNote->update($validated);
        if ($items !== null) {
            $applicationReleaseNote->syncItems($items);
        }

        $applicationReleaseNote->load(['creator:id,name,full_name,email', 'items']);
        $this->attachReadState(collect([$applicationReleaseNote]), $user);

        return response()->json($applicationReleaseNote);
    }

    public function destroy(Request $request, ApplicationReleaseNote $applicationReleaseNote): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $application = $applicationReleaseNote->application;

        if (! $application || ! $this->canEditSystem($user, $application)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $applicationReleaseNote->delete();

        return response()->json(null, 204);
    }

    public function markRead(Request $request): JsonResponse
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'application_id' => ['nullable', 'integer', 'exists:applications,id'],
            'release_note_ids' => ['nullable', 'array', 'min:1'],
            'release_note_ids.*' => ['integer', 'exists:application_release_notes,id'],
        ]);

        if (empty($validated['application_id']) && empty($validated['release_note_ids'])) {
            return response()->json([
                'message' => 'Provide application_id or release_note_ids.',
            ], 422);
        }

        $query = ApplicationReleaseNote::query()
            ->where('is_published', true)
            ->whereNotNull('published_at')
            ->where('published_at', '<=', now());

        if (! empty($validated['application_id'])) {
            $application = Application::query()->findOrFail($validated['application_id']);

            if (! $this->canViewSystem($user, $application)) {
                return response()->json(['message' => 'Forbidden'], 403);
            }

            $query->where('application_id', $application->id);
        }

        if (! empty($validated['release_note_ids'])) {
            $query->whereIn('id', $validated['release_note_ids']);
        }

        $notes = $query->with('application')->get();
        $now = now();
        $marked = 0;

        foreach ($notes as $note) {
            if (! $note->application || ! $this->canViewSystem($user, $note->application)) {
                continue;
            }

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
     * @param  \Illuminate\Support\Collection<int, ApplicationReleaseNote>  $notes
     */
    private function attachReadState($notes, User $user): void
    {
        if ($notes->isEmpty()) {
            return;
        }

        $readIds = DB::table('user_application_release_note_reads')
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

    private function isVisibleToReaders(ApplicationReleaseNote $note): bool
    {
        return $note->is_published
            && $note->published_at
            && $note->published_at->lte(now());
    }

    /**
     * @return array<int, int>
     */
    private function visibleApplicationIds(User $user): array
    {
        $query = Application::query();

        if ($user->role === 'admin') {
            return $query->pluck('id')->map(fn ($id) => (int) $id)->all();
        }

        $allowedPublicSlugs = UserApplicationAccess::allowedPublicSlugs($user);

        $query->where(function ($systems) use ($user, $allowedPublicSlugs) {
            $systems->where(function ($publicSystems) use ($allowedPublicSlugs) {
                $publicSystems->where('visibility', 'public');
                if ($allowedPublicSlugs !== null) {
                    if (count($allowedPublicSlugs) === 0) {
                        $publicSystems->whereRaw('1 = 0');
                    } else {
                        $publicSystems->whereIn('slug', $allowedPublicSlugs);
                    }
                }
            })->orWhere(function ($privateSystems) use ($user) {
                $privateSystems
                    ->where('visibility', 'private')
                    ->where(function ($privateAccess) use ($user) {
                        $privateAccess
                            ->where('created_by_user_id', $user->id)
                            ->orWhereHas('privateAccessEmails', fn ($emailQuery) => $emailQuery->where('email', $user->email));
                    });
            });
        });

        return $query->pluck('id')->map(fn ($id) => (int) $id)->all();
    }

    private function canEditSystem(User $user, Application $application): bool
    {
        if ($user->role === 'admin') {
            return true;
        }

        return (int) $application->created_by_user_id === (int) $user->id;
    }

    private function canViewSystem(User $user, Application $application): bool
    {
        if ($user->role === 'admin') {
            return true;
        }

        if ($application->visibility === 'private') {
            if ((int) $application->created_by_user_id === (int) $user->id) {
                return true;
            }

            $application->loadMissing('privateAccessEmails');
            $allowedEmails = $application->privateAllowedEmailsList();

            return in_array($user->email, $allowedEmails, true);
        }

        $allowedPublicSlugs = UserApplicationAccess::allowedPublicSlugs($user);

        if ($allowedPublicSlugs === null) {
            return true;
        }

        return in_array($application->slug, $allowedPublicSlugs, true);
    }
}
