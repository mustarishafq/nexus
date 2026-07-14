<?php

namespace App\Support;

class MediaCropNormalizer
{
    /**
     * Normalize cropper output into a 0–100% area.
     * Zooming out can produce negative coords / widths over 100 — treat that as “fit full image”.
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

        $extendsOutsideImage = $x < -0.01
            || $y < -0.01
            || $width > 100.01
            || $height > 100.01
            || ($x + $width) > 100.01
            || ($y + $height) > 100.01;

        if ($extendsOutsideImage) {
            return [
                'x' => 0.0,
                'y' => 0.0,
                'width' => 100.0,
                'height' => 100.0,
            ];
        }

        $nextWidth = min(max($width, 0.01), 100.0);
        $nextHeight = min(max($height, 0.01), 100.0);

        return [
            'x' => min(max($x, 0.0), 100.0 - $nextWidth),
            'y' => min(max($y, 0.0), 100.0 - $nextHeight),
            'width' => $nextWidth,
            'height' => $nextHeight,
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
