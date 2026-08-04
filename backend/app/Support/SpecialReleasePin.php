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
        );
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
        ];
    }

    public function typeLabel(): string
    {
        return match ($this->type) {
            'wfh' => 'WFH',
            'outstation' => 'Outstation',
            default => 'Other',
        };
    }
}
