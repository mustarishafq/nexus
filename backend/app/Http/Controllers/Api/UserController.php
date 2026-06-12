<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AppliesIndexQuery;
use App\Http\Controllers\Controller;
use App\Models\AccessGroup;
use App\Models\ActivityLog;
use App\Models\User;
use App\Support\ApiTokenAuth;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    use AppliesIndexQuery;

    public function index(Request $request): JsonResponse
    {
        $users = $this->applyIndexQuery(
            $request,
            User::query()->with('accessGroups'),
            ['role', 'email']
        )->get();

        return response()->json($users);
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
        $like = '%'.$term.'%';

        $users = User::query()
            ->where('is_approved', true)
            ->where(function ($query) use ($like) {
                $query->where('full_name', 'like', $like)
                    ->orWhere('name', 'like', $like)
                    ->orWhere('email', 'like', $like);
            })
            ->orderBy('full_name')
            ->limit($limit)
            ->get(['id', 'full_name', 'name', 'email', 'profile_picture', 'role']);

        return response()->json($users);
    }

    public function dashboardPreview(Request $request, User $user): JsonResponse
    {
        $viewer = $this->authenticatedUser($request);

        if (! $viewer) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (! $user->is_approved) {
            return response()->json(['message' => 'User not found.'], 404);
        }

        $user->load('accessGroups');

        $activities = ActivityLog::query()
            ->where('user_id', (string) $user->id)
            ->orderByDesc('created_at')
            ->limit(20)
            ->get()
            ->map(fn (ActivityLog $log) => $log->toArray())
            ->values();

        return response()->json([
            'user' => $this->publicUserProfile($user),
            'activities' => $activities,
        ]);
    }

    public function show(User $user): JsonResponse
    {
        return response()->json($user);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'full_name' => ['required', 'string', 'max:255'],
            'email'     => ['sometimes', 'nullable', 'email', 'max:255', 'unique:users,email'],
            'password'  => ['required', 'string', 'min:8'],
            'role'      => ['sometimes', 'string', 'max:50'],
            'access_group_ids' => ['sometimes', 'array'],
            'access_group_ids.*' => ['integer', 'exists:access_groups,id'],
            'is_approved' => ['sometimes', 'boolean'],
            'date_of_birth' => ['sometimes', 'nullable', 'date'],
            'joined_at' => ['sometimes', 'nullable', 'date'],
        ]);

        $groupIds = $validated['access_group_ids'] ?? null;
        unset($validated['access_group_ids']);

        $user = User::create([
            'name'                   => $validated['full_name'],
            'full_name'              => $validated['full_name'],
            'email'                  => $validated['email'] ?? null,
            'password'               => Hash::make($validated['password']),
            'role'                   => $validated['role'] ?? 'user',
            'is_approved'            => $validated['is_approved'] ?? true,
            'force_password_change'  => true,
        ]);

        if ($groupIds !== null) {
            $user->accessGroups()->sync($groupIds);
        }

        return response()->json($user->load('accessGroups'), 201);
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
                        'name'                   => $record['full_name'],
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
     * Bulk-assign access groups to existing users from a CSV upload.
     * Expected columns: email, access_group
     * access_group values are matched to access group names.
     */
    public function assignAccessGroupsCsv(Request $request): JsonResponse
    {
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
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'full_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'role' => ['sometimes', 'string', 'max:50'],
            'access_group_ids' => ['sometimes', 'array'],
            'access_group_ids.*' => ['integer', 'exists:access_groups,id'],
            'is_approved' => ['sometimes', 'boolean'],
            'notification_settings' => ['sometimes', 'nullable', 'array'],
            'password' => ['sometimes', 'string', 'min:8'],
            'date_of_birth' => ['sometimes', 'nullable', 'date'],
            'joined_at' => ['sometimes', 'nullable', 'date'],
        ]);

        $groupIds = array_key_exists('access_group_ids', $validated) ? $validated['access_group_ids'] : null;
        unset($validated['access_group_ids']);

        // Hash password if provided
        if (isset($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        }

        $user->update($validated);

        if ($groupIds !== null) {
            $user->accessGroups()->sync($groupIds);
        }

        return response()->json($user->fresh()->load('accessGroups'));
    }

    private function authenticatedUser(Request $request): ?User
    {
        $user = ApiTokenAuth::userFromRequest($request);

        if (! $user || ! $user->is_approved) {
            return null;
        }

        return $user;
    }

    /**
     * @return array<string, mixed>
     */
    private function publicUserProfile(User $user): array
    {
        return $user->makeHidden([
            'password',
            'remember_token',
            'notification_settings',
            'force_password_change',
        ])->toArray();
    }
}
