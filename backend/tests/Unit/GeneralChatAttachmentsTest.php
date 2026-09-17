<?php

namespace Tests\Unit;

use App\Support\GeneralChatAttachments;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;
use ZipArchive;

class GeneralChatAttachmentsTest extends TestCase
{
    public function test_extracts_xlsx_cell_text_for_the_model(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('general-chat/data.xlsx', $this->miniXlsx('Sitegiant problem'));

        $content = GeneralChatAttachments::toLlmContent('did u able to read it ?', [[
            'url' => '/storage/general-chat/data.xlsx',
            'name' => 'Sitegiant problem.xlsx',
            'mime' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]]);

        $blob = is_string($content) ? $content : json_encode($content);
        $this->assertStringContainsString('Sitegiant problem', $blob);
        $this->assertStringNotContainsString('no readable text could be extracted', $blob);
    }

    public function test_extracts_pdf_text_for_the_model(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('general-chat/receipt.pdf', $this->miniPdf('OpenRouter receipt 1270'));

        $content = GeneralChatAttachments::toLlmContent('u can read this ?', [[
            'url' => '/storage/general-chat/receipt.pdf',
            'name' => 'receipt.pdf',
            'mime' => 'application/pdf',
        ]]);

        $blob = is_string($content) ? $content : json_encode($content);
        $this->assertStringContainsString('OpenRouter receipt 1270', $blob);
    }

    private function miniXlsx(string $cell): string
    {
        $tmp = tempnam(sys_get_temp_dir(), 'xlsx');
        $this->assertNotFalse($tmp);

        $zip = new ZipArchive;
        $this->assertTrue($zip->open($tmp, ZipArchive::OVERWRITE | ZipArchive::CREATE));
        $zip->addFromString(
            'xl/sharedStrings.xml',
            '<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="1" uniqueCount="1"><si><t>'.htmlspecialchars($cell, ENT_XML1).'</t></si></sst>',
        );
        $zip->addFromString(
            'xl/worksheets/sheet1.xml',
            '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row></sheetData></worksheet>',
        );
        $zip->close();

        $bytes = file_get_contents($tmp);
        @unlink($tmp);
        $this->assertNotFalse($bytes);

        return $bytes;
    }

    private function miniPdf(string $text): string
    {
        $safe = str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $text);
        $stream = "BT /F1 12 Tf 72 720 Td ({$safe}) Tj ET";
        $objects = [
            '1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj',
            '2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj',
            '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj',
            '4 0 obj<< /Length '.strlen($stream)." >>stream\n{$stream}\nendstream\nendobj",
            '5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj',
        ];

        $header = "%PDF-1.4\n";
        $body = '';
        $offsets = [0];
        foreach ($objects as $object) {
            $offsets[] = strlen($header) + strlen($body);
            $body .= $object."\n";
        }

        $xref = 'xref
0 6
0000000000 65535 f 
';
        for ($i = 1; $i <= 5; $i++) {
            $xref .= sprintf("%010d 00000 n \n", $offsets[$i]);
        }

        $startxref = strlen($header) + strlen($body);
        $trailer = "trailer<< /Size 6 /Root 1 0 R >>\nstartxref\n{$startxref}\n%%EOF\n";

        return $header.$body.$xref.$trailer;
    }
}
