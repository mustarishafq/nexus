<?php

namespace App\Support;

use RuntimeException;

class XlsxWorkbook
{
    /**
     * @var list<array{name: string, headers: list<string>, rows: list<list<int|string>>}>
     */
    private array $sheets = [];

    /**
     * @param  list<string>  $headers
     * @param  list<list<int|string>>  $rows
     */
    public function addSheet(string $name, array $headers, array $rows): void
    {
        $this->sheets[] = [
            'name' => $name,
            'headers' => $headers,
            'rows' => $rows,
        ];
    }

    public function save(string $path): void
    {
        $files = [
            '[Content_Types].xml' => $this->contentTypes(),
            '_rels/.rels' => $this->rootRels(),
            'xl/workbook.xml' => $this->workbook(),
            'xl/_rels/workbook.xml.rels' => $this->workbookRels(),
            'xl/styles.xml' => $this->styles(),
        ];

        foreach ($this->sheets as $index => $sheet) {
            $files['xl/worksheets/sheet'.($index + 1).'.xml'] = $this->worksheet($sheet);
        }

        $zip = $this->zip($files);
        if (file_put_contents($path, $zip) === false) {
            throw new RuntimeException('Unable to write the workbook.');
        }
    }

    /**
     * @param  array{name: string, headers: list<string>, rows: list<list<int|string>>}  $sheet
     */
    private function worksheet(array $sheet): string
    {
        $headers = $sheet['headers'];
        $columnCount = max(count($headers), 1);
        $lastColumn = $this->columnLetters($columnCount - 1);
        $lastRow = max(count($sheet['rows']) + 1, 1);
        $widths = '';

        foreach ($headers as $index => $header) {
            $column = $index + 1;
            $width = mb_strlen($header) + 3;
            $widths .= '<col min="'.$column.'" max="'.$column.'" width="'.$width.'" customWidth="true"/>';
        }

        $rows = $this->row(1, $headers, true);
        foreach ($sheet['rows'] as $offset => $row) {
            $rows .= $this->row($offset + 2, $row, false);
        }

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            .'<sheetPr filterMode="false"><pageSetUpPr fitToPage="false"/></sheetPr>'
            .'<dimension ref="A1:'.$lastColumn.$lastRow.'"/>'
            .'<cols>'.$widths.'</cols>'
            .'<sheetData>'.$rows.'</sheetData>'
            .'<autoFilter ref="A1:'.$lastColumn.$lastRow.'"/>'
            .'</worksheet>';
    }

    /**
     * @param  list<int|string>  $values
     */
    private function row(int $number, array $values, bool $header): string
    {
        $cells = '';
        foreach ($values as $index => $value) {
            $text = $this->xml((string) $value);
            if ($text === '') {
                continue;
            }

            $ref = $this->columnLetters($index).$number;
            $style = $header ? ' s="1"' : '';
            $cells .= '<c r="'.$ref.'"'.$style.' t="inlineStr"><is><t>'.$text.'</t></is></c>';
        }

        return '<row r="'.$number.'">'.$cells.'</row>';
    }

    private function contentTypes(): string
    {
        $overrides = '<Override ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml" PartName="/xl/workbook.xml"/>'
            .'<Override ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml" PartName="/xl/styles.xml"/>';

        foreach ($this->sheets as $index => $sheet) {
            $overrides .= '<Override ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml" PartName="/xl/worksheets/sheet'.($index + 1).'.xml"/>';
        }

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            .'<Default ContentType="application/xml" Extension="xml"/>'
            .'<Default ContentType="application/vnd.openxmlformats-package.relationships+xml" Extension="rels"/>'
            .$overrides
            .'</Types>';
    }

    private function rootRels(): string
    {
        return '<?xml version="1.0" encoding="UTF-8"?>'
            .'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            .'<Relationship Id="rIdWorkbook" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            .'</Relationships>';
    }

    private function workbook(): string
    {
        $sheets = '';
        foreach ($this->sheets as $index => $sheet) {
            $id = $index + 1;
            $sheets .= '<sheet name="'.$this->xml($sheet['name']).'" sheetId="'.$id.'" r:id="rIdSheet'.$id.'"/>';
        }

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            .'<sheets>'.$sheets.'</sheets>'
            .'</workbook>';
    }

    private function workbookRels(): string
    {
        $rels = '<Relationship Id="rIdStyles" Target="styles.xml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"/>';
        foreach ($this->sheets as $index => $sheet) {
            $id = $index + 1;
            $rels .= '<Relationship Id="rIdSheet'.$id.'" Target="worksheets/sheet'.$id.'.xml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"/>';
        }

        return '<?xml version="1.0" encoding="UTF-8"?>'
            .'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            .$rels
            .'</Relationships>';
    }

    private function styles(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            .'<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
            .'<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
            .'<borders count="1"><border><left/><right/><top/><bottom/></border></borders>'
            .'<cellStyleXfs count="1"><xf borderId="0" fillId="0" fontId="0" numFmtId="0"/></cellStyleXfs>'
            .'<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>'
            .'</styleSheet>';
    }

    private function columnLetters(int $index): string
    {
        $letters = '';
        $index++;

        while ($index > 0) {
            $index--;
            $letters = chr(65 + ($index % 26)).$letters;
            $index = intdiv($index, 26);
        }

        return $letters;
    }

    private function xml(string $value): string
    {
        $value = mb_scrub($value, 'UTF-8');
        $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $value) ?? $value;

        return htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    }

    /**
     * @param  array<string, string>  $files
     */
    private function zip(array $files): string
    {
        $local = '';
        $central = '';
        $offset = 0;

        foreach ($files as $name => $contents) {
            $crc = crc32($contents);
            $compressed = gzdeflate($contents);
            $method = 8;
            if ($compressed === false || strlen($compressed) >= strlen($contents)) {
                $compressed = $contents;
                $method = 0;
            }

            $nameLength = strlen($name);
            $header = pack(
                'VvvvvvVVVvv',
                0x04034B50,
                20,
                0,
                $method,
                0,
                0,
                $crc,
                strlen($compressed),
                strlen($contents),
                $nameLength,
                0,
            );
            $local .= $header.$name.$compressed;
            $central .= pack(
                'VvvvvvvVVVvvvvvVV',
                0x02014B50,
                0x0314,
                20,
                0,
                $method,
                0,
                0,
                $crc,
                strlen($compressed),
                strlen($contents),
                $nameLength,
                0,
                0,
                0,
                0,
                0,
                $offset,
            ).$name;
            $offset += strlen($header) + $nameLength + strlen($compressed);
        }

        $eocd = pack(
            'VvvvvVVv',
            0x06054B50,
            0,
            0,
            count($files),
            count($files),
            strlen($central),
            $offset,
            0,
        );

        return $local.$central.$eocd;
    }
}
