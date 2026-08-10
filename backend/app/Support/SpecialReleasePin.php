<?php

namespace App\Support;

/**
 * Approved special-release geofence pin resolved from Insan for Brain clock-in.
 */
final class SpecialReleasePin
{
    public function __construct(
        public readonly int $id,
        public readonly string $type,
        public readonly ?string $date,
        public readonly ?string $endDate,
        public readonly float $centerLatitude,
        public readonly float $centerLongitude,
        public readonly int $radiusMeters,
        public readonly bool $allowOutsideRadius = false,
        public readonly ?string $locationLabel = null,
        public readonly ?string $mapsUrl = null,
        public readonly bool $overwriteShift = false,
        public readonly ?string $shiftStartTime = null,
        public readonly ?string $shiftEndTime = null,
        public readonly bool $shiftCrossesMidnight = false,
    ) {}

    /**
     * @param  array<string, mixed>  $row
     */
    public static function fromCoveringRow(array $row): ?self
    {
        $id = (int) ($row['id'] ?? 0);
        $lat = $row['center_latitude'] ?? null;
        $lng = $row['center_longitude'] ?? null;
        $radius = (int) ($row['radius_meters'] ?? 0);

        if ($id < 1 || $lat === null || $lng === null || $radius < 1) {
            return null;
        }

        return new self(
            id: $id,
            type: (string) ($row['type'] ?? 'other'),
            date: isset($row['date']) ? (string) $row['date'] : null,
            endDate: isset($row['end_date']) ? (string) $row['end_date'] : null,
            centerLatitude: (float) $lat,
            centerLongitude: (float) $lng,
            radiusMeters: $radius,
            allowOutsideRadius: (bool) ($row['allow_outside_radius'] ?? false),
            locationLabel: isset($row['location_label']) ? (string) $row['location_label'] : null,
            mapsUrl: isset($row['maps_url']) ? (string) $row['maps_url'] : null,
            overwriteShift: (bool) ($row['overwrite_shift'] ?? false),
            shiftStartTime: self::normalizeShiftTime($row['shift_start_time'] ?? null),
            shiftEndTime: self::normalizeShiftTime($row['shift_end_time'] ?? null),
            shiftCrossesMidnight: (bool) ($row['shift_crosses_midnight'] ?? false),
        );
    }

    public function hasOverwriteShift(): bool
    {
        return $this->overwriteShift
            && $this->shiftStartTime !== null
            && $this->shiftEndTime !== null;
    }

    /**
     * Synthetic department-style shift used for late / window checks.
     *
     * @return array<string, mixed>|null
     */
    public function toSyntheticShift(): ?array
    {
        if (! $this->hasOverwriteShift()) {
            return null;
        }

        return [
            'id' => 'special-release-'.$this->id,
            'name' => sprintf('Special release (%s)', $this->typeLabel()),
            'days_of_week' => [1, 2, 3, 4, 5, 6, 7],
            'start_time' => $this->shiftStartTime,
            'end_time' => $this->shiftEndTime,
            'crosses_midnight' => $this->shiftCrossesMidnight,
            'special_release_id' => $this->id,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function toSummary(): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type,
            'date' => $this->date,
            'end_date' => $this->endDate,
            'center_latitude' => $this->centerLatitude,
            'center_longitude' => $this->centerLongitude,
            'radius_meters' => $this->radiusMeters,
            'allow_outside_radius' => $this->allowOutsideRadius,
            'location_label' => $this->locationLabel,
            'maps_url' => $this->mapsUrl,
            'overwrite_shift' => $this->overwriteShift,
            'shift_start_time' => $this->shiftStartTime,
            'shift_end_time' => $this->shiftEndTime,
            'shift_crosses_midnight' => $this->shiftCrossesMidnight,
        ];
    }

    public function typeLabel(): string
    {
        return match ($this->type) {
            'wfh' => 'WFH',
            'outstation' => 'Outstation',
            'training' => 'Training',
            'event' => 'Event',
            default => 'Other',
        };
    }

    public static function normalizeShiftTime(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $raw = trim((string) $value);
        if ($raw === '') {
            return null;
        }

        if (preg_match('/^(\d{1,2}):(\d{2})(?::\d{2})?$/', $raw, $matches) !== 1) {
            return null;
        }

        $hour = (int) $matches[1];
        $minute = (int) $matches[2];
        if ($hour < 0 || $hour > 23 || $minute < 0 || $minute > 59) {
            return null;
        }

        return sprintf('%02d:%02d', $hour, $minute);
    }
}
