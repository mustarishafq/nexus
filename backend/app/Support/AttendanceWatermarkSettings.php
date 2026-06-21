<?php

namespace App\Support;

class AttendanceWatermarkSettings
{
    /** @var array<string, mixed> */
    public const DEFAULTS = [
        'enabled' => true,
        'clock_in_redirect_enabled' => true,
        'show_datetime' => true,
        'show_date' => true,
        'show_time' => true,
        'datetime_format' => 'full',
        'show_location' => true,
        'show_coordinates' => true,
        'show_user_name' => true,
        'show_device_info' => false,
        'show_custom_text' => false,
        'custom_text' => '',
        'font_size_percent' => 100,
        'text_color' => '#FFFFFF',
        'background_color' => '#000000',
        'background_opacity' => 45,
        'position' => 'bottom-left',
        'margin_percent' => 3,
        'show_logo' => false,
        'logo_url' => null,
        'logo_size_percent' => 100,
        'logo_opacity' => 100,
        'logo_position' => 'center',
    ];

    /** @var array<string, array{label: string, description: string}> */
    public const LOGO_POSITIONS = [
        'left' => [
            'label' => 'Left',
            'description' => 'Align the logo to the left inside the watermark panel.',
        ],
        'center' => [
            'label' => 'Center',
            'description' => 'Center the logo above the watermark text.',
        ],
        'right' => [
            'label' => 'Right',
            'description' => 'Align the logo to the right inside the watermark panel.',
        ],
    ];

    /** @var array<string, array{label: string, description: string}> */
    public const DATETIME_FORMATS = [
        'full' => [
            'label' => 'Full date & time',
            'description' => 'Jun 21, 2026 2:30:45 PM',
        ],
        'date_only' => [
            'label' => 'Date only',
            'description' => 'Jun 21, 2026',
        ],
        'time_only' => [
            'label' => 'Time only',
            'description' => '2:30:45 PM',
        ],
        'iso' => [
            'label' => 'ISO 8601',
            'description' => '2026-06-21T14:30:45',
        ],
    ];

    /** @var array<string, array{label: string, description: string}> */
    public const POSITIONS = [
        'bottom-left' => [
            'label' => 'Bottom left',
            'description' => 'Stacked text in the lower-left corner.',
        ],
        'bottom-right' => [
            'label' => 'Bottom right',
            'description' => 'Stacked text in the lower-right corner.',
        ],
        'top-left' => [
            'label' => 'Top left',
            'description' => 'Stacked text in the upper-left corner.',
        ],
        'top-right' => [
            'label' => 'Top right',
            'description' => 'Stacked text in the upper-right corner.',
        ],
        'bottom-center' => [
            'label' => 'Bottom center',
            'description' => 'Centered along the bottom edge.',
        ],
    ];

    /** @return list<string> */
    public static function allowedDatetimeFormats(): array
    {
        return array_keys(self::DATETIME_FORMATS);
    }

    /** @return list<string> */
    public static function allowedLogoPositions(): array
    {
        return array_keys(self::LOGO_POSITIONS);
    }

    /** @return list<array<string, mixed>> */
    public static function logoPositionCatalog(): array
    {
        return self::catalogFromMap(self::LOGO_POSITIONS);
    }

    /** @return list<string> */
    public static function allowedPositions(): array
    {
        return array_keys(self::POSITIONS);
    }

    /** @return list<array<string, mixed>> */
    public static function datetimeFormatCatalog(): array
    {
        return self::catalogFromMap(self::DATETIME_FORMATS);
    }

    /** @return list<array<string, mixed>> */
    public static function positionCatalog(): array
    {
        return self::catalogFromMap(self::POSITIONS);
    }

    /** @return array<string, mixed> */
    public static function normalizeConfig(array|object|null $input = null): array
    {
        $values = is_object($input) ? (array) $input : ($input ?? []);
        $config = self::DEFAULTS;

        $config['enabled'] = self::toBool($values['attendance_enabled'] ?? $values['enabled'] ?? true);
        $config['clock_in_redirect_enabled'] = self::toBool(
            $values['attendance_clock_in_redirect_enabled'] ?? $values['clock_in_redirect_enabled'] ?? true
        );
        $config['show_datetime'] = self::toBool($values['attendance_watermark_show_datetime'] ?? $values['show_datetime'] ?? true);
        $config['show_date'] = self::toBool($values['attendance_watermark_show_date'] ?? $values['show_date'] ?? true);
        $config['show_time'] = self::toBool($values['attendance_watermark_show_time'] ?? $values['show_time'] ?? true);
        $config['datetime_format'] = self::normalizeDatetimeFormat(
            $values['attendance_watermark_datetime_format'] ?? $values['datetime_format'] ?? null
        );
        $config['show_location'] = self::toBool($values['attendance_watermark_show_location'] ?? $values['show_location'] ?? true);
        $config['show_coordinates'] = self::toBool($values['attendance_watermark_show_coordinates'] ?? $values['show_coordinates'] ?? true);
        $config['show_user_name'] = self::toBool($values['attendance_watermark_show_user_name'] ?? $values['show_user_name'] ?? true);
        $config['show_device_info'] = self::toBool($values['attendance_watermark_show_device_info'] ?? $values['show_device_info'] ?? false);
        $config['show_custom_text'] = self::toBool($values['attendance_watermark_show_custom_text'] ?? $values['show_custom_text'] ?? false);
        $config['custom_text'] = trim((string) ($values['attendance_watermark_custom_text'] ?? $values['custom_text'] ?? ''));
        $config['font_size_percent'] = self::clampInt(
            $values['attendance_watermark_font_size_percent'] ?? $values['font_size_percent'] ?? 100,
            50,
            200
        );
        $config['text_color'] = self::normalizeHexColor(
            $values['attendance_watermark_text_color'] ?? $values['text_color'] ?? '#FFFFFF'
        );
        $config['background_color'] = self::normalizeHexColor(
            $values['attendance_watermark_background_color'] ?? $values['background_color'] ?? '#000000'
        );
        $config['background_opacity'] = self::clampInt(
            $values['attendance_watermark_background_opacity'] ?? $values['background_opacity'] ?? 45,
            0,
            100
        );
        $config['position'] = self::normalizePosition(
            $values['attendance_watermark_position'] ?? $values['position'] ?? null
        );
        $config['margin_percent'] = self::clampInt(
            $values['attendance_watermark_margin_percent'] ?? $values['margin_percent'] ?? 3,
            1,
            15
        );
        $config['show_logo'] = self::toBool($values['attendance_watermark_show_logo'] ?? $values['show_logo'] ?? false);
        $config['logo_url'] = self::normalizeLogoUrl(
            $values['attendance_watermark_logo_url'] ?? $values['logo_url'] ?? null
        );
        $config['logo_size_percent'] = self::clampInt(
            $values['attendance_watermark_logo_size_percent'] ?? $values['logo_size_percent'] ?? 100,
            50,
            200
        );
        $config['logo_opacity'] = self::clampInt(
            $values['attendance_watermark_logo_opacity'] ?? $values['logo_opacity'] ?? 100,
            0,
            100
        );
        $config['logo_position'] = self::normalizeLogoPosition(
            $values['attendance_watermark_logo_position'] ?? $values['logo_position'] ?? null
        );

        return $config;
    }

    /** @return array<string, mixed> */
    public static function toDatabaseColumns(array $config): array
    {
        return [
            'attendance_enabled' => $config['enabled'],
            'attendance_clock_in_redirect_enabled' => $config['clock_in_redirect_enabled'],
            'attendance_watermark_show_datetime' => $config['show_datetime'],
            'attendance_watermark_show_date' => $config['show_date'],
            'attendance_watermark_show_time' => $config['show_time'],
            'attendance_watermark_datetime_format' => $config['datetime_format'],
            'attendance_watermark_show_location' => $config['show_location'],
            'attendance_watermark_show_coordinates' => $config['show_coordinates'],
            'attendance_watermark_show_user_name' => $config['show_user_name'],
            'attendance_watermark_show_device_info' => $config['show_device_info'],
            'attendance_watermark_show_custom_text' => $config['show_custom_text'],
            'attendance_watermark_custom_text' => $config['custom_text'] ?: null,
            'attendance_watermark_font_size_percent' => $config['font_size_percent'],
            'attendance_watermark_text_color' => $config['text_color'],
            'attendance_watermark_background_color' => $config['background_color'],
            'attendance_watermark_background_opacity' => $config['background_opacity'],
            'attendance_watermark_position' => $config['position'],
            'attendance_watermark_margin_percent' => $config['margin_percent'],
            'attendance_watermark_show_logo' => $config['show_logo'],
            'attendance_watermark_logo_url' => $config['logo_url'],
            'attendance_watermark_logo_size_percent' => $config['logo_size_percent'],
            'attendance_watermark_logo_opacity' => $config['logo_opacity'],
            'attendance_watermark_logo_position' => $config['logo_position'],
        ];
    }

    /** @return array<string, mixed> */
    public static function validationRules(): array
    {
        return [
            'attendance_enabled' => ['nullable', 'boolean'],
            'attendance_clock_in_redirect_enabled' => ['nullable', 'boolean'],
            'attendance_watermark_show_datetime' => ['nullable', 'boolean'],
            'attendance_watermark_show_date' => ['nullable', 'boolean'],
            'attendance_watermark_show_time' => ['nullable', 'boolean'],
            'attendance_watermark_datetime_format' => ['nullable', 'string', 'in:'.implode(',', self::allowedDatetimeFormats())],
            'attendance_watermark_show_location' => ['nullable', 'boolean'],
            'attendance_watermark_show_coordinates' => ['nullable', 'boolean'],
            'attendance_watermark_show_user_name' => ['nullable', 'boolean'],
            'attendance_watermark_show_device_info' => ['nullable', 'boolean'],
            'attendance_watermark_show_custom_text' => ['nullable', 'boolean'],
            'attendance_watermark_custom_text' => ['nullable', 'string', 'max:255'],
            'attendance_watermark_font_size_percent' => ['nullable', 'integer', 'min:50', 'max:200'],
            'attendance_watermark_text_color' => ['nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'attendance_watermark_background_color' => ['nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'attendance_watermark_background_opacity' => ['nullable', 'integer', 'min:0', 'max:100'],
            'attendance_watermark_position' => ['nullable', 'string', 'in:'.implode(',', self::allowedPositions())],
            'attendance_watermark_margin_percent' => ['nullable', 'integer', 'min:1', 'max:15'],
            'attendance_watermark_show_logo' => ['nullable', 'boolean'],
            'attendance_watermark_logo_url' => ['nullable', 'string', 'max:2048'],
            'attendance_watermark_logo_size_percent' => ['nullable', 'integer', 'min:50', 'max:200'],
            'attendance_watermark_logo_opacity' => ['nullable', 'integer', 'min:0', 'max:100'],
            'attendance_watermark_logo_position' => ['nullable', 'string', 'in:'.implode(',', self::allowedLogoPositions())],
        ];
    }

    private static function normalizeDatetimeFormat(?string $value): string
    {
        $value = strtolower(trim((string) $value));

        return in_array($value, self::allowedDatetimeFormats(), true)
            ? $value
            : self::DEFAULTS['datetime_format'];
    }

    private static function normalizeLogoPosition(?string $value): string
    {
        $value = strtolower(trim((string) $value));

        return in_array($value, self::allowedLogoPositions(), true)
            ? $value
            : self::DEFAULTS['logo_position'];
    }

    private static function normalizePosition(?string $value): string
    {
        $value = strtolower(trim((string) $value));

        return in_array($value, self::allowedPositions(), true)
            ? $value
            : self::DEFAULTS['position'];
    }

    private static function normalizeHexColor(?string $value): string
    {
        $value = strtoupper(trim((string) $value));

        return preg_match('/^#[0-9A-F]{6}$/', $value) ? $value : '#FFFFFF';
    }

    private static function normalizeLogoUrl(?string $value): ?string
    {
        $value = trim((string) $value);

        return $value !== '' ? $value : null;
    }

    private static function toBool(mixed $value): bool
    {
        return filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? false;
    }

    private static function clampInt(mixed $value, int $min, int $max): int
    {
        $int = (int) $value;

        return max($min, min($max, $int));
    }

    /** @param array<string, array<string, mixed>> $map */
    private static function catalogFromMap(array $map): array
    {
        return collect($map)
            ->map(fn (array $item, string $id) => array_merge(['id' => $id], $item))
            ->values()
            ->all();
    }
}
