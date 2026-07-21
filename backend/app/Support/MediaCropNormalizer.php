<?php

namespace App\Support;

class MediaCropNormalizer
{
    private const COORD_MIN = -100.0;

    private const COORD_MAX = 200.0;

    private const SIZE_MIN = 0.01;

    private const SIZE_MAX = 200.0;

    /**
     * Normalize cropper output. Zoom-out may use negative coords / sizes over 100 —
     * those are preserved so display can match the cropper (padded fit).
     *
     * @param  array<string, mixed>|null  $area
     * @return array{x: float, y: float, width: float, height: float}|null
     */
    public static function normalize(?array $area): ?array
    {
        if ($area === null) {
            return null;
        }

        if (! isset($area['x'], $area['y'], $area['width'], $area['height'])) {
            return null;
        }

        $x = (float) $area['x'];
        $y = (float) $area['y'];
        $width = (float) $area['width'];
        $height = (float) $area['height'];

        if (! is_finite($x) || ! is_finite($y) || ! is_finite($width) || ! is_finite($height)) {
            return null;
        }

        return [
            'x' => min(max($x, self::COORD_MIN), self::COORD_MAX),
            'y' => min(max($y, self::COORD_MIN), self::COORD_MAX),
            'width' => min(max($width, self::SIZE_MIN), self::SIZE_MAX),
            'height' => min(max($height, self::SIZE_MIN), self::SIZE_MAX),
        ];
    }

    /**
     * @param  array<string, mixed>|null  $crops
     * @return array{desktop?: array{x: float, y: float, width: float, height: float}, mobile?: array{x: float, y: float, width: float, height: float}}|null
     */
    public static function normalizeCoverCrops(?array $crops): ?array
    {
        if ($crops === null) {
            return null;
        }

        $normalized = [];

        if (array_key_exists('desktop', $crops)) {
            $desktop = self::normalize(is_array($crops['desktop']) ? $crops['desktop'] : null);
            if ($desktop) {
                $normalized['desktop'] = $desktop;
            }
        }

        if (array_key_exists('mobile', $crops)) {
            $mobile = self::normalize(is_array($crops['mobile']) ? $crops['mobile'] : null);
            if ($mobile) {
                $normalized['mobile'] = $mobile;
            }
        }

        return $normalized === [] ? null : $normalized;
    }
}
