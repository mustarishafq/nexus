<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\Storage;
use InvalidArgumentException;
use Throwable;
use ZipArchive;

class ChatResponseArtifacts
{
    public const MAX_CHARTS = 1;

    public const MAX_FILES = 1;

    public const MAX_POINTS = 24;

    public const MAX_SERIES = 4;

    public const MAX_ROWS = 200;

    public const MAX_COLUMNS = 12;

    /**
     * @return list<array<string, mixed>>
     */
    public static function toolDefinitions(): array
    {
        return [
            [
                'type' => 'function',
                'function' => [
                    'name' => 'present_chart',
                    'description' => 'Show one bar, line, or pie chart in the chat. Required when the user asks to see, compare, plot, or visualize numbers. Example: {"type":"bar","title":"Scores","points":[{"label":"Ali","value":4},{"label":"Siti","value":7}]}. Call it once, then write a short caption. A text table is not a substitute.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'type' => [
                                'type' => 'string',
                                'enum' => ['bar', 'line', 'pie'],
                                'description' => 'Chart type.',
                            ],
                            'title' => [
                                'type' => 'string',
                                'description' => 'Short chart title.',
                            ],
                            'series' => [
                                'type' => 'array',
                                'items' => ['type' => 'string'],
                                'description' => 'Series names when each point includes a values array. Omit for a single series that uses value.',
                            ],
                            'points' => [
                                'type' => 'array',
                                'description' => 'One object per category. Single series: {label, value}. Several series: {label, values:[...]} aligned with series.',
                                'items' => [
                                    'type' => 'object',
                                    'properties' => [
                                        'label' => ['type' => 'string'],
                                        'value' => ['type' => 'number'],
                                        'values' => [
                                            'type' => 'array',
                                            'items' => ['type' => 'number'],
                                        ],
                                    ],
                                    'required' => ['label'],
                                ],
                            ],
                        ],
                        'required' => ['type', 'title', 'points'],
                    ],
                ],
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'create_spreadsheet',
                    'description' => 'Attach a CSV or Excel file the user can download. Use when they ask for a file, export, spreadsheet, CSV, or Excel. Call at most once per reply.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'filename' => [
                                'type' => 'string',
                                'description' => 'File name without a path. The extension is added from format.',
                            ],
                            'format' => [
                                'type' => 'string',
                                'enum' => ['csv', 'xlsx'],
                                'description' => 'csv or xlsx.',
                            ],
                            'columns' => [
                                'type' => 'array',
                                'items' => ['type' => 'string'],
                                'description' => 'Column headings.',
                            ],
                            'rows' => [
                                'type' => 'array',
                                'description' => 'Each row is an array of cells in column order, or an object keyed by column name.',
                                'items' => [
                                    'type' => 'array',
                                ],
                            ],
                        ],
                        'required' => ['filename', 'format', 'columns', 'rows'],
                    ],
                ],
            ],
        ];
    }

    public static function instruction(): string
    {
        return <<<'TEXT'
- When the user asks to see, compare, plot, chart, or visualize numbers, call present_chart before the final answer. A sentence or table does not count as a chart.
- When the user asks for a file, export, download, spreadsheet, CSV, or Excel, call create_spreadsheet, then say the file is attached.
- If they ask for both a chart and a file, call present_chart and create_spreadsheet before the final answer.
- For any other question, answer in Markdown and do not call present_chart or create_spreadsheet.
- Use only numbers from the user or from tool results in this conversation. Do not invent figures.
- At most one chart and one spreadsheet per reply.
- present_chart arguments look like {"type":"bar","title":"Scores","points":[{"label":"Ali","value":4}]}.
TEXT;
    }

    /**
     * @param  array<string, mixed>  $arguments
     * @return array{ok: bool, summary: string, output: array<string, mixed>, visual: ?array<string, mixed>, attachment: ?array<string, mixed>}
     */
    public static function execute(User $user, string $name, array $arguments, int $chartCount, int $fileCount): array
    {
        try {
            if ($name === 'present_chart') {
                return self::presentChart($arguments, $chartCount);
            }

            if ($name === 'create_spreadsheet') {
                return self::createSpreadsheet($user, $arguments, $fileCount);
            }
        } catch (InvalidArgumentException $e) {
            return self::failure($e->getMessage());
        } catch (Throwable $e) {
            return self::failure('Could not prepare that response.');
        }

        return self::failure("Unknown tool: {$name}");
    }

    /**
     * @param  list<array<string, mixed>>  $visuals
     * @param  list<array<string, mixed>>  $attachments
     */
    public static function historySuffix(array $visuals, array $attachments): string
    {
        $lines = [];

        foreach ($visuals as $chart) {
            if (! is_array($chart)) {
                continue;
            }

            $encoded = json_encode([
                'type' => $chart['type'] ?? null,
                'title' => $chart['title'] ?? null,
                'series' => array_map(
                    fn ($series) => is_array($series) ? ($series['label'] ?? null) : null,
                    is_array($chart['series'] ?? null) ? $chart['series'] : [],
                ),
                'points' => $chart['points'] ?? [],
            ], JSON_UNESCAPED_UNICODE);

            if (is_string($encoded)) {
                $lines[] = 'Chart already shown to the user: '.$encoded;
            }
        }

        foreach ($attachments as $file) {
            if (! is_array($file)) {
                continue;
            }

            $name = trim((string) ($file['name'] ?? ''));
            if ($name !== '') {
                $lines[] = 'File already attached for the user: '.$name;
            }
        }

        if ($lines === []) {
            return '';
        }

        return "\n\n".implode("\n", $lines);
    }

    /**
     * @param  list<array<string, mixed>>  $visuals
     * @param  list<array<string, mixed>>  $attachments
     */
    public static function fallbackCaption(array $visuals, array $attachments): string
    {
        if ($visuals !== [] && $attachments !== []) {
            return 'Here is the chart, and the file is attached.';
        }

        if ($visuals !== []) {
            return 'Here is the chart.';
        }

        if ($attachments !== []) {
            return 'The file is attached.';
        }

        return '';
    }

    /**
     * @param  array<string, mixed>  $arguments
     * @return array{ok: bool, summary: string, output: array<string, mixed>, visual: ?array<string, mixed>, attachment: ?array<string, mixed>}
     */
    public static function presentChart(array $arguments, int $chartCount): array
    {
        if ($chartCount >= self::MAX_CHARTS) {
            return self::failure('Only one chart can be shown per reply.');
        }

        $visual = self::normalizeChart($arguments);

        return [
            'ok' => true,
            'summary' => 'Prepared a '.$visual['type'].' chart: '.$visual['title'],
            'output' => [
                'ok' => true,
                'shown' => true,
                'title' => $visual['title'],
            ],
            'visual' => $visual,
            'attachment' => null,
        ];
    }

    /**
     * @param  array<string, mixed>  $arguments
     * @return array{ok: bool, summary: string, output: array<string, mixed>, visual: ?array<string, mixed>, attachment: ?array<string, mixed>}
     */
    public static function createSpreadsheet(User $user, array $arguments, int $fileCount): array
    {
        if ($fileCount >= self::MAX_FILES) {
            return self::failure('Only one spreadsheet can be attached per reply.');
        }

        $format = strtolower(trim((string) ($arguments['format'] ?? 'csv')));
        if (! in_array($format, ['csv', 'xlsx'], true)) {
            throw new InvalidArgumentException('Spreadsheet format must be csv or xlsx.');
        }

        $columns = self::columns($arguments['columns'] ?? null);
        $rows = self::rows($arguments['rows'] ?? null, $columns);
        $downloadName = self::downloadName((string) ($arguments['filename'] ?? 'export'), $format);
        $bytes = $format === 'xlsx'
            ? self::xlsxBytes($columns, $rows)
            : self::csvBytes($columns, $rows);

        $relative = 'chat-artifacts/'.max(0, (int) $user->id).'/'.now()->format('Ymd').'/'.bin2hex(random_bytes(4)).'-'.$downloadName;
        Storage::disk('public')->put($relative, $bytes);

        $url = PublicStorageUrl::canonicalize(Storage::disk('public')->url($relative)) ?? ('/storage/'.$relative);
        $attachment = [
            'url' => $url,
            'name' => $downloadName,
            'mime' => $format === 'xlsx'
                ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                : 'text/csv',
            'size' => strlen($bytes),
            'kind' => 'file',
        ];

        return [
            'ok' => true,
            'summary' => 'Created '.$downloadName,
            'output' => [
                'ok' => true,
                'attached' => true,
                'filename' => $downloadName,
            ],
            'visual' => null,
            'attachment' => $attachment,
        ];
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array{type: string, title: string, series: list<array{key: string, label: string}>, points: list<array<string, mixed>>}
     */
    public static function normalizeChart(array $input): array
    {
        $type = strtolower(trim((string) ($input['type'] ?? '')));
        if (! in_array($type, ['bar', 'line', 'pie'], true)) {
            throw new InvalidArgumentException('Chart type must be bar, line, or pie.');
        }

        $title = self::clipLabel((string) ($input['title'] ?? ''), 80);
        if ($title === '') {
            throw new InvalidArgumentException('Chart title is required.');
        }

        $rawPoints = $input['points'] ?? $input['data'] ?? null;
        if (! is_array($rawPoints) || $rawPoints === []) {
            throw new InvalidArgumentException('Chart needs at least one point.');
        }

        $rawPoints = array_slice(array_values($rawPoints), 0, self::MAX_POINTS);
        $explicitSeries = [];
        if (isset($input['series']) && is_array($input['series'])) {
            foreach ($input['series'] as $name) {
                $label = self::clipLabel((string) $name, 40);
                if ($label !== '') {
                    $explicitSeries[] = $label;
                }
            }
            $explicitSeries = array_slice($explicitSeries, 0, self::MAX_SERIES);
        }

        $seriesLabels = $explicitSeries;
        $normalized = [];

        foreach ($rawPoints as $index => $point) {
            if (! is_array($point)) {
                continue;
            }

            $label = self::clipLabel((string) ($point['label'] ?? $point['name'] ?? ''), 48);
            if ($label === '') {
                $label = 'Item '.($index + 1);
            }

            $numbers = self::pointNumbers($point, $seriesLabels);
            if ($numbers === []) {
                continue;
            }

            if ($seriesLabels === []) {
                $seriesLabels = array_keys($numbers);
            }

            $row = ['label' => $label];
            foreach ($seriesLabels as $position => $seriesLabel) {
                $row['s'.$position] = $numbers[$seriesLabel] ?? 0.0;
            }
            $normalized[] = $row;
        }

        if ($normalized === []) {
            throw new InvalidArgumentException('Chart points need numeric values.');
        }

        if ($type === 'pie') {
            $seriesLabels = [array_values($seriesLabels)[0] ?? 'Value'];
            foreach ($normalized as &$row) {
                $normalizedRow = ['label' => $row['label'], 's0' => (float) ($row['s0'] ?? 0)];
                $row = $normalizedRow;
            }
            unset($row);
        }

        $seriesLabels = array_slice(array_values($seriesLabels), 0, self::MAX_SERIES);
        $series = [];
        foreach ($seriesLabels as $position => $seriesLabel) {
            $series[] = [
                'key' => 's'.$position,
                'label' => $seriesLabel,
            ];
        }

        return [
            'type' => $type,
            'title' => $title,
            'series' => $series,
            'points' => $normalized,
        ];
    }

    /**
     * @param  array<string, mixed>  $point
     * @param  list<string>  $seriesLabels
     * @return array<string, float>
     */
    private static function pointNumbers(array $point, array $seriesLabels): array
    {
        if (isset($point['values']) && is_array($point['values'])) {
            $labels = $seriesLabels !== [] ? $seriesLabels : [];
            $numbers = [];
            foreach (array_values($point['values']) as $position => $value) {
                if ($position >= self::MAX_SERIES || ! is_numeric($value) || ! is_finite((float) $value)) {
                    continue;
                }
                $name = $labels[$position] ?? ('Series '.($position + 1));
                $numbers[$name] = (float) $value;
            }

            return $numbers;
        }

        if (isset($point['value']) && is_numeric($point['value']) && is_finite((float) $point['value'])) {
            $name = $seriesLabels[0] ?? self::clipLabel((string) ($point['series'] ?? 'Value'), 40);

            return [$name !== '' ? $name : 'Value' => (float) $point['value']];
        }

        $numbers = [];
        foreach ($point as $key => $value) {
            if (in_array((string) $key, ['label', 'name', 'series'], true)) {
                continue;
            }
            if (! is_numeric($value) || ! is_finite((float) $value)) {
                continue;
            }
            $name = self::clipLabel((string) $key, 40);
            if ($name === '') {
                continue;
            }
            $numbers[$name] = (float) $value;
            if (count($numbers) >= self::MAX_SERIES) {
                break;
            }
        }

        return $numbers;
    }

    /**
     * @return list<string>
     */
    private static function columns(mixed $columns): array
    {
        if (! is_array($columns) || $columns === []) {
            throw new InvalidArgumentException('Spreadsheet needs at least one column.');
        }

        $names = [];
        foreach (array_slice(array_values($columns), 0, self::MAX_COLUMNS) as $column) {
            $name = self::clipLabel((string) $column, 80);
            $names[] = $name !== '' ? $name : 'Column '.(count($names) + 1);
        }

        return $names;
    }

    /**
     * @param  list<string>  $columns
     * @return list<list<mixed>>
     */
    private static function rows(mixed $rows, array $columns): array
    {
        if (! is_array($rows)) {
            throw new InvalidArgumentException('Spreadsheet rows must be a list.');
        }

        $normalized = [];
        $width = count($columns);

        foreach (array_slice(array_values($rows), 0, self::MAX_ROWS) as $row) {
            if (! is_array($row)) {
                continue;
            }

            if (! array_is_list($row)) {
                $ordered = [];
                foreach ($columns as $column) {
                    $ordered[] = $row[$column] ?? '';
                }
                $row = $ordered;
            }

            $cells = [];
            for ($index = 0; $index < $width; $index++) {
                $cells[] = self::cellValue($row[$index] ?? '');
            }
            $normalized[] = $cells;
        }

        if ($normalized === []) {
            throw new InvalidArgumentException('Spreadsheet needs at least one row.');
        }

        return $normalized;
    }

    private static function cellValue(mixed $value): string|int|float
    {
        if (is_int($value)) {
            return $value;
        }

        if (is_float($value)) {
            return is_finite($value) ? $value : '';
        }

        if (is_bool($value)) {
            return $value ? 'Yes' : 'No';
        }

        $text = trim((string) preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', (string) $value));
        if ($text !== '' && preg_match('/^[=+\-@]/', $text) === 1) {
            $text = "'".$text;
        }

        return mb_substr($text, 0, 500);
    }

    /**
     * @param  list<string>  $columns
     * @param  list<list<mixed>>  $rows
     */
    private static function csvBytes(array $columns, array $rows): string
    {
        $handle = fopen('php://temp', 'r+');
        if ($handle === false) {
            throw new InvalidArgumentException('Could not build the CSV file.');
        }

        fputcsv($handle, $columns);
        foreach ($rows as $row) {
            fputcsv($handle, $row);
        }
        rewind($handle);
        $bytes = stream_get_contents($handle);
        fclose($handle);

        if (! is_string($bytes) || $bytes === '') {
            throw new InvalidArgumentException('Could not build the CSV file.');
        }

        return $bytes;
    }

    /**
     * @param  list<string>  $columns
     * @param  list<list<mixed>>  $rows
     */
    private static function xlsxBytes(array $columns, array $rows): string
    {
        if (! class_exists(ZipArchive::class)) {
            throw new InvalidArgumentException('Excel export is unavailable on this server.');
        }

        $shared = [];
        $sharedIndex = [];
        $sheetRows = [];
        $allRows = array_merge([$columns], $rows);

        foreach ($allRows as $rowIndex => $row) {
            $cells = [];
            foreach ($row as $columnIndex => $value) {
                $ref = self::columnLetter($columnIndex).($rowIndex + 1);
                if (is_int($value) || is_float($value)) {
                    $cells[] = '<c r="'.$ref.'"><v>'.$value.'</v></c>';
                    continue;
                }

                $text = (string) $value;
                if (! array_key_exists($text, $sharedIndex)) {
                    $sharedIndex[$text] = count($shared);
                    $shared[] = $text;
                }
                $cells[] = '<c r="'.$ref.'" t="s"><v>'.$sharedIndex[$text].'</v></c>';
            }
            $sheetRows[] = '<row r="'.($rowIndex + 1).'">'.implode('', $cells).'</row>';
        }

        $sharedItems = '';
        foreach ($shared as $text) {
            $sharedItems .= '<si><t>'.self::xml($text).'</t></si>';
        }

        $sharedCount = count($shared);
        $sheetXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
            .implode('', $sheetRows)
            .'</sheetData></worksheet>';
        $sharedXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="'.$sharedCount.'" uniqueCount="'.$sharedCount.'">'
            .$sharedItems
            .'</sst>';

        $tmp = tempnam(sys_get_temp_dir(), 'chatxlsx');
        if ($tmp === false) {
            throw new InvalidArgumentException('Could not build the Excel file.');
        }

        $zip = new ZipArchive;
        $opened = $zip->open($tmp, ZipArchive::OVERWRITE | ZipArchive::CREATE);
        if ($opened !== true) {
            @unlink($tmp);
            throw new InvalidArgumentException('Could not build the Excel file.');
        }

        $zip->addFromString('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            .'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            .'<Default Extension="xml" ContentType="application/xml"/>'
            .'<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            .'<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            .'<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>'
            .'</Types>');
        $zip->addFromString('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            .'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            .'</Relationships>');
        $zip->addFromString('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            .'<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>');
        $zip->addFromString('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            .'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            .'<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>'
            .'</Relationships>');
        $zip->addFromString('xl/worksheets/sheet1.xml', $sheetXml);
        $zip->addFromString('xl/sharedStrings.xml', $sharedXml);
        $zip->close();

        $bytes = file_get_contents($tmp);
        @unlink($tmp);

        if (! is_string($bytes) || $bytes === '') {
            throw new InvalidArgumentException('Could not build the Excel file.');
        }

        return $bytes;
    }

    private static function columnLetter(int $index): string
    {
        $letter = '';
        $n = $index + 1;
        while ($n > 0) {
            $n--;
            $letter = chr(65 + ($n % 26)).$letter;
            $n = intdiv($n, 26);
        }

        return $letter;
    }

    private static function downloadName(string $raw, string $extension): string
    {
        $base = pathinfo($raw, PATHINFO_FILENAME);
        $base = strtolower((string) preg_replace('/[^a-z0-9]+/i', '-', (string) $base));
        $base = trim($base, '-');
        if ($base === '') {
            $base = 'export';
        }

        return substr($base, 0, 48).'.'.$extension;
    }

    private static function clipLabel(string $value, int $max): string
    {
        $value = trim((string) preg_replace('/[\x00-\x1F]+/u', ' ', $value));
        $value = preg_replace('/\s+/u', ' ', $value) ?? $value;

        return mb_substr(trim($value), 0, $max);
    }

    private static function xml(string $value): string
    {
        return htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    }

    /**
     * @return array{ok: bool, summary: string, output: array<string, mixed>, visual: null, attachment: null}
     */
    private static function failure(string $message): array
    {
        return [
            'ok' => false,
            'summary' => $message,
            'output' => ['error' => $message],
            'visual' => null,
            'attachment' => null,
        ];
    }
}
