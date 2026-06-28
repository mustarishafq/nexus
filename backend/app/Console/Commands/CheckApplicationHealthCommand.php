<?php

namespace App\Console\Commands;

use App\Models\Application;
use App\Services\ApplicationHealthCheckerService;
use Illuminate\Console\Command;

class CheckApplicationHealthCommand extends Command
{
    protected $signature = 'applications:check-health {--slug= : Check a single application by slug} {--dry-run : Probe without updating status or recording events}';

    protected $description = 'Probe connected applications and update status from their health endpoints';

    public function handle(ApplicationHealthCheckerService $service): int
    {
        $slug = $this->option('slug');
        $persist = ! $this->option('dry-run');

        if ($slug) {
            $application = Application::query()->where('slug', $slug)->first();

            if (! $application) {
                $this->error("No application found with slug \"{$slug}\".");

                return self::FAILURE;
            }

            $result = $service->check($application, $persist);
            $this->renderResult($result);

            return $result['skipped'] || $result['ok'] ? self::SUCCESS : self::FAILURE;
        }

        $summary = $service->checkAll($persist);

        foreach ($summary['results'] as $result) {
            $this->renderResult($result);
        }

        $this->newLine();
        $this->info("Checked: {$summary['checked']}, healthy: {$summary['healthy']}, unhealthy: {$summary['unhealthy']}, skipped: {$summary['skipped']}");

        return $summary['unhealthy'] === 0 ? self::SUCCESS : self::FAILURE;
    }

    /**
     * @param  array<string, mixed>  $result
     */
    private function renderResult(array $result): void
    {
        $label = "{$result['name']} ({$result['slug']})";

        if ($result['skipped']) {
            $this->line("<comment>SKIP</comment> {$label}: {$result['message']}");

            return;
        }

        if ($result['ok']) {
            $latency = $result['response_time_ms'] !== null ? " ({$result['response_time_ms']}ms)" : '';
            $this->line("<info>OK</info> {$label}{$latency}");

            return;
        }

        $this->line("<error>FAIL</error> {$label}: {$result['message']}");
    }
}
