<?php

namespace App\Services;

use App\Models\NetworkHealthAlert;
use App\Models\NetworkHealthLog;

class NetworkHealthAlertService
{
    public const LATENCY_THRESHOLD_MS = 300;

    public const DOWNLOAD_THRESHOLD_MBPS = 5;

    public const UPLOAD_THRESHOLD_MBPS = 1;

    /**
     * @return array<int, NetworkHealthAlert>
     */
    public function evaluateAndCreate(NetworkHealthLog $log): array
    {
        $alerts = [];

        if ($log->latency_ms !== null && $log->latency_ms > self::LATENCY_THRESHOLD_MS) {
            $alerts[] = $this->createAlert($log, 'latency', $log->latency_ms, self::LATENCY_THRESHOLD_MS);
        }

        if ($log->download_mbps !== null && (float) $log->download_mbps < self::DOWNLOAD_THRESHOLD_MBPS) {
            $alerts[] = $this->createAlert($log, 'download', $log->download_mbps, self::DOWNLOAD_THRESHOLD_MBPS);
        }

        if ($log->upload_mbps !== null && (float) $log->upload_mbps < self::UPLOAD_THRESHOLD_MBPS) {
            $alerts[] = $this->createAlert($log, 'upload', $log->upload_mbps, self::UPLOAD_THRESHOLD_MBPS);
        }

        return $alerts;
    }

    private function createAlert(
        NetworkHealthLog $log,
        string $alertType,
        float|int $metricValue,
        float|int $threshold
    ): NetworkHealthAlert {
        return NetworkHealthAlert::query()->create([
            'network_health_log_id' => $log->id,
            'user_id' => $log->user_id,
            'alert_type' => $alertType,
            'metric_value' => $metricValue,
            'threshold_value' => $threshold,
            'status' => 'active',
        ]);
    }
}
