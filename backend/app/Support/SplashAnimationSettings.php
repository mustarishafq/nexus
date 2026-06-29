<?php

namespace App\Support;

class SplashAnimationSettings
{
    public const DEFAULT_STYLE = 'pulse-ring';

    /** @var array<string, mixed> */
    public const DEFAULTS = [
        'enabled' => true,
        'animation_style' => self::DEFAULT_STYLE,
        'background_color' => '#022e96',
        'accent_color' => '#FA9D04',
        'secondary_color' => '#017CF3',
        'min_duration_ms' => 1200,
        'max_duration_ms' => 6000,
        'speed_percent' => 100,
        'exit_fade_ms' => 450,
        'logo_scale_percent' => 100,
        'logo_url' => null,
        'show_logo' => true,
        'media_fit' => 'contain',
        'video_loop' => true,
        'video_muted' => true,
        'show_system_name' => false,
        'system_name_animation' => 'fade-rise',
        'system_name_color' => '#FFFFFF',
        'system_name_size_percent' => 100,
        'system_name_position' => 'below',
        'backdrop_blur' => 0,
        'background_overlay_opacity' => 0,
        'background_style' => 'solid',
        'background_gradient_angle' => 135,
        'background_blur' => 0,
    ];

    /** @var array<string, array{label: string, description: string}> */
    public const BACKGROUND_STYLES = [
        'solid' => [
            'label' => 'Solid',
            'description' => 'Flat background color.',
        ],
        'linear' => [
            'label' => 'Linear gradient',
            'description' => 'Smooth diagonal blend using your brand colors.',
        ],
        'radial' => [
            'label' => 'Radial glow',
            'description' => 'Soft spotlight radiating from the center.',
        ],
        'mesh' => [
            'label' => 'Color mesh',
            'description' => 'Blurred color blobs for depth and atmosphere.',
        ],
        'aurora' => [
            'label' => 'Aurora',
            'description' => 'Slowly shifting northern-lights gradient.',
        ],
        'vignette' => [
            'label' => 'Vignette',
            'description' => 'Solid fill with darkened edges framing the logo.',
        ],
    ];

    /** @var array<string, array{label: string, description: string}> */
    public const SYSTEM_NAME_ANIMATIONS = [
        'fade-rise' => [
            'label' => 'Fade & Rise',
            'description' => 'Title fades in while moving upward.',
        ],
        'slide-up' => [
            'label' => 'Slide Up',
            'description' => 'Title slides up from below the logo.',
        ],
        'typewriter' => [
            'label' => 'Typewriter',
            'description' => 'Title appears one character at a time.',
        ],
        'shimmer' => [
            'label' => 'Shimmer',
            'description' => 'Light shimmer sweeps across the title.',
        ],
        'glow-pulse' => [
            'label' => 'Glow Pulse',
            'description' => 'Soft glowing pulse on the title text.',
        ],
        'none' => [
            'label' => 'Instant',
            'description' => 'Show the title immediately with no motion.',
        ],
    ];

    /** @var array<string, array{label: string, description: string}> */
    public const STYLES = [
        'lottie' => [
            'label' => 'Classic Lottie',
            'description' => 'The original bundled Lottie splash animation.',
        ],
        'pulse-ring' => [
            'label' => 'Pulse Rings',
            'description' => 'Logo centered with expanding energy rings.',
        ],
        'orbit' => [
            'label' => 'Orbital Launch',
            'description' => 'Satellite dots orbit the logo before lift-off.',
        ],
        'neural' => [
            'label' => 'Neural Network',
            'description' => 'Connected nodes pulse around the brand mark.',
        ],
        'constellation' => [
            'label' => 'Constellation',
            'description' => 'Star field with lines that converge on the logo.',
        ],
        'spin-glow' => [
            'label' => 'Spin Glow',
            'description' => 'Rotating halo and soft glow behind the logo.',
        ],
        'fade-rise' => [
            'label' => 'Fade & Rise',
            'description' => 'Minimal logo entrance with a gentle upward motion.',
        ],
        'particle-burst' => [
            'label' => 'Particle Burst',
            'description' => 'Brand-colored sparks burst outward, then the logo resolves.',
        ],
        'logo-morph' => [
            'label' => 'Logo Morph',
            'description' => 'Logo materializes from blur with a crisp morph-in finish.',
        ],
        'radar-sweep' => [
            'label' => 'Radar Sweep',
            'description' => 'A scanning radar arc sweeps across the splash.',
        ],
        'bounce-in' => [
            'label' => 'Bounce In',
            'description' => 'Logo drops in with a playful elastic bounce.',
        ],
        'flip-reveal' => [
            'label' => 'Flip Reveal',
            'description' => 'Logo flips into view on a 3D axis.',
        ],
        'ripple-pond' => [
            'label' => 'Ripple Pond',
            'description' => 'Concentric ripples spread from the logo center.',
        ],
        'dna-helix' => [
            'label' => 'DNA Helix',
            'description' => 'Twin helix strands spiral around the logo.',
        ],
        'hex-build' => [
            'label' => 'Hex Build',
            'description' => 'Honeycomb hexagons assemble around the brand mark.',
        ],
        'zoom-punch' => [
            'label' => 'Zoom Punch',
            'description' => 'Logo rockets in from deep space with impact.',
        ],
        'sunburst' => [
            'label' => 'Sunburst',
            'description' => 'Radiating light beams burst from the center.',
        ],
        'matrix-fall' => [
            'label' => 'Matrix Fall',
            'description' => 'Falling code columns loop around the logo.',
        ],
        'matrix-rain' => [
            'label' => 'Matrix Rain',
            'description' => 'Full-screen code rain keeps falling behind the logo.',
        ],
        'laser-grid' => [
            'label' => 'Laser Grid',
            'description' => 'A glowing grid scans in before the logo locks on.',
        ],
        'comet-trail' => [
            'label' => 'Comet Trail',
            'description' => 'A blazing comet orbits and settles into the logo.',
        ],
        'prism-split' => [
            'label' => 'Prism Split',
            'description' => 'RGB channels converge into a sharp logo reveal.',
        ],
        'ring-of-fire' => [
            'label' => 'Ring of Fire',
            'description' => 'A fiery halo spins before the brand ignites.',
        ],
        'mosaic-tile' => [
            'label' => 'Mosaic Tile',
            'description' => 'Tiles snap together to form the logo.',
        ],
        'ink-drop' => [
            'label' => 'Ink Drop',
            'description' => 'Ripples spread outward like ink hitting water.',
        ],
        'hologram-flicker' => [
            'label' => 'Hologram Flicker',
            'description' => 'Scan lines flicker before the logo stabilizes.',
        ],
        'gear-spin' => [
            'label' => 'Gear Spin',
            'description' => 'Mechanical gears rotate into place around the brand.',
        ],
        'star-warp' => [
            'label' => 'Star Warp',
            'description' => 'Streaking stars rush past before the logo arrives.',
        ],
        'bubble-pop' => [
            'label' => 'Bubble Pop',
            'description' => 'Floating bubbles burst to reveal the logo.',
        ],
        'magnetic-pull' => [
            'label' => 'Magnetic Pull',
            'description' => 'Particles snap inward and assemble the logo.',
        ],
        'tap-ripple' => [
            'label' => 'Tap Ripple',
            'description' => 'Tap anywhere to send ripples across the splash.',
        ],
        'pointer-glow' => [
            'label' => 'Pointer Glow',
            'description' => 'Move or tap to steer a spotlight over the logo.',
        ],
        'tilt-parallax' => [
            'label' => 'Tilt Parallax',
            'description' => 'Drag or tap to tilt the logo in 3D space.',
        ],
        'crystal-shatter' => [
            'label' => 'Crystal Shatter',
            'description' => 'Glass shards burst away to reveal the logo.',
        ],
        'clockwork' => [
            'label' => 'Clockwork',
            'description' => 'Clock hands spin into alignment before the brand appears.',
        ],
        'neon-flicker' => [
            'label' => 'Neon Flicker',
            'description' => 'A neon sign buzzes and flickers on around the logo.',
        ],
        'fold-unfold' => [
            'label' => 'Fold Unfold',
            'description' => 'Paper panels unfold to expose the logo.',
        ],
        'orbit-pulse' => [
            'label' => 'Orbit Pulse',
            'description' => 'Concentric rings pulse inward toward the logo.',
        ],
    ];

    public static function normalize(?string $style): string
    {
        $style = is_string($style) ? trim($style) : '';

        return array_key_exists($style, self::STYLES) ? $style : self::DEFAULT_STYLE;
    }

    /** @return list<string> */
    public static function allowedValues(): array
    {
        return array_keys(self::STYLES);
    }

    /** @return list<array{id: string, label: string, description: string}> */
    public static function catalog(): array
    {
        return array_map(
            fn (string $id, array $meta) => [
                'id' => $id,
                'label' => $meta['label'],
                'description' => $meta['description'],
            ],
            array_keys(self::STYLES),
            self::STYLES
        );
    }

    /** @param  array<string, mixed>|object|null  $input */
    public static function normalizeConfig(array|object|null $input = null): array
    {
        $values = is_object($input) ? (array) $input : ($input ?? []);
        $config = self::DEFAULTS;

        if (array_key_exists('splash_animation_style', $values)) {
            $config['animation_style'] = self::normalize($values['splash_animation_style'] ?? null);
        } elseif (array_key_exists('animation_style', $values)) {
            $config['animation_style'] = self::normalize($values['animation_style'] ?? null);
        }

        if (array_key_exists('splash_enabled', $values)) {
            $config['enabled'] = filter_var($values['splash_enabled'], FILTER_VALIDATE_BOOL);
        } elseif (array_key_exists('enabled', $values)) {
            $config['enabled'] = filter_var($values['enabled'], FILTER_VALIDATE_BOOL);
        }

        $colorMap = [
            'background_color' => 'splash_background_color',
            'accent_color' => 'splash_accent_color',
            'secondary_color' => 'splash_secondary_color',
        ];

        foreach ($colorMap as $key => $legacyKey) {
            $raw = $values[$legacyKey] ?? $values[$key] ?? $config[$key];
            $config[$key] = self::normalizeColor($raw, $config[$key]);
        }

        $config['min_duration_ms'] = self::clampInt(
            $values['splash_min_duration_ms'] ?? $values['min_duration_ms'] ?? $config['min_duration_ms'],
            400,
            15000
        );
        $config['max_duration_ms'] = self::clampInt(
            $values['splash_max_duration_ms'] ?? $values['max_duration_ms'] ?? $config['max_duration_ms'],
            2000,
            30000
        );

        if ($config['min_duration_ms'] >= $config['max_duration_ms']) {
            $config['max_duration_ms'] = max($config['min_duration_ms'] + 500, 2000);
        }

        $config['speed_percent'] = self::clampInt(
            $values['splash_speed_percent'] ?? $values['speed_percent'] ?? $config['speed_percent'],
            50,
            200
        );
        $config['exit_fade_ms'] = self::clampInt(
            $values['splash_exit_fade_ms'] ?? $values['exit_fade_ms'] ?? $config['exit_fade_ms'],
            150,
            1200
        );
        $config['logo_scale_percent'] = self::clampInt(
            $values['splash_logo_scale_percent'] ?? $values['logo_scale_percent'] ?? $config['logo_scale_percent'],
            50,
            200
        );

        $config['logo_url'] = self::normalizeUrl($values['splash_logo_url'] ?? $values['logo_url'] ?? null);

        if (array_key_exists('splash_show_logo', $values)) {
            $config['show_logo'] = filter_var($values['splash_show_logo'], FILTER_VALIDATE_BOOL);
        } elseif (array_key_exists('show_logo', $values)) {
            $config['show_logo'] = filter_var($values['show_logo'], FILTER_VALIDATE_BOOL);
        }

        $config['media_fit'] = self::normalizeMediaFit(
            $values['splash_media_fit'] ?? $values['media_fit'] ?? $config['media_fit']
        );

        if (array_key_exists('splash_video_loop', $values)) {
            $config['video_loop'] = filter_var($values['splash_video_loop'], FILTER_VALIDATE_BOOL);
        } elseif (array_key_exists('video_loop', $values)) {
            $config['video_loop'] = filter_var($values['video_loop'], FILTER_VALIDATE_BOOL);
        }

        if (array_key_exists('splash_video_muted', $values)) {
            $config['video_muted'] = filter_var($values['splash_video_muted'], FILTER_VALIDATE_BOOL);
        } elseif (array_key_exists('video_muted', $values)) {
            $config['video_muted'] = filter_var($values['video_muted'], FILTER_VALIDATE_BOOL);
        }

        if (array_key_exists('splash_show_system_name', $values)) {
            $config['show_system_name'] = filter_var($values['splash_show_system_name'], FILTER_VALIDATE_BOOL);
        } elseif (array_key_exists('show_system_name', $values)) {
            $config['show_system_name'] = filter_var($values['show_system_name'], FILTER_VALIDATE_BOOL);
        }

        $config['system_name_animation'] = self::normalizeSystemNameAnimation(
            $values['splash_system_name_animation'] ?? $values['system_name_animation'] ?? null
        );
        $config['system_name_color'] = self::normalizeColor(
            $values['splash_system_name_color'] ?? $values['system_name_color'] ?? $config['system_name_color'],
            $config['system_name_color']
        );
        $config['system_name_size_percent'] = self::clampInt(
            $values['splash_system_name_size_percent'] ?? $values['system_name_size_percent'] ?? $config['system_name_size_percent'],
            70,
            150
        );
        $config['system_name_position'] = self::normalizeSystemNamePosition(
            $values['splash_system_name_position'] ?? $values['system_name_position'] ?? $config['system_name_position']
        );
        $config['backdrop_blur'] = self::clampInt(
            $values['splash_backdrop_blur'] ?? $values['backdrop_blur'] ?? $config['backdrop_blur'],
            0,
            24
        );
        $config['background_overlay_opacity'] = self::clampInt(
            $values['splash_background_overlay_opacity'] ?? $values['background_overlay_opacity'] ?? $config['background_overlay_opacity'],
            0,
            80
        );
        $config['background_style'] = self::normalizeBackgroundStyle(
            $values['splash_background_style'] ?? $values['background_style'] ?? null
        );
        $config['background_gradient_angle'] = self::clampInt(
            $values['splash_background_gradient_angle'] ?? $values['background_gradient_angle'] ?? $config['background_gradient_angle'],
            0,
            360
        );
        $config['background_blur'] = self::clampInt(
            $values['splash_background_blur'] ?? $values['background_blur'] ?? $config['background_blur'],
            0,
            60
        );

        return $config;
    }

    public static function normalizeBackgroundStyle(?string $style): string
    {
        $style = is_string($style) ? trim($style) : '';

        return array_key_exists($style, self::BACKGROUND_STYLES) ? $style : 'solid';
    }

    /** @return list<array{id: string, label: string, description: string}> */
    public static function backgroundStyleCatalog(): array
    {
        return array_map(
            fn (string $id, array $meta) => [
                'id' => $id,
                'label' => $meta['label'],
                'description' => $meta['description'],
            ],
            array_keys(self::BACKGROUND_STYLES),
            self::BACKGROUND_STYLES
        );
    }

    public static function normalizeSystemNameAnimation(?string $animation): string
    {
        $animation = is_string($animation) ? trim($animation) : '';

        return array_key_exists($animation, self::SYSTEM_NAME_ANIMATIONS) ? $animation : 'fade-rise';
    }

    /** @return list<array{id: string, label: string, description: string}> */
    public static function systemNameCatalog(): array
    {
        return array_map(
            fn (string $id, array $meta) => [
                'id' => $id,
                'label' => $meta['label'],
                'description' => $meta['description'],
            ],
            array_keys(self::SYSTEM_NAME_ANIMATIONS),
            self::SYSTEM_NAME_ANIMATIONS
        );
    }

    /** @return array<string, mixed> */
    public static function toDatabaseColumns(array $config): array
    {
        return [
            'splash_animation_style' => $config['animation_style'],
            'splash_enabled' => $config['enabled'],
            'splash_background_color' => $config['background_color'],
            'splash_accent_color' => $config['accent_color'],
            'splash_secondary_color' => $config['secondary_color'],
            'splash_min_duration_ms' => $config['min_duration_ms'],
            'splash_max_duration_ms' => $config['max_duration_ms'],
            'splash_speed_percent' => $config['speed_percent'],
            'splash_exit_fade_ms' => $config['exit_fade_ms'],
            'splash_logo_scale_percent' => $config['logo_scale_percent'],
            'splash_logo_url' => $config['logo_url'],
            'splash_show_logo' => $config['show_logo'],
            'splash_media_fit' => $config['media_fit'],
            'splash_video_loop' => $config['video_loop'],
            'splash_video_muted' => $config['video_muted'],
            'splash_show_system_name' => $config['show_system_name'],
            'splash_system_name_animation' => $config['system_name_animation'],
            'splash_system_name_color' => $config['system_name_color'],
            'splash_system_name_size_percent' => $config['system_name_size_percent'],
            'splash_system_name_position' => $config['system_name_position'],
            'splash_backdrop_blur' => $config['backdrop_blur'],
            'splash_background_overlay_opacity' => $config['background_overlay_opacity'],
            'splash_background_style' => $config['background_style'],
            'splash_background_gradient_angle' => $config['background_gradient_angle'],
            'splash_background_blur' => $config['background_blur'],
        ];
    }

    /** @return array<string, mixed> */
    public static function validationRules(): array
    {
        return [
            'splash_enabled' => ['nullable', 'boolean'],
            'splash_background_color' => ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'splash_accent_color' => ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'splash_secondary_color' => ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'splash_min_duration_ms' => ['nullable', 'integer', 'min:400', 'max:15000'],
            'splash_max_duration_ms' => ['nullable', 'integer', 'min:2000', 'max:30000'],
            'splash_speed_percent' => ['nullable', 'integer', 'min:50', 'max:200'],
            'splash_exit_fade_ms' => ['nullable', 'integer', 'min:150', 'max:1200'],
            'splash_logo_scale_percent' => ['nullable', 'integer', 'min:50', 'max:200'],
            'splash_logo_url' => ['nullable', 'string', 'max:2048'],
            'splash_show_logo' => ['nullable', 'boolean'],
            'splash_media_fit' => ['nullable', 'in:contain,cover,fill'],
            'splash_video_loop' => ['nullable', 'boolean'],
            'splash_video_muted' => ['nullable', 'boolean'],
            'splash_show_system_name' => ['nullable', 'boolean'],
            'splash_system_name_animation' => ['nullable', 'string', 'in:'.implode(',', array_keys(self::SYSTEM_NAME_ANIMATIONS))],
            'splash_system_name_color' => ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'splash_system_name_size_percent' => ['nullable', 'integer', 'min:70', 'max:150'],
            'splash_system_name_position' => ['nullable', 'in:below,above'],
            'splash_backdrop_blur' => ['nullable', 'integer', 'min:0', 'max:24'],
            'splash_background_overlay_opacity' => ['nullable', 'integer', 'min:0', 'max:80'],
            'splash_background_style' => ['nullable', 'string', 'in:'.implode(',', array_keys(self::BACKGROUND_STYLES))],
            'splash_background_gradient_angle' => ['nullable', 'integer', 'min:0', 'max:360'],
            'splash_background_blur' => ['nullable', 'integer', 'min:0', 'max:60'],
        ];
    }

    private static function normalizeUrl(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $value = trim($value);

        if ($value === '') {
            return null;
        }

        if (preg_match('/^https?:\/\/.+/i', $value) === 1) {
            return $value;
        }

        if (str_starts_with($value, '/')) {
            return $value;
        }

        return null;
    }

    private static function normalizeMediaFit(mixed $value): string
    {
        $value = is_string($value) ? strtolower(trim($value)) : '';

        return in_array($value, ['contain', 'cover', 'fill'], true) ? $value : 'contain';
    }

    private static function normalizeSystemNamePosition(mixed $value): string
    {
        $value = is_string($value) ? strtolower(trim($value)) : '';

        return in_array($value, ['below', 'above'], true) ? $value : 'below';
    }

    private static function normalizeColor(mixed $value, string $fallback): string
    {
        if (! is_string($value)) {
            return strtoupper($fallback);
        }

        $value = trim($value);

        if (preg_match('/^#[0-9A-Fa-f]{6}$/', $value) !== 1) {
            return strtoupper($fallback);
        }

        return strtoupper($value);
    }

    private static function clampInt(mixed $value, int $min, int $max): int
    {
        if (! is_numeric($value)) {
            return $min;
        }

        return max($min, min($max, (int) $value));
    }
}
