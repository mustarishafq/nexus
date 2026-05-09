<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\AppliesIndexQuery;
use App\Http\Controllers\Controller;
use App\Models\User;
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
            User::query(),
            ['role', 'email']
        )->get();

        return response()->json($users);
    }

    public function show(User $user): JsonResponse
    {
        return response()->json($user);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'full_name' => ['required', 'string', 'max:255'],
            'email'     => ['required', 'email', 'max:255', 'unique:users,email'],
            'password'  => ['required', 'string', 'min:8'],
            'role'      => ['sometimes', 'string', 'max:50'],
            'is_approved' => ['sometimes', 'boolean'],
        ]);

        $user = User::create([
            'name'        => $validated['full_name'],
            'full_name'   => $validated['full_name'],
            'email'       => $validated['email'],
            'password'    => $validated['password'],
            'role'        => $validated['role'] ?? 'user',
            'is_approved' => $validated['is_approved'] ?? true,
        ]);

        return response()->json($user, 201);
    }

    /**
     * Bulk-create users from a CSV upload.
     * Expected CSV columns: full_name, email, password, role (optional), is_approved (optional)
     */
    public function importCsv(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimetypes:text/plain,text/csv,application/csv,application/vnd.ms-excel'],
        ]);

        $file    = $request->file('file');
        $handle  = fopen($file->getRealPath(), 'r');
        $headers = array_map('trim', fgetcsv($handle));

        $created = [];
        $errors  = [];
        $row     = 1;

        while (($data = fgetcsv($handle)) !== false) {
            $row++;
            $record = array_combine($headers, array_map('trim', $data));

            if (empty($record['email']) || empty($record['full_name'])) {
                $errors[] = "Row {$row}: missing email or full_name";
                continue;
            }

            if (User::where('email', $record['email'])->exists()) {
                $errors[] = "Row {$row}: email {$record['email']} already exists";
                continue;
            }

            $password = $record['password'] ?? 'Password@123';

            $user = User::create([
                'name'        => $record['full_name'],
                'full_name'   => $record['full_name'],
                'email'       => $record['email'],
                'password'    => Hash::make($password),
                'role'        => $record['role'] ?? 'user',
                'is_approved' => isset($record['is_approved']) ? filter_var($record['is_approved'], FILTER_VALIDATE_BOOLEAN) : true,
            ]);

            $created[] = $user->email;
        }

        fclose($handle);

        return response()->json([
            'created' => $created,
            'errors'  => $errors,
            'count'   => count($created),
        ]);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'full_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'email' => ['sometimes', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'role' => ['sometimes', 'string', 'max:50'],
            'is_approved' => ['sometimes', 'boolean'],
            'notification_settings' => ['sometimes', 'nullable', 'array'],
            'password' => ['sometimes', 'string', 'min:8'],
        ]);

        $user->update($validated);

        return response()->json($user->fresh());
    }
}
