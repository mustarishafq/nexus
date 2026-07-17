<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AppliesIndexQuery;
use App\Http\Controllers\Api\Concerns\AuthorizesRoles;
use App\Http\Controllers\Api\Concerns\ResolvesCompanyInput;
use App\Http\Controllers\Api\Concerns\ResolvesDepartmentInput;
use App\Http\Controllers\Api\Concerns\ValidatesHrProfileFields;
use App\Http\Controllers\Controller;
use App\Models\AccessGroup;
use App\Models\Department;
use App\Models\User;
use App\Services\ProfileNudgeService;
use App\Services\UserPresenceService;
use App\Support\ApiTokenAuth;
use App\Support\McpUserAccess;
use App\Support\ProfileCompleteness;
use App\Support\SyncUserProfileRecords;
use App\Support\UserHrCsvImporter;
use App\Support\UserProfileSerializer;
use App\Support\UserRoles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class UserController extends Controller
{
    use AppliesIndexQuery;
    use AuthorizesRoles;
    use ResolvesCompanyInput;
    use ResolvesDepartmentInput;
    use ValidatesHrProfileFields;

    public function index(Request $request): JsonResponse
    {
        if ($response = $this->authorizeHrOrAdmin($request)) {
            return $response;
        }

        $validated = $request->validate([
            'role' => ['nullable', 'string', Rule::in(UserRoles::ALL)],
            'status' => ['nullable', 'string', Rule::in(['approved', 'pending'])],
            'login' => ['nullable', 'string', Rule::in(['never', 'has_logged_in', 'last_7_days', 'last_30_days'])],
            'profile' => ['nullable', 'string', Rule::in(['incomplete', 'complete'])],
            'q' => ['nullable', 'string', 'max:255'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'sort' => ['nullable', 'string', 'max:50'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:200'],
            'email' => ['nullable', 'string', 'max:255'],
        ]);

        $query = User::query()
            ->with(['accessGroups', 'department', 'company', 'manager', 'educations', 'workExperiences'])
            ->withExists('pushSubscriptions');

        $this->applyAdminUserFilters($query, $validated);

        $wantsPagination = $request->has('page') || $request->has('per_page');

        if ($wantsPagination) {
            $perPage = max(1, min((int) ($validated['per_page'] ?? 20), 100));
            $page = max(1, (int) ($validated['page'] ?? 1));

            $sort = (string) ($validated['sort'] ?? '-created_date');
            $this->applyIndexSort($query, $sort);

            $statsQuery = User::query();

            $paginator = $query->paginate($perPage, ['*'], 'page', $page);

            return response()->json([
                'data' => $paginator->getCollection()
                    ->map(fn (User $user) => $this->adminUserPayload($user))
                    ->values(),
                'meta' => [
                    'total' => $paginator->total(),
                    'page' => $paginator->currentPage(),
                    'per_page' => $paginator->perPage(),
                    'last_page' => $paginator->lastPage(),
                    'stats' => [
                        'total' => (clone $statsQuery)->count(),
                        'admins' => (clone $statsQuery)->where('role', UserRoles::ADMIN)->count(),
                        'hr' => (clone $statsQuery)->where('role', UserRoles::HR)->count(),
                        'approved' => (clone $statsQuery)->where('is_approved', true)->count(),
                        'pending' => (clone $statsQuery)->where('is_approved', false)->count(),
                        'incomplete_profiles' => (clone $statsQuery)
                            ->where('is_approved', true)
                            ->tap(fn ($builder) => $this->applyProfileCompletenessFilter($builder, 'incomplete'))
                            ->count(),
                    ],
                ],
            ]);
        }

        $users = $this->applyIndexQuery(
            $request,
            $query,
            ['role', 'email'],
            '-created_date',
            50,
            200,
        )->get();

        return response()->json(
            $users->map(fn (User $user) => $this->adminUserPayload($user))->values()
        );
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function applyAdminUserFilters($query, array $filters): void
    {
        if (! empty($filters['role'])) {
            $query->where('role', $filters['role']);
        }

        if (! empty($filters['email'])) {
            $query->where('email', $filters['email']);
        }

        if (($filters['status'] ?? null) === 'approved') {
            $query->where('is_approved', true);
        } elseif (($filters['status'] ?? null) === 'pending') {
            $query->where('is_approved', false);
        }

        if (($filters['login'] ?? null) === 'never') {
            $query->whereNull('last_login_at');
        } elseif (($filters['login'] ?? null) === 'has_logged_in') {
            $query->whereNotNull('last_login_at');
        } elseif (($filters['login'] ?? null) === 'last_7_days') {
            $query->where('last_login_at', '>=', now()->subDays(7));
        } elseif (($filters['login'] ?? null) === 'last_30_days') {
            $query->where('last_login_at', '>=', now()->subDays(30));
        }

        if (! empty($filters['q'])) {
            $search = trim((string) $filters['q']);
            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('full_name', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('employee_id', 'like', "%{$search}%");
            });
        }

        if (! empty($filters['profile'])) {
            $this->applyProfileCompletenessFilter($query, (string) $filters['profile']);
        }
    }

    private function applyProfileCompletenessFilter($query, string $profile): void
    {
        $complete = function ($builder): void {
            $builder
                ->whereNotNull('profile_picture')
                ->where('profile_picture', '!=', '')
                ->whereNotNull('cover_picture')
                ->where('cover_picture', '!=', '')
                ->whereRaw("TRIM(COALESCE(name, '')) != ''")
                ->whereRaw("TRIM(COALESCE(full_name, '')) != ''")
                ->whereRaw("TRIM(COALESCE(bio, '')) != ''")
                ->whereNotNull('department_id')
                ->whereRaw("TRIM(COALESCE(work_phone, '')) != ''")
                ->whereNotNull('date_of_birth')
                ->whereNotNull('joined_at')
                ->where(function ($inner) {
                    $inner->whereHas('educations')->orWhereHas('workExperiences');
                })
                ->whereRaw("TRIM(COALESCE(gender, '')) != ''")
                ->whereRaw("TRIM(COALESCE(nationality, '')) != ''")
                ->whereRaw("TRIM(COALESCE(ic_number, '')) != ''")
                ->whereRaw("TRIM(COALESCE(current_address, '')) != ''")
                ->whereRaw("TRIM(COALESCE(emergency_contact_name, '')) != ''")
                ->whereRaw("TRIM(COALESCE(emergency_contact_phone, '')) != ''")
                ->whereRaw("TRIM(COALESCE(next_of_kin_relationship, '')) != ''");
        };

        if ($profile === 'complete') {
            $complete($query);

            return;
        }

        if ($profile === 'incomplete') {
            $query->where(function ($builder) use ($complete) {
                $builder->whereNot(function ($inner) use ($complete) {
                    $complete($inner);
                });
            });
        }
    }

    private function applyIndexSort($query, string $sort): void
    {
        if ($sort === '') {
            $query->orderByDesc('created_at');

            return;
        }

        $direction = 'asc';
        $column = $sort;

        if (str_starts_with($sort, '-')) {
            $direction = 'desc';
            $column = ltrim($sort, '-');
        }

        $column = match ($column) {
            'created_date' => 'created_at',
            'updated_date' => 'updated_at',
            default => $column,
        };

        $table = $query->getModel()->getTable();
        if (Schema::hasColumn($table, $column)) {
            $query->orderBy($column, $direction);
        } else {
            $query->orderByDesc('created_at');
        }
    }

    public function exportCsv(Request $request): StreamedResponse|JsonResponse
    {
        if ($response = $this->authorizeHrOrAdmin($request)) {
            return $response;
        }

        $validated = $request->validate([
            'role' => ['nullable', 'string', Rule::in(UserRoles::ALL)],
            'status' => ['nullable', 'string', Rule::in(['approved', 'pending'])],
            'login' => ['nullable', 'string', Rule::in(['never', 'has_logged_in', 'last_7_days', 'last_30_days'])],
            'q' => ['nullable', 'string', 'max:255'],
        ]);

        $query = User::query()
            ->with(['accessGroups', 'department', 'company', 'manager:id,email,full_name,name', 'educations', 'workExperiences'])
            ->orderBy('full_name')
            ->orderBy('email');

        if (! empty($validated['role'])) {
            $query->where('role', $validated['role']);
        }

        if (($validated['status'] ?? null) === 'approved') {
            $query->where('is_approved', true);
        } elseif (($validated['status'] ?? null) === 'pending') {
            $query->where('is_approved', false);
        }

        if (($validated['login'] ?? null) === 'never') {
            $query->whereNull('last_login_at');
        } elseif (($validated['login'] ?? null) === 'has_logged_in') {
            $query->whereNotNull('last_login_at');
        } elseif (($validated['login'] ?? null) === 'last_7_days') {
            $query->where('last_login_at', '>=', now()->subDays(7));
        } elseif (($validated['login'] ?? null) === 'last_30_days') {
            $query->where('last_login_at', '>=', now()->subDays(30));
        }

        if (! empty($validated['q'])) {
            $search = trim($validated['q']);
            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('full_name', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('employee_id', 'like', "%{$search}%");
            });
        }

        $filename = 'users-'.now()->format('Y-m-d-His').'.csv';

        return response()->streamDownload(function () use ($query) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, [
                'ID',
                'Full Name',
                'Email',
                'Role',
                'Approved',
                'Job Title',
                'Employee ID',
                'Employment Type',
                'Company',
                'Department',
                'Manager Email',
                'Work Phone',
                'Personal Phone',
                'Location',
                'Gender',
                'Date of Birth',
                'Joined At',
                'MCP Access',
                'Access Groups',
                'Profile Completeness %',
                'Last Login',
                'Created At',
            ]);

            foreach ($query->lazy(500) as $user) {
                $completeness = ProfileCompleteness::forUser($user);

                fputcsv($handle, [
                    $user->id,
                    $user->full_name ?: $user->name,
                    $user->email,
                    $user->role,
                    $user->is_approved ? 'yes' : 'no',
                    $user->job_title,
                    $user->employee_id,
                    $user->employment_type,
                    $user->company?->name,
                    $user->department?->name,
                    $user->manager?->email,
                    $user->work_phone,
                    $user->personal_phone,
                    $user->location,
                    $user->gender,
                    $user->date_of_birth?->format('Y-m-d'),
                    $user->joined_at?->format('Y-m-d'),
                    $user->mcp_access,
                    $user->accessGroups->pluck('name')->sort()->implode('; '),
                    $completeness['percent'] ?? 0,
                    $user->last_login_at?->toISOString() ?: 'Never login',
                    $user->created_at?->toISOString(),
                ]);
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv',
        ]);
    }

    public function profileNudge(Request $request, User $user): JsonResponse
    {
        if ($response = $this->authorizeHrOrAdmin($request)) {
            return $response;
        }

        $admin = $this->authenticatedUser($request);
        $validated = $request->validate([
            'force' => ['sometimes', 'boolean'],
        ]);

        $result = app(ProfileNudgeService::class)->nudge(
            $user->load(['department', 'educations', 'workExperiences']),
            $admin,
            (bool) ($validated['force'] ?? false)
        );

        if (! $result['sent']) {
            return response()->json([
                'message' => $result['reason'],
                'completeness' => $result['completeness'] ?? null,
            ], 422);
        }

        return response()->json([
            'message' => 'Profile reminder sent.',
            'notification' => $result['notification'],
            'completeness' => $result['completeness'],
        ]);
    }

    public function nudgeIncompleteProfiles(Request $request): JsonResponse
    {
        if ($response = $this->authorizeHrOrAdmin($request)) {
            return $response;
        }

        $admin = $this->authenticatedUser($request);
        $validated = $request->validate([
            'force' => ['sometimes', 'boolean'],
        ]);

        $result = app(ProfileNudgeService::class)->nudgeIncompleteUsers(
            $admin,
            (bool) ($validated['force'] ?? false)
        );

        return response()->json([
            'message' => "Sent {$result['sent']} profile reminder(s).",
            ...$result,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function publicUserProfile(User $user): array
    {
        return app(UserPresenceService::class)->enrichPayload(
            UserProfileSerializer::publicProfile($user)
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function privateUserProfile(User $user): array
    {
        return app(UserPresenceService::class)->enrichPayload(
            UserProfileSerializer::privateProfile($user)
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function publicUserSummary(User $user): array
    {
        return app(UserPresenceService::class)->enrichPayload([
            'id' => $user->id,
            'name' => $user->displayName(),
            'email' => $user->email,
            'profile_picture' => $user->profile_picture,
            'role' => $user->role,
            'department_id' => $user->department_id,
            'department' => $user->department?->name,
            'job_title' => $user->job_title,
            'location' => $user->location,
        ]);
    }

    public function orgChart(Request $request): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'department_id' => ['sometimes', 'nullable', 'integer', 'exists:departments,id'],
        ]);

        $departmentId = isset($validated['department_id']) ? (int) $validated['department_id'] : null;

        $users = $this->filterUsersInOrgStructure($this->orgChartUsers($departmentId));

        $nodesById = $users->keyBy('id');
        $childrenByManager = [];

        foreach ($users as $user) {
            $managerId = $user->manager_id;
            if ($managerId !== null && ! $nodesById->has($managerId)) {
                $managerId = null;
            }

            $childrenByManager[$managerId ?? 0][] = $user->id;
        }

        $buildBranch = function (?int $managerKey) use (&$buildBranch, $childrenByManager, $nodesById): array {
            $childIds = $childrenByManager[$managerKey ?? 0] ?? [];

            return collect($childIds)
                ->map(function (int $userId) use (&$buildBranch, $nodesById) {
                    $user = $nodesById->get($userId);
                    if (! $user) {
                        return null;
                    }

                    return [
                        'user' => UserProfileSerializer::orgChartNode($user),
                        'reports' => $buildBranch($user->id),
                    ];
                })
                ->filter()
                ->values()
                ->all();
        };

        $departments = Department::query()
            ->whereHas('users', fn ($query) => $query->where('is_approved', true))
            ->orderBy('name')
            ->get(['id', 'name']);

        if ($departmentId !== null) {
            $department = Department::query()->find($departmentId);

            return response()->json([
                'department' => $department ? ['id' => $department->id, 'name' => $department->name] : null,
                'departments' => $departments,
                'tree' => $this->enrichOrgChartTree($buildBranch(null)),
            ]);
        }

        return response()->json([
            'department' => null,
            'departments' => $departments,
            'tree' => $this->enrichOrgChartTree($buildBranch(null)),
        ]);
    }

    /**
     * @param  array<int, array<string, mixed>>  $branches
     * @return array<int, array<string, mixed>>
     */
    private function enrichOrgChartTree(array $branches): array
    {
        $presence = app(UserPresenceService::class);

        return collect($branches)
            ->map(function (array $branch) use ($presence) {
                if (isset($branch['user']) && is_array($branch['user'])) {
                    $branch['user'] = $presence->enrichPayload($branch['user']);
                }

                if (! empty($branch['reports'])) {
                    $branch['reports'] = $this->enrichOrgChartTree($branch['reports']);
                }

                return $branch;
            })
            ->values()
            ->all();
    }

    public function search(Request $request): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'q' => ['required', 'string', 'min:1', 'max:100'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:20'],
        ]);

        $term = trim($validated['q']);
        $limit = (int) ($validated['limit'] ?? 10);

        $users = User::query()
            ->with('department')
            ->where('is_approved', true)
            ->matchingSearch($term)
            ->orderBy('name')
            ->orderBy('full_name')
            ->limit($limit)
            ->get(['id', 'full_name', 'name', 'email', 'profile_picture', 'role', 'department_id', 'location', 'job_title']);

        return response()->json(
            $users->map(fn (User $user) => $this->publicUserSummary($user))->values()
        );
    }

    public function directory(Request $request): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'q' => ['sometimes', 'nullable', 'string', 'max:100'],
            'department_id' => ['sometimes', 'nullable', 'integer', 'exists:departments,id'],
            'access_group_id' => ['sometimes', 'nullable', 'integer', 'exists:access_groups,id'],
            'sort' => ['sometimes', 'string', Rule::in(['full_name', '-full_name', 'joined_at', '-joined_at'])],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $term = trim((string) ($validated['q'] ?? ''));
        $departmentId = isset($validated['department_id']) ? (int) $validated['department_id'] : null;
        $accessGroupId = isset($validated['access_group_id']) ? (int) $validated['access_group_id'] : null;
        $sort = $validated['sort'] ?? 'full_name';
        $limit = (int) ($validated['limit'] ?? 50);

        $query = User::query()
            ->with(['accessGroups', 'department', 'company', 'manager.department', 'educations', 'workExperiences', 'userSkills'])
            ->where('is_approved', true);

        if ($term !== '') {
            $query->matchingSearch($term);
        }

        if ($departmentId !== null) {
            $query->where('department_id', $departmentId);
        }

        if ($accessGroupId !== null) {
            $query->whereHas('accessGroups', fn ($builder) => $builder->where('access_groups.id', $accessGroupId));
        }

        $direction = str_starts_with($sort, '-') ? 'desc' : 'asc';
        $column = ltrim($sort, '-');
        $query->orderBy($column, $direction)->orderBy('full_name');

        $users = $query->limit($limit)->get();

        $departments = Department::query()
            ->orderBy('name')
            ->get(['id', 'name'])
            ->values();

        $accessGroups = AccessGroup::query()
            ->whereHas('users', fn ($builder) => $builder->where('is_approved', true))
            ->orderBy('name')
            ->get(['id', 'name'])
            ->values();

        return response()->json([
            'users' => $users->map(fn (User $user) => $this->publicUserProfile($user))->values(),
            'departments' => $departments,
            'access_groups' => $accessGroups,
            'total' => $users->count(),
        ]);
    }

    public function roster(Request $request): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $users = User::query()
            ->with('department')
            ->where('is_approved', true)
            ->orderBy('full_name')
            ->orderBy('name')
            ->get(['id', 'full_name', 'name', 'email', 'profile_picture', 'role', 'department_id', 'job_title']);

        $payloads = $users
            ->map(fn (User $user) => $this->publicUserSummary($user))
            ->values()
            ->all();

        return response()->json([
            'users' => app(UserPresenceService::class)->enrichPayloads($payloads),
            'total' => count($payloads),
        ]);
    }

    public function profile(Request $request, User $user): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (! $user->is_approved) {
            return response()->json(['message' => 'User not found.'], 404);
        }

        $user->load(['accessGroups', 'department', 'company', 'manager.department', 'educations', 'workExperiences', 'userSkills']);

        $payload = UserRoles::isHrOrAdmin($viewer)
            ? $this->privateUserProfile($user)
            : $this->publicUserProfile($user);

        return response()->json([
            'user' => $payload,
        ]);
    }

    public function show(User $user): JsonResponse
    {
        return response()->json($user);
    }

    public function store(Request $request): JsonResponse
    {
        if ($response = $this->authorizeHrOrAdmin($request)) {
            return $response;
        }

        $actor = $this->authenticatedUser($request);

        $validated = $request->validate([
            'full_name' => ['required', 'string', 'max:255'],
            'email'     => ['sometimes', 'nullable', 'email', 'max:255', 'unique:users,email'],
            'password'  => ['required', 'string', 'min:8'],
            'role'      => ['sometimes', 'string', Rule::in(UserRoles::ALL)],
            'mcp_access' => ['sometimes', 'string', Rule::in(McpUserAccess::LEVELS)],
            'access_group_ids' => ['sometimes', 'array'],
            'access_group_ids.*' => ['integer', 'exists:access_groups,id'],
            'is_approved' => ['sometimes', 'boolean'],
            'date_of_birth' => ['sometimes', 'nullable', 'date'],
            'joined_at' => ['sometimes', 'nullable', 'date'],
            'company_id' => ['sometimes', 'nullable', 'integer', 'exists:companies,id'],
            'company' => ['sometimes', 'nullable', 'string', 'max:100'],
        ]);

        $groupIds = $validated['access_group_ids'] ?? null;
        unset($validated['access_group_ids']);

        $role = $validated['role'] ?? UserRoles::USER;
        if ($actor && UserRoles::isHr($actor) && ! UserRoles::isAdmin($actor)) {
            $role = UserRoles::USER;
            $groupIds = null;
            unset($validated['mcp_access']);
        }

        $validated = $this->resolveCompanyFields($validated);

        $user = User::create([
            'name'                   => '',
            'full_name'              => $validated['full_name'],
            'email'                  => $validated['email'] ?? null,
            'password'               => Hash::make($validated['password']),
            'role'                   => $role,
            'mcp_access'             => $validated['mcp_access'] ?? McpUserAccess::NONE,
            'is_approved'            => $validated['is_approved'] ?? true,
            'force_password_change'  => true,
            'company_id'             => $validated['company_id'] ?? null,
        ]);

        if ($groupIds !== null) {
            $user->accessGroups()->sync($groupIds);
        }

        return response()->json($user->load(['accessGroups', 'company']), 201);
    }

    /**
     * Bulk-create users from a CSV upload.
     * Expected CSV columns: full_name, email (nullable), password (optional), role (optional), is_approved (optional)
     * 
     * Features:
     * - Batch processing to avoid memory issues
     * - Full error tracking and reporting
     * - Nullable email support
     * - Transactional safety per batch
     */
    public function importCsv(Request $request): JsonResponse
    {
        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }

        $request->validate([
            'file' => ['required', 'file', 'mimetypes:text/plain,text/csv,application/csv,application/vnd.ms-excel'],
        ]);

        try {
            $file    = $request->file('file');
            $handle  = fopen($file->getRealPath(), 'r');
            if (!$handle) {
                return response()->json([
                    'created' => [],
                    'errors'  => ['Failed to open file'],
                    'count'   => 0,
                ], 400);
            }

            $headers = array_map('trim', fgetcsv($handle));
            if (!$headers) {
                fclose($handle);
                return response()->json([
                    'created' => [],
                    'errors'  => ['Empty CSV file or invalid format'],
                    'count'   => 0,
                ], 400);
            }

            $created = [];
            $errors  = [];
            $batch   = [];
            $row     = 1;
            $batchSize = 100; // Process 100 users at a time

            while (($data = fgetcsv($handle)) !== false) {
                $row++;
                
                // Skip empty rows
                if (empty(array_filter($data))) {
                    continue;
                }

                try {
                    $record = array_combine($headers, array_map('trim', $data));
                    if ($record === false) {
                        $errors[] = "Row {$row}: CSV column count mismatch";
                        continue;
                    }

                    // Validate required fields
                    if (empty($record['full_name'])) {
                        $errors[] = "Row {$row}: missing full_name";
                        continue;
                    }

                    // Email is optional now, but if provided must be unique
                    $email = $record['email'] ?? null;
                    if ($email) {
                        $email = trim($email);
                        if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                            $errors[] = "Row {$row}: invalid email format '{$email}'";
                            continue;
                        }

                        if (User::where('email', $email)->exists()) {
                            $errors[] = "Row {$row}: email '{$email}' already exists";
                            continue;
                        }
                    }

                    $password = !empty($record['password']) ? trim($record['password']) : 'Password@123';

                    // Add to batch
                    $batch[] = [
                        'name'                   => '',
                        'full_name'              => $record['full_name'],
                        'email'                  => $email,
                        'password'               => Hash::make($password),
                        'role'                   => $record['role'] ?? 'user',
                        'is_approved'            => isset($record['is_approved']) ? filter_var($record['is_approved'], FILTER_VALIDATE_BOOLEAN) : true,
                        'force_password_change'  => true,
                        'created_at'             => now(),
                        'updated_at'             => now(),
                    ];

                    // Execute batch if it reaches batch size
                    if (count($batch) >= $batchSize) {
                        $insertedCount = $this->insertBatch($batch, $created, $errors);
                        $batch = [];
                    }
                } catch (\Exception $e) {
                    $errors[] = "Row {$row}: " . $e->getMessage();
                }
            }

            // Insert remaining batch
            if (!empty($batch)) {
                $this->insertBatch($batch, $created, $errors);
            }

            fclose($handle);

            return response()->json([
                'created' => $created,
                'errors'  => $errors,
                'count'   => count($created),
                'total_rows' => $row - 1,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'created' => [],
                'errors'  => ['Import failed: ' . $e->getMessage()],
                'count'   => 0,
            ], 500);
        }
    }

    /**
     * Bulk HR onboarding: create new users or update existing users matched by email.
     */
    public function importHrOnboardingCsv(Request $request): JsonResponse
    {
        if ($response = $this->authorizeHrOrAdmin($request)) {
            return $response;
        }

        $request->validate([
            'file' => ['required', 'file', 'mimetypes:text/plain,text/csv,application/csv,application/vnd.ms-excel'],
        ]);

        try {
            $result = (new UserHrCsvImporter())->import($request->file('file')->getRealPath());

            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json([
                'created' => [],
                'updated' => [],
                'errors' => ['Import failed: '.$e->getMessage()],
                'count' => 0,
            ], 500);
        }
    }

    /**
     * Bulk-assign access groups to existing users from a CSV upload.
     * Expected columns: email, access_group
     * access_group values are matched to access group names.
     */
    public function assignAccessGroupsCsv(Request $request): JsonResponse
    {
        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }

        $request->validate([
            'file' => ['required', 'file', 'mimetypes:text/plain,text/csv,application/csv,application/vnd.ms-excel'],
        ]);

        try {
            $file = $request->file('file');
            $handle = fopen($file->getRealPath(), 'r');
            if (!$handle) {
                return response()->json([
                    'updated' => [],
                    'errors' => ['Failed to open file'],
                    'count' => 0,
                ], 400);
            }

            $headers = array_map(
                fn ($header) => strtolower(trim((string) $header)),
                fgetcsv($handle) ?: []
            );
            if (!$headers) {
                fclose($handle);

                return response()->json([
                    'updated' => [],
                    'errors' => ['Empty CSV file or invalid format'],
                    'count' => 0,
                ], 400);
            }

            $emailIndex = array_search('email', $headers, true);
            $groupIndex = array_search('access_group', $headers, true);

            if ($emailIndex === false || $groupIndex === false) {
                fclose($handle);

                return response()->json([
                    'updated' => [],
                    'errors' => ['CSV must include email and access_group columns'],
                    'count' => 0,
                ], 400);
            }

            $groupsByName = AccessGroup::query()
                ->get()
                ->keyBy(fn (AccessGroup $group) => strtolower(trim($group->name)));

            $updated = [];
            $errors = [];
            $row = 1;

            while (($data = fgetcsv($handle)) !== false) {
                $row++;

                if (empty(array_filter($data))) {
                    continue;
                }

                $email = trim((string) ($data[$emailIndex] ?? ''));
                $groupName = trim((string) ($data[$groupIndex] ?? ''));

                if ($email === '') {
                    $errors[] = "Row {$row}: missing email";
                    continue;
                }

                if ($groupName === '') {
                    $errors[] = "Row {$row}: missing access_group for '{$email}'";
                    continue;
                }

                $user = User::where('email', $email)->first();
                if (!$user) {
                    $errors[] = "Row {$row}: user not found for email '{$email}'";
                    continue;
                }

                $group = $groupsByName->get(strtolower($groupName));
                if (!$group) {
                    $errors[] = "Row {$row}: access group '{$groupName}' not found for '{$email}'";
                    continue;
                }

                $user->accessGroups()->sync([$group->id]);
                $updated[] = [
                    'email' => $email,
                    'access_group' => $group->name,
                ];
            }

            fclose($handle);

            return response()->json([
                'updated' => $updated,
                'errors' => $errors,
                'count' => count($updated),
                'total_rows' => $row - 1,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'updated' => [],
                'errors' => ['Import failed: ' . $e->getMessage()],
                'count' => 0,
            ], 500);
        }
    }

    /**
     * Helper method to insert a batch of users
     */
    private function insertBatch(array $batch, array &$created, array &$errors): int
    {
        try {
            $inserted = 0;
            foreach ($batch as $userData) {
                try {
                    $user = User::create($userData);
                    $created[] = $user->email ?? $user->name;
                    $inserted++;
                } catch (\Exception $e) {
                    $errors[] = "Failed to create user '{$userData['full_name']}': " . $e->getMessage();
                }
            }
            return $inserted;
        } catch (\Exception $e) {
            $errors[] = "Batch insert error: " . $e->getMessage();
            return 0;
        }
    }

    public function update(Request $request, User $user): JsonResponse
    {
        if ($response = $this->authorizeHrOrAdmin($request)) {
            return $response;
        }

        $actor = $this->authenticatedUser($request);

        if ($actor && UserRoles::isHr($actor) && ! UserRoles::isAdmin($actor) && UserRoles::hasRole($user, [UserRoles::ADMIN, UserRoles::HR])) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate(array_merge([
            'name' => ['sometimes', 'string', 'max:255'],
            'full_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'role' => ['sometimes', 'string', Rule::in(UserRoles::ALL)],
            'mcp_access' => ['sometimes', 'string', Rule::in(McpUserAccess::LEVELS)],
            'access_group_ids' => ['sometimes', 'array'],
            'access_group_ids.*' => ['integer', 'exists:access_groups,id'],
            'is_approved' => ['sometimes', 'boolean'],
            'notification_settings' => ['sometimes', 'nullable', 'array'],
            'password' => ['sometimes', 'string', 'min:8'],
            'date_of_birth' => ['sometimes', 'nullable', 'date'],
            'joined_at' => ['sometimes', 'nullable', 'date'],
            'bio' => ['sometimes', 'nullable', 'string', 'max:500'],
            'department_id' => ['sometimes', 'nullable', 'integer', 'exists:departments,id'],
            'department' => ['sometimes', 'nullable', 'string', 'max:100'],
            'company_id' => ['sometimes', 'nullable', 'integer', 'exists:companies,id'],
            'company' => ['sometimes', 'nullable', 'string', 'max:100'],
            'location' => ['sometimes', 'nullable', 'string', 'max:100'],
            'skills' => ['sometimes', 'nullable', 'array', 'max:10'],
            'skills.*' => ['string', 'max:50'],
            'ask_me_about' => ['sometimes', 'nullable', 'string', 'max:200'],
            'job_title' => ['sometimes', 'nullable', 'string', 'max:150'],
            'work_phone' => ['sometimes', 'nullable', 'string', 'max:30'],
            'personal_phone' => ['sometimes', 'nullable', 'string', 'max:30'],
            'personal_phone_visible' => ['sometimes', 'boolean'],
            'manager_id' => ['sometimes', 'nullable', 'integer', 'exists:users,id'],
            'employee_id' => ['sometimes', 'nullable', 'string', 'max:50'],
            'employment_type' => ['sometimes', 'nullable', 'string', Rule::in(['full_time', 'part_time', 'contract'])],
            'emergency_contact_name' => ['sometimes', 'nullable', 'string', 'max:150'],
            'emergency_contact_phone' => ['sometimes', 'nullable', 'string', 'max:30'],
            'gender' => ['sometimes', 'nullable', 'string', 'max:30'],
            'education_history' => ['sometimes', 'nullable', 'array', 'max:10'],
            'education_history.*.institution' => ['required_with:education_history', 'string', 'max:150'],
            'education_history.*.qualification' => ['sometimes', 'nullable', 'string', 'max:150'],
            'education_history.*.field_of_study' => ['sometimes', 'nullable', 'string', 'max:150'],
            'education_history.*.year_from' => ['sometimes', 'nullable', 'string', 'max:10'],
            'education_history.*.year_to' => ['sometimes', 'nullable', 'string', 'max:10'],
            'work_history' => ['sometimes', 'nullable', 'array', 'max:15'],
            'work_history.*.company' => ['required_with:work_history', 'string', 'max:150'],
            'work_history.*.job_title' => ['sometimes', 'nullable', 'string', 'max:150'],
            'work_history.*.date_from' => ['sometimes', 'nullable', 'string', 'max:20'],
            'work_history.*.date_to' => ['sometimes', 'nullable', 'string', 'max:20'],
            'work_history.*.description' => ['sometimes', 'nullable', 'string', 'max:500'],
        ], $this->hrProfileValidationRules()));

        if ($actor && UserRoles::isHr($actor) && ! UserRoles::isAdmin($actor)) {
            unset($validated['role'], $validated['mcp_access']);
            if (array_key_exists('role', $request->all()) && $request->input('role') !== UserRoles::USER) {
                return response()->json([
                    'message' => 'HR users can only manage standard user accounts.',
                ], 403);
            }
        }

        if (array_key_exists('manager_id', $validated) && $this->wouldCreateManagerCycle($user, $validated['manager_id'])) {
            return response()->json([
                'message' => 'Invalid manager assignment.',
                'errors' => ['manager_id' => ['This manager assignment would create a reporting loop.']],
            ], 422);
        }

        $groupIds = array_key_exists('access_group_ids', $validated) ? $validated['access_group_ids'] : null;
        unset($validated['access_group_ids']);

        if ($actor && UserRoles::isHr($actor) && ! UserRoles::isAdmin($actor)) {
            $groupIds = null;
        }

        $educationHistory = array_key_exists('education_history', $validated) ? $validated['education_history'] : null;
        $workHistory = array_key_exists('work_history', $validated) ? $validated['work_history'] : null;
        $skills = array_key_exists('skills', $validated) ? $validated['skills'] : null;
        unset($validated['education_history'], $validated['work_history'], $validated['skills']);

        // Hash password if provided
        if (isset($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        }

        $validated = $this->resolveDepartmentFields($validated);
        $validated = $this->resolveCompanyFields($validated);
        $validated = $this->normalizeHrProfilePayload($validated);
        $user->update($validated);

        if ($educationHistory !== null) {
            SyncUserProfileRecords::syncEducations($user, $educationHistory);
        }

        if ($workHistory !== null) {
            SyncUserProfileRecords::syncWorkExperiences($user, $workHistory);
        }

        if ($skills !== null) {
            SyncUserProfileRecords::syncSkills($user, $skills);
        }

        if ($groupIds !== null) {
            $user->accessGroups()->sync($groupIds);
        }

        return response()->json($user->fresh()->load(['accessGroups', 'department', 'company', 'manager', 'educations', 'workExperiences', 'userSkills']));
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }

        $admin = ApiTokenAuth::userFromRequest($request);

        if ($admin && $admin->id === $user->id) {
            return response()->json([
                'message' => 'You cannot remove your own account.',
            ], 422);
        }

        $user->delete();

        return response()->json(['message' => 'User removed.']);
    }

    /**
     * @return \Illuminate\Support\Collection<int, User>
     */
    private function orgChartUsers(?int $departmentId)
    {
        if ($departmentId === null) {
            return User::query()
                ->with('department')
                ->where('is_approved', true)
                ->orderBy('full_name')
                ->limit(500)
                ->get();
        }

        $seedIds = User::query()
            ->where('is_approved', true)
            ->where('department_id', $departmentId)
            ->pluck('id');

        if ($seedIds->isEmpty()) {
            return collect();
        }

        $relatedIds = $seedIds->unique()->values();

        $seedUsers = User::query()
            ->whereIn('id', $seedIds)
            ->get(['id', 'department_id', 'manager_id']);

        $managerIds = $seedUsers->pluck('manager_id')->filter()->unique()->values();
        $managersById = $managerIds->isEmpty()
            ? collect()
            : User::query()
                ->whereIn('id', $managerIds)
                ->where('is_approved', true)
                ->get(['id', 'department_id', 'manager_id'])
                ->keyBy('id');

        foreach ($seedUsers as $seedUser) {
            $current = $seedUser;

            while ($current->manager_id) {
                if ($relatedIds->contains($current->manager_id)) {
                    break;
                }

                $manager = $managersById->get($current->manager_id);

                if (! $manager) {
                    $manager = User::query()
                        ->where('id', $current->manager_id)
                        ->where('is_approved', true)
                        ->first(['id', 'department_id', 'manager_id']);

                    if ($manager) {
                        $managersById->put($manager->id, $manager);
                    }
                }

                if (! $manager) {
                    break;
                }

                $relatedIds->push($manager->id);

                if ($manager->department_id === $departmentId) {
                    $current = $manager;
                    continue;
                }

                break;
            }
        }

        $relatedIds = $relatedIds->unique()->values();

        $frontier = $seedIds;
        while ($frontier->isNotEmpty()) {
            $reportIds = User::query()
                ->where('is_approved', true)
                ->whereIn('manager_id', $frontier)
                ->pluck('id')
                ->unique()
                ->filter(fn (int $id) => ! $relatedIds->contains($id))
                ->values();

            if ($reportIds->isEmpty()) {
                break;
            }

            $relatedIds = $relatedIds->merge($reportIds)->unique()->values();
            $frontier = $reportIds;
        }

        return User::query()
            ->with('department')
            ->where('is_approved', true)
            ->whereIn('id', $relatedIds)
            ->orderBy('full_name')
            ->get();
    }

    /**
     * Keep only users that belong to a reporting line:
     * assigned to a manager, or leading at least one direct report.
     *
     * @param  \Illuminate\Support\Collection<int, User>  $users
     * @return \Illuminate\Support\Collection<int, User>
     */
    private function filterUsersInOrgStructure($users)
    {
        if ($users->isEmpty()) {
            return $users;
        }

        $userIds = $users->pluck('id');

        $leaderIds = User::query()
            ->where('is_approved', true)
            ->whereIn('manager_id', $userIds)
            ->pluck('manager_id')
            ->unique();

        return $users
            ->filter(fn (User $user) => $user->manager_id !== null || $leaderIds->contains($user->id))
            ->values();
    }

    private function wouldCreateManagerCycle(User $user, ?int $managerId): bool
    {
        if ($managerId === null) {
            return false;
        }

        if ($managerId === $user->id) {
            return true;
        }

        $visited = [$user->id];
        $current = User::query()->find($managerId);

        while ($current) {
            if (in_array($current->id, $visited, true)) {
                return true;
            }

            $visited[] = $current->id;
            $current = $current->manager_id ? User::query()->find($current->manager_id) : null;
        }

        return false;
    }

    private function adminUserPayload(User $user): array
    {
        return array_merge($user->toArray(), [
            'profile_completeness' => ProfileCompleteness::forUser($user),
            'has_push_subscription' => (bool) $user->push_subscriptions_exists,
        ]);
    }

}
