<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->ensureItemTable(
            'application_release_note_items',
            'application_release_notes'
        );
        $this->ensureItemTable(
            'platform_release_note_items',
            'platform_release_notes'
        );

        $this->migrateJsonItems(
            'application_release_notes',
            'application_release_note_items'
        );
        $this->migrateJsonItems(
            'platform_release_notes',
            'platform_release_note_items'
        );

        $this->migrateLegacyColumns(
            'application_release_notes',
            'application_release_note_items'
        );
        $this->migrateLegacyColumns(
            'platform_release_notes',
            'platform_release_note_items'
        );

        $this->dropLegacyColumns('application_release_notes');
        $this->dropLegacyColumns('platform_release_notes');
    }

    public function down(): void
    {
        $this->restoreJsonFromItems(
            'application_release_notes',
            'application_release_note_items'
        );
        $this->restoreJsonFromItems(
            'platform_release_notes',
            'platform_release_note_items'
        );

        Schema::dropIfExists('application_release_note_items');
        Schema::dropIfExists('platform_release_note_items');
    }

    private function ensureItemTable(string $itemTable, string $parentTable): void
    {
        if (Schema::hasTable($itemTable) || ! Schema::hasTable($parentTable)) {
            return;
        }

        Schema::create($itemTable, function (Blueprint $table) use ($parentTable) {
            $table->id();
            $table->foreignId('release_note_id')->constrained($parentTable)->cascadeOnDelete();
            $table->string('category', 32)->default('feature');
            $table->text('body');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['release_note_id', 'sort_order']);
        });
    }

    private function migrateJsonItems(string $parentTable, string $itemTable): void
    {
        if (! Schema::hasTable($parentTable) || ! Schema::hasColumn($parentTable, 'items')) {
            return;
        }

        $rows = DB::table($parentTable)->select('id', 'items')->get();
        foreach ($rows as $row) {
            if (DB::table($itemTable)->where('release_note_id', $row->id)->exists()) {
                continue;
            }

            $items = is_string($row->items)
                ? json_decode($row->items, true)
                : $row->items;

            if (! is_array($items)) {
                continue;
            }

            $now = now();
            foreach (array_values($items) as $index => $item) {
                if (! is_array($item)) {
                    continue;
                }

                $body = trim((string) ($item['body'] ?? ''));
                if ($body === '') {
                    continue;
                }

                $category = (string) ($item['category'] ?? 'feature');

                DB::table($itemTable)->insert([
                    'release_note_id' => $row->id,
                    'category' => $category !== '' ? $category : 'feature',
                    'body' => $body,
                    'sort_order' => $index,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }

    private function migrateLegacyColumns(string $parentTable, string $itemTable): void
    {
        if (! Schema::hasTable($parentTable)) {
            return;
        }

        $hasBody = Schema::hasColumn($parentTable, 'body');
        $hasCategories = Schema::hasColumn($parentTable, 'categories');
        $hasCategory = Schema::hasColumn($parentTable, 'category');

        if (! $hasBody && ! $hasCategories && ! $hasCategory) {
            return;
        }

        $columns = ['id'];
        if ($hasBody) {
            $columns[] = 'body';
        }
        if ($hasCategories) {
            $columns[] = 'categories';
        }
        if ($hasCategory) {
            $columns[] = 'category';
        }

        $rows = DB::table($parentTable)->select($columns)->get();
        foreach ($rows as $row) {
            if (DB::table($itemTable)->where('release_note_id', $row->id)->exists()) {
                continue;
            }

            $body = $hasBody ? trim((string) ($row->body ?? '')) : '';
            $categories = [];

            if ($hasCategories) {
                $decoded = is_string($row->categories)
                    ? json_decode($row->categories, true)
                    : $row->categories;
                if (is_array($decoded)) {
                    $categories = $decoded;
                }
            } elseif ($hasCategory && is_string($row->category) && $row->category !== '') {
                $categories = [$row->category];
            }

            if ($categories === []) {
                $categories = ['feature'];
            }

            if ($body === '') {
                continue;
            }

            $now = now();
            DB::table($itemTable)->insert([
                'release_note_id' => $row->id,
                'category' => (string) $categories[0],
                'body' => $body,
                'sort_order' => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    private function dropLegacyColumns(string $parentTable): void
    {
        if (! Schema::hasTable($parentTable)) {
            return;
        }

        $drop = [];
        foreach (['items', 'body', 'categories', 'category'] as $column) {
            if (Schema::hasColumn($parentTable, $column)) {
                $drop[] = $column;
            }
        }

        if ($drop === []) {
            return;
        }

        Schema::table($parentTable, function (Blueprint $blueprint) use ($drop) {
            $blueprint->dropColumn($drop);
        });
    }

    private function restoreJsonFromItems(string $parentTable, string $itemTable): void
    {
        if (! Schema::hasTable($parentTable)) {
            return;
        }

        if (! Schema::hasColumn($parentTable, 'items')) {
            Schema::table($parentTable, function (Blueprint $blueprint) {
                $blueprint->json('items')->nullable()->after('version');
            });
        }

        if (! Schema::hasTable($itemTable)) {
            return;
        }

        $noteIds = DB::table($parentTable)->pluck('id');
        foreach ($noteIds as $noteId) {
            $items = DB::table($itemTable)
                ->where('release_note_id', $noteId)
                ->orderBy('sort_order')
                ->orderBy('id')
                ->get(['category', 'body'])
                ->map(fn ($item) => [
                    'category' => $item->category,
                    'body' => $item->body,
                ])
                ->values()
                ->all();

            DB::table($parentTable)->where('id', $noteId)->update([
                'items' => json_encode($items),
            ]);
        }
    }
};
