<?php

namespace App\Support;

class ApplicationLaunchSettings
{
    public const DEFAULT_ANIMATION = 'warp';

    public const DEFAULT_OVERLAY_MODE = 'fullscreen';

    public const DEFAULT_PROGRESS_STYLE = 'bar';

    public const DEFAULT_DURATION = 'normal';

    /** @var array<string, mixed> */
    public const DEFAULTS = [
        'animation_style' => self::DEFAULT_ANIMATION,
        'overlay_mode' => self::DEFAULT_OVERLAY_MODE,
        'progress_style' => self::DEFAULT_PROGRESS_STYLE,
        'duration' => self::DEFAULT_DURATION,
        'interactive' => true,
        'show_skip' => true,
        'show_hint' => true,
    ];

    /** @var array<string, array{label: string, description: string, hint?: string, category?: string}> */
    public const ANIMATIONS = [
        'none' => [
            'label' => 'Instant',
            'description' => 'Skip the overlay and open immediately.',
            'hint' => 'Best for power users who prefer zero delay.',
            'category' => 'instant',
        ],
        'warp' => [
            'label' => 'Warp Drive',
            'description' => 'Star streaks rush past as the app logo zooms forward.',
            'hint' => 'Tap anywhere to jump to hyperdrive.',
            'category' => 'space',
        ],
        'orbit' => [
            'label' => 'Orbital Sync',
            'description' => 'Satellites orbit the app icon before lift-off.',
            'hint' => 'Tap to add orbiters and accelerate.',
            'category' => 'space',
        ],
        'portal' => [
            'label' => 'Portal Step',
            'description' => 'A swirling portal opens around the app logo.',
            'hint' => 'Tap or hold to step through the portal.',
            'category' => 'energy',
        ],
        'ignite' => [
            'label' => 'Ignition',
            'description' => 'Embers gather around the logo before blast-off.',
            'hint' => 'Tap to stoke the flames and launch faster.',
            'category' => 'energy',
        ],
        'pulse' => [
            'label' => 'Pulse Rings',
            'description' => 'Concentric rings pulse outward from the logo.',
            'hint' => 'Tap to amplify the pulse.',
            'category' => 'energy',
        ],
        'aurora' => [
            'label' => 'Aurora',
            'description' => 'Northern-lights gradients swirl behind the logo.',
            'hint' => 'Tap to brighten the aurora.',
            'category' => 'nature',
        ],
        'glitch' => [
            'label' => 'Glitch',
            'description' => 'RGB channels jitter before the logo locks in.',
            'hint' => 'Tap to destabilize and resync faster.',
            'category' => 'glitch',
        ],
        'liquid' => [
            'label' => 'Liquid Morph',
            'description' => 'Fluid blobs merge into the app icon.',
            'hint' => 'Tap to stir the liquid.',
            'category' => 'liquid',
        ],
        'vortex' => [
            'label' => 'Vortex',
            'description' => 'A spiral tunnel pulls the logo forward.',
            'hint' => 'Tap to spin the vortex faster.',
            'category' => 'space',
        ],
        'magnetic' => [
            'label' => 'Magnetic Pull',
            'description' => 'Particles snap inward to assemble the logo.',
            'hint' => 'Tap to strengthen the magnetic field.',
            'category' => 'energy',
        ],
        'comet' => [
            'label' => 'Comet Trail',
            'description' => 'A blazing comet orbits and settles on the icon.',
            'hint' => 'Tap to ignite a brighter tail.',
            'category' => 'space',
        ],
        'neon' => [
            'label' => 'Neon Flicker',
            'description' => 'A buzzing neon frame flickers on around the logo.',
            'hint' => 'Tap to stabilize the neon sign.',
            'category' => 'energy',
        ],
        'bounce' => [
            'label' => 'Bounce In',
            'description' => 'Logo drops in with a playful elastic bounce.',
            'hint' => 'Tap to add extra bounce.',
            'category' => 'energy',
        ],
        'hologram' => [
            'label' => 'Hologram',
            'description' => 'Scan lines flicker before the logo stabilizes.',
            'hint' => 'Tap to sharpen the projection.',
            'category' => 'glitch',
        ],
        'prism' => [
            'label' => 'Prism Split',
            'description' => 'RGB light channels converge into the logo.',
            'hint' => 'Tap to align the spectrum.',
            'category' => 'energy',
        ],
        'smoke' => [
            'label' => 'Smoke Rise',
            'description' => 'Wisps of smoke clear to reveal the logo.',
            'hint' => 'Tap to blow the smoke away.',
            'category' => 'nature',
        ],
        'glitch_rgb' => [
            'label' => 'RGB Split',
            'description' => 'Chromatic aberration splits then snaps the logo into focus.',
            'hint' => 'Tap to misalign channels faster.',
            'category' => 'glitch',
        ],
        'static_burst' => [
            'label' => 'Static Burst',
            'description' => 'TV static noise clears to reveal the sharp logo.',
            'hint' => 'Tap to clear static sooner.',
            'category' => 'glitch',
        ],
        'datamosh' => [
            'label' => 'Datamosh',
            'description' => 'Horizontal slices shear and reassemble the icon.',
            'hint' => 'Tap to corrupt more slices.',
            'category' => 'glitch',
        ],
        'hologram_grid' => [
            'label' => 'Hologram Grid',
            'description' => 'Wireframe grid rotates behind a projected logo.',
            'hint' => 'Tap to lock the projection.',
            'category' => 'hologram',
        ],
        'scanline' => [
            'label' => 'Scanline Sweep',
            'description' => 'A CRT scan beam sweeps down before the logo appears.',
            'hint' => 'Tap to speed up the sweep.',
            'category' => 'hologram',
        ],
        'cyber_hex' => [
            'label' => 'Cyber Hex',
            'description' => 'Honeycomb hexagons orbit and dock on the logo.',
            'hint' => 'Tap to add hex cells.',
            'category' => 'energy',
        ],
        'laser_grid' => [
            'label' => 'Laser Grid',
            'description' => 'Perspective laser grid converges on the brand mark.',
            'hint' => 'Tap to tighten the grid.',
            'category' => 'hologram',
        ],
        'crystal' => [
            'label' => 'Crystal Shatter',
            'description' => 'Glass shards burst outward, revealing the logo.',
            'hint' => 'Tap to shatter faster.',
            'category' => 'energy',
        ],
        'flip' => [
            'label' => 'Flip Reveal',
            'description' => 'Logo flips into view on a 3D axis.',
            'hint' => 'Tap to complete the flip.',
            'category' => 'energy',
        ],
        'ink_drop' => [
            'label' => 'Ink Drop',
            'description' => 'Ink ripples spread outward from the logo center.',
            'hint' => 'Tap to send another ripple.',
            'category' => 'liquid',
        ],
        'fold' => [
            'label' => 'Fold Unfold',
            'description' => 'Paper panels unfold to expose the logo.',
            'hint' => 'Tap to unfold quicker.',
            'category' => 'energy',
        ],
        'ring_fire' => [
            'label' => 'Ring of Fire',
            'description' => 'A fiery halo spins before the brand ignites.',
            'hint' => 'Tap to stoke the flames.',
            'category' => 'energy',
        ],
        'dna' => [
            'label' => 'DNA Helix',
            'description' => 'Twin helix strands spiral around the logo.',
            'hint' => 'Tap to tighten the spiral.',
            'category' => 'nature',
        ],
        'particle_burst' => [
            'label' => 'Particle Burst',
            'description' => 'Sparks burst outward, then the logo resolves.',
            'hint' => 'Tap to trigger another burst.',
            'category' => 'energy',
        ],
        'pixelate' => [
            'label' => 'Pixelate',
            'description' => 'Blocky pixels dissolve into a sharp logo.',
            'hint' => 'Tap to resolve pixels faster.',
            'category' => 'glitch',
        ],
        'holo_flicker' => [
            'label' => 'Holo Flicker',
            'description' => 'Unstable hologram flickers before locking in.',
            'hint' => 'Tap to stabilize the signal.',
            'category' => 'hologram',
        ],
        'shockwave' => [
            'label' => 'Shockwave',
            'description' => 'An explosive ring expands from the logo center.',
            'hint' => 'Tap to amplify the blast.',
            'category' => 'energy',
        ],
        'tornado' => [
            'label' => 'Tornado',
            'description' => 'A spinning funnel lifts the logo into view.',
            'hint' => 'Tap to spin faster.',
            'category' => 'nature',
        ],
        'eclipse' => [
            'label' => 'Eclipse',
            'description' => 'A dark disc passes to reveal the bright logo.',
            'hint' => 'Tap to speed the eclipse.',
            'category' => 'space',
        ],
        'zoom_blur' => [
            'label' => 'Zoom Blur',
            'description' => 'Motion-blurred zoom rushes into the sharp logo.',
            'hint' => 'Tap to punch in harder.',
            'category' => 'energy',
        ],
        'sandstorm' => [
            'label' => 'Sandstorm',
            'description' => 'Swirling grains part to reveal the logo.',
            'hint' => 'Tap to clear the storm.',
            'category' => 'nature',
        ],
    ];

    /** @var array<string, string> */
    public const OVERLAY_PLACEMENTS = [
        'fullscreen' => 'fullscreen',
        'blur' => 'fullscreen',
        'frosted' => 'fullscreen',
        'spotlight' => 'fullscreen',
        'gradient' => 'fullscreen',
        'mesh' => 'fullscreen',
        'split' => 'fullscreen',
        'cinema' => 'fullscreen',
        'glitch_frame' => 'border',
        'aurora_full' => 'fullscreen',
        'scanlines_full' => 'fullscreen',
        'void' => 'fullscreen',
        'prism_full' => 'fullscreen',
        'circuit_board' => 'fullscreen',
        'hologram_full' => 'fullscreen',
        'vignette' => 'fullscreen',
        'orbit_frame' => 'border',
        'interactive_glow' => 'fullscreen',
        'card' => 'center',
        'glass' => 'center',
        'glass_deep' => 'center',
        'bubble' => 'center',
        'tilt' => 'center',
        'mirror' => 'center',
        'clear_glass' => 'center',
        'neon_frame' => 'border',
        'hologram_panel' => 'border',
        'prism_edge' => 'border',
        'crt_monitor' => 'border',
        'hexagon_panel' => 'border',
        'glitch_panel' => 'border',
        'polaroid' => 'border',
        'stained_glass' => 'border',
        'pixel_frame' => 'border',
        'minimal' => 'bottom',
        'dock' => 'bottom',
        'bottom_sheet' => 'bottom',
        'full_glass' => 'bottom',
        'corner' => 'bottom_right',
        'top_banner' => 'top',
        'sidebar' => 'side',
        'right_rail' => 'side',
    ];

    /** @var array<string, array{label: string, description: string}> */
    public const OVERLAY_MODES = [
        'fullscreen' => [
            'label' => 'Fullscreen',
            'description' => 'Immersive full-screen launch overlay.',
        ],
        'card' => [
            'label' => 'Center card',
            'description' => 'Floating card centered on a dimmed backdrop.',
        ],
        'glass' => [
            'label' => 'Glass panel',
            'description' => 'Frosted glass panel with blurred background.',
        ],
        'clear_glass' => [
            'label' => 'Clear glass modal',
            'description' => 'See-through glass modal — background stays sharp with only a light panel blur.',
        ],
        'spotlight' => [
            'label' => 'Spotlight',
            'description' => 'Radial spotlight framing the app logo.',
        ],
        'cinema' => [
            'label' => 'Cinema',
            'description' => 'Letterboxed cinematic presentation.',
        ],
        'minimal' => [
            'label' => 'Bottom bar',
            'description' => 'Compact progress bar anchored to the bottom.',
        ],
        'dock' => [
            'label' => 'Dock',
            'description' => 'Dock-style panel rising from the bottom edge.',
        ],
        'corner' => [
            'label' => 'Corner',
            'description' => 'Small floating card in the bottom-right corner.',
        ],
        'blur' => [
            'label' => 'Heavy blur',
            'description' => 'Full-screen backdrop with deep gaussian blur.',
        ],
        'frosted' => [
            'label' => 'Frosted veil',
            'description' => 'Entire screen wrapped in a frosted glass veil.',
        ],
        'glass_deep' => [
            'label' => 'Deep glass',
            'description' => 'Layered frosted panels with inner glow and depth.',
        ],
        'bubble' => [
            'label' => 'Bubble',
            'description' => 'Floating luminous bubble with soft refraction.',
        ],
        'gradient' => [
            'label' => 'Gradient mesh',
            'description' => 'Animated brand-gradient mesh fills the screen.',
        ],
        'mesh' => [
            'label' => 'Color mesh',
            'description' => 'Blurred color blobs drift behind the launch card.',
        ],
        'neon_frame' => [
            'label' => 'Neon frame',
            'description' => 'Pulsing neon border frames the launch content.',
        ],
        'hologram_panel' => [
            'label' => 'Hologram panel',
            'description' => 'Scanline holographic sheet with cyan edges.',
        ],
        'prism_edge' => [
            'label' => 'Prism edge',
            'description' => 'Prismatic light splits along the panel edges.',
        ],
        'interactive_glow' => [
            'label' => 'Pointer glow',
            'description' => 'Spotlight follows your cursor or tap position.',
        ],
        'tilt' => [
            'label' => 'Tilt card',
            'description' => '3D-tilted card that responds to pointer movement.',
        ],
        'split' => [
            'label' => 'Split reveal',
            'description' => 'Two panels part to reveal the launch content.',
        ],
        'glitch_frame' => [
            'label' => 'Glitch frame',
            'description' => 'Full-screen overlay with RGB-jitter border.',
        ],
        'crt_monitor' => [
            'label' => 'CRT monitor',
            'description' => 'Retro monitor bezel around a scanline panel.',
        ],
        'hexagon_panel' => [
            'label' => 'Hexagon panel',
            'description' => 'Hexagonal floating panel with soft glow.',
        ],
        'sidebar' => [
            'label' => 'Side panel',
            'description' => 'Tall panel slides in from the left edge.',
        ],
        'top_banner' => [
            'label' => 'Top banner',
            'description' => 'Compact banner strip across the top.',
        ],
        'aurora_full' => [
            'label' => 'Aurora sky',
            'description' => 'Full-screen northern-lights gradient backdrop.',
        ],
        'scanlines_full' => [
            'label' => 'CRT scanlines',
            'description' => 'Full-screen retro scanline overlay.',
        ],
        'void' => [
            'label' => 'Deep void',
            'description' => 'Infinite dark radial void engulfs the screen.',
        ],
        'mirror' => [
            'label' => 'Mirror glass',
            'description' => 'Reflective glass panel with shine highlights.',
        ],
        'glitch_panel' => [
            'label' => 'Glitch panel',
            'description' => 'Floating card with chromatic edge glitch.',
        ],
        'polaroid' => [
            'label' => 'Polaroid',
            'description' => 'Photo-style card with white frame and shadow.',
        ],
        'bottom_sheet' => [
            'label' => 'Bottom sheet',
            'description' => 'Rounded sheet slides up from the bottom.',
        ],
        'full_glass' => [
            'label' => 'Full glass',
            'description' => 'Full-screen frosted glass sheet with the same slide-up feel.',
        ],
        'right_rail' => [
            'label' => 'Right rail',
            'description' => 'Narrow panel anchored to the right edge.',
        ],
        'prism_full' => [
            'label' => 'Prism sky',
            'description' => 'Full-screen prismatic color wash.',
        ],
        'circuit_board' => [
            'label' => 'Circuit board',
            'description' => 'Glowing circuit traces across the screen.',
        ],
        'hologram_full' => [
            'label' => 'Hologram field',
            'description' => 'Full-screen holographic grid and scanlines.',
        ],
        'vignette' => [
            'label' => 'Vignette',
            'description' => 'Heavy edge darkening frames the center.',
        ],
        'stained_glass' => [
            'label' => 'Stained glass',
            'description' => 'Colorful glass panel with lead-line segments.',
        ],
        'pixel_frame' => [
            'label' => 'Pixel frame',
            'description' => 'Retro pixel border around a floating card.',
        ],
        'orbit_frame' => [
            'label' => 'Orbit frame',
            'description' => 'Orbiting dots trace a full-screen border.',
        ],
    ];

    /** @var array<string, array{label: string, description: string}> */
    public const PROGRESS_STYLES = [
        'bar' => [
            'label' => 'Loading bar',
            'description' => 'Horizontal bar that fills as launch progresses.',
        ],
        'liquid_bar' => [
            'label' => 'Liquid bar',
            'description' => 'Wavy liquid fill with a glossy surface.',
        ],
        'spinner' => [
            'label' => 'Spinner',
            'description' => 'Circular spinner with percentage in the center.',
        ],
        'dots' => [
            'label' => 'Dots',
            'description' => 'Three animated dots that light up in sequence.',
        ],
        'ring' => [
            'label' => 'Ring',
            'description' => 'Circular progress ring with percentage.',
        ],
        'percent' => [
            'label' => 'Percentage',
            'description' => 'Large numeric percentage with loading label.',
        ],
        'pulse' => [
            'label' => 'Pulse',
            'description' => 'Pulsing dot that grows with progress.',
        ],
        'none' => [
            'label' => 'Hidden',
            'description' => 'Hide the progress indicator.',
        ],
        'wave' => [
            'label' => 'Wave',
            'description' => 'Sine wave bar that ripples as it fills.',
        ],
        'segmented' => [
            'label' => 'Segmented',
            'description' => 'Block segments light up one by one.',
        ],
        'stripe' => [
            'label' => 'Stripes',
            'description' => 'Diagonal animated stripes show progress.',
        ],
        'ladder' => [
            'label' => 'Ladder',
            'description' => 'Step blocks climb upward with progress.',
        ],
        'orbit_track' => [
            'label' => 'Orbit track',
            'description' => 'Dot orbits a circular track as progress advances.',
        ],
        'gradient_ring' => [
            'label' => 'Gradient ring',
            'description' => 'Rainbow gradient ring with percentage.',
        ],
        'glitch_bar' => [
            'label' => 'Glitch bar',
            'description' => 'Progress bar with RGB glitch jitter.',
        ],
        'neon_bar' => [
            'label' => 'Neon bar',
            'description' => 'Glowing neon tube that fills with light.',
        ],
        'hologram_ring' => [
            'label' => 'Hologram ring',
            'description' => 'Cyan holographic ring with scanline flicker.',
        ],
        'glitch_percent' => [
            'label' => 'Glitch percent',
            'description' => 'Jittery percentage with RGB offset.',
        ],
        'matrix_stream' => [
            'label' => 'Matrix stream',
            'description' => 'Falling code characters inside the bar.',
        ],
        'scanline_bar' => [
            'label' => 'Scanline bar',
            'description' => 'CRT bar with a moving scan beam.',
        ],
        'hex_segments' => [
            'label' => 'Hex segments',
            'description' => 'Hexagonal cells fill in sequence.',
        ],
        'radar_sweep' => [
            'label' => 'Radar sweep',
            'description' => 'Rotating radar arc shows progress.',
        ],
        'binary' => [
            'label' => 'Binary',
            'description' => 'Binary counter climbs with progress.',
        ],
        'crt_bar' => [
            'label' => 'CRT bar',
            'description' => 'Thick retro tube with phosphor glow.',
        ],
        'hologram_bar' => [
            'label' => 'Hologram bar',
            'description' => 'Shimmering holographic fill bar.',
        ],
        'glitch_dots' => [
            'label' => 'Glitch dots',
            'description' => 'Dots jump with chromatic glitch offset.',
        ],
        'plasma_bar' => [
            'label' => 'Plasma bar',
            'description' => 'Swirling plasma energy fills the tube.',
        ],
        'pixel_blocks' => [
            'label' => 'Pixel blocks',
            'description' => 'Retro pixel squares light up in sequence.',
        ],
        'orbit_dots' => [
            'label' => 'Orbit dots',
            'description' => 'Multiple dots race around a circular track.',
        ],
        'heartbeat' => [
            'label' => 'Heartbeat',
            'description' => 'ECG-style pulse line climbs with progress.',
        ],
        'countdown' => [
            'label' => 'Countdown',
            'description' => 'Large numerals tick down as launch completes.',
        ],
        'fire_trail' => [
            'label' => 'Fire trail',
            'description' => 'Flaming gradient bar scorches forward.',
        ],
        'circuit_trace' => [
            'label' => 'Circuit trace',
            'description' => 'Circuit path lights up segment by segment.',
        ],
        'holo_segments' => [
            'label' => 'Holo segments',
            'description' => 'Shimmering holographic blocks fill in.',
        ],
        'prism_bar' => [
            'label' => 'Prism bar',
            'description' => 'Rainbow prism spectrum fills the bar.',
        ],
        'morse_dash' => [
            'label' => 'Morse dash',
            'description' => 'Dashes and dots pulse with progress.',
        ],
    ];

    /** @var array<string, array{label: string, description: string, min_ms: int, max_ms: int}> */
    public const DURATIONS = [
        'quick' => [
            'label' => 'Quick',
            'description' => 'Short launch sequence (~1.2s).',
            'min_ms' => 700,
            'max_ms' => 2200,
        ],
        'normal' => [
            'label' => 'Normal',
            'description' => 'Balanced launch timing (~2s).',
            'min_ms' => 900,
            'max_ms' => 3200,
        ],
        'slow' => [
            'label' => 'Cinematic',
            'description' => 'Longer, more dramatic launch (~3.5s).',
            'min_ms' => 1400,
            'max_ms' => 4800,
        ],
    ];

    public static function normalizeAnimation(?string $style): string
    {
        $style = is_string($style) ? trim($style) : '';

        return array_key_exists($style, self::ANIMATIONS) ? $style : self::DEFAULT_ANIMATION;
    }

    public static function normalizeOverlayMode(?string $mode): string
    {
        $mode = is_string($mode) ? trim($mode) : '';

        return array_key_exists($mode, self::OVERLAY_MODES) ? $mode : self::DEFAULT_OVERLAY_MODE;
    }

    public static function normalizeProgressStyle(?string $style): string
    {
        $style = is_string($style) ? trim($style) : '';

        return array_key_exists($style, self::PROGRESS_STYLES) ? $style : self::DEFAULT_PROGRESS_STYLE;
    }

    public static function normalizeDuration(?string $duration): string
    {
        $duration = is_string($duration) ? trim($duration) : '';

        return array_key_exists($duration, self::DURATIONS) ? $duration : self::DEFAULT_DURATION;
    }

    /** @param array<string, mixed>|object|null $input */
    public static function normalizeConfig(array|object|null $input = null): array
    {
        $values = is_object($input) ? (array) $input : ($input ?? []);
        $config = self::DEFAULTS;

        $config['animation_style'] = self::normalizeAnimation(
            $values['launch_animation_style'] ?? $values['animation_style'] ?? null
        );
        $config['overlay_mode'] = self::normalizeOverlayMode(
            $values['launch_overlay_mode'] ?? $values['overlay_mode'] ?? null
        );
        $config['progress_style'] = self::normalizeProgressStyle(
            $values['launch_progress_style'] ?? $values['progress_style'] ?? null
        );
        $config['duration'] = self::normalizeDuration(
            $values['launch_duration'] ?? $values['duration'] ?? null
        );

        foreach (['interactive' => 'launch_interactive', 'show_skip' => 'launch_show_skip', 'show_hint' => 'launch_show_hint'] as $key => $legacyKey) {
            if (array_key_exists($legacyKey, $values)) {
                $config[$key] = filter_var($values[$legacyKey], FILTER_VALIDATE_BOOL);
            } elseif (array_key_exists($key, $values)) {
                $config[$key] = filter_var($values[$key], FILTER_VALIDATE_BOOL);
            }
        }

        return $config;
    }

    /** @return list<array{id: string, label: string, description: string, hint?: string, category?: string}> */
    public static function animationCatalog(): array
    {
        return self::catalogFromMap(self::ANIMATIONS);
    }

    /** @return list<array{id: string, label: string, description: string, placement?: string}> */
    public static function overlayModeCatalog(): array
    {
        return array_map(
            fn (array $item) => array_merge($item, [
                'placement' => self::OVERLAY_PLACEMENTS[$item['id']] ?? 'fullscreen',
            ]),
            self::catalogFromMap(self::OVERLAY_MODES)
        );
    }

    /** @return list<array{id: string, label: string, description: string}> */
    public static function progressStyleCatalog(): array
    {
        return self::catalogFromMap(self::PROGRESS_STYLES);
    }

    /** @return list<array{id: string, label: string, description: string, min_ms: int, max_ms: int}> */
    public static function durationCatalog(): array
    {
        return array_map(
            fn (string $id, array $meta) => [
                'id' => $id,
                'label' => $meta['label'],
                'description' => $meta['description'],
                'min_ms' => $meta['min_ms'],
                'max_ms' => $meta['max_ms'],
            ],
            array_keys(self::DURATIONS),
            self::DURATIONS
        );
    }

    /** @return array<string, mixed> */
    public static function toDatabaseColumns(array $config): array
    {
        return [
            'launch_animation_style' => $config['animation_style'],
            'launch_overlay_mode' => $config['overlay_mode'],
            'launch_progress_style' => $config['progress_style'],
            'launch_duration' => $config['duration'],
            'launch_interactive' => $config['interactive'],
            'launch_show_skip' => $config['show_skip'],
            'launch_show_hint' => $config['show_hint'],
        ];
    }

    /** @return array<string, mixed> */
    public static function validationRules(): array
    {
        return [
            'launch_animation_style' => ['nullable', 'string', 'in:'.implode(',', array_keys(self::ANIMATIONS))],
            'launch_overlay_mode' => ['nullable', 'string', 'in:'.implode(',', array_keys(self::OVERLAY_MODES))],
            'launch_progress_style' => ['nullable', 'string', 'in:'.implode(',', array_keys(self::PROGRESS_STYLES))],
            'launch_duration' => ['nullable', 'string', 'in:'.implode(',', array_keys(self::DURATIONS))],
            'launch_interactive' => ['nullable', 'boolean'],
            'launch_show_skip' => ['nullable', 'boolean'],
            'launch_show_hint' => ['nullable', 'boolean'],
        ];
    }

    /** @param array<string, array<string, mixed>> $map */
    private static function catalogFromMap(array $map): array
    {
        return array_map(
            fn (string $id, array $meta) => array_merge(['id' => $id], $meta),
            array_keys($map),
            $map
        );
    }
}
