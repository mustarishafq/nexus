<?php

namespace App\Http\Controllers\Api\Concerns;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

trait AppliesIndexQuery
{
    protected function applyIndexQuery(
        Request $request,
        Builder $query,
        array $filterable = [],
        string $defaultSort = '-created_date'
    ): Builder {
        $sort = (string) $request->query('sort', $defaultSort);
        $limit = max(1, min((int) $request->query('limit', 200), 500));

        foreach ($filterable as $field) {
            if (! $request->has($field)) {
                continue;
            }

            $value = $request->query($field);

            if (is_array($value)) {
                $query->whereIn($field, $value);
            } elseif (in_array(strtolower((string) $value), ['true', '1', 'yes'], true)) {
                $query->where($field, true);
            } elseif (in_array(strtolower((string) $value), ['false', '0', 'no'], true)) {
                $query->where($field, false);
            } else {
                $query->where($field, $value);
            }
        }

        if ($sort !== '') {
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
            }
        }

        return $query->limit($limit);
    }
}
