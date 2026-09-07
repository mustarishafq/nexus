<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'health_status')) {
                $table->json('health_status')->nullable()->after('children');
            }
        });

        DB::table('users')
            ->select(['id', 'children'])
            ->whereNotNull('children')
            ->orderBy('id')
            ->chunkById(100, function ($users): void {
                foreach ($users as $user) {
                    $raw = $user->children;
                    $items = is_string($raw) ? json_decode($raw, true) : $raw;
                    if (! is_array($items)) {
                        continue;
                    }

                    $children = [];
                    foreach ($items as $item) {
                        if (! is_array($item)) {
                            continue;
                        }

                        $name = trim((string) ($item['name'] ?? ''));
                        $icNumber = trim((string) ($item['ic_number'] ?? ''));
                        $school = trim((string) ($item['school'] ?? ''));
                        $dateOfBirth = trim((string) ($item['date_of_birth'] ?? ''));

                        if ($name === '' && $icNumber === '' && $school === '' && $dateOfBirth === '') {
                            continue;
                        }

                        $children[] = [
                            'name' => $name,
                            'ic_number' => $icNumber,
                            'school' => $school,
                            'date_of_birth' => $dateOfBirth,
                        ];
                    }

                    DB::table('users')->where('id', $user->id)->update([
                        'children' => $children === [] ? null : json_encode($children),
                    ]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'health_status')) {
                $table->dropColumn('health_status');
            }
        });
    }
};
