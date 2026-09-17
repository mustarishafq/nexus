<?php

namespace Tests\Unit;

use App\Services\SatelliteAi\AttachmentNormalizer;
use App\Services\SatelliteAi\SatelliteAiException;
use PHPUnit\Framework\TestCase;

class SatelliteAiAttachmentNormalizerTest extends TestCase
{
    public function test_inlines_markdown_into_user_message(): void
    {
        $normalizer = new AttachmentNormalizer();
        $merged = $normalizer->merge(
            [['role' => 'user', 'content' => 'Draft a course']],
            [[
                'filename' => 'syllabus.md',
                'media_type' => 'text/markdown',
                'data' => base64_encode('# Intro'),
            ]],
        );

        $this->assertSame('user', $merged[0]['role']);
        $this->assertIsArray($merged[0]['content']);
        $this->assertSame('Draft a course', $merged[0]['content'][0]['text']);
        $this->assertStringContainsString('# Intro', $merged[0]['content'][1]['text']);
    }

    public function test_images_become_data_urls(): void
    {
        $normalizer = new AttachmentNormalizer();
        $png = base64_encode('fake-png');
        $merged = $normalizer->merge(
            [['role' => 'user', 'content' => 'See scan']],
            [[
                'filename' => 'scan.png',
                'media_type' => 'image/png',
                'data' => $png,
            ]],
        );

        $this->assertSame('image_url', $merged[0]['content'][1]['type']);
        $this->assertSame('data:image/png;base64,'.$png, $merged[0]['content'][1]['image_url']['url']);
    }

    public function test_pdfs_become_file_parts(): void
    {
        $normalizer = new AttachmentNormalizer();
        $pdf = base64_encode('%PDF-1.4');
        $merged = $normalizer->merge(
            [['role' => 'system', 'content' => 'You are a tutor.']],
            [[
                'filename' => 'outline.pdf',
                'media_type' => 'application/pdf',
                'data' => $pdf,
            ]],
        );

        $this->assertSame('user', $merged[1]['role']);
        $this->assertSame('file', $merged[1]['content'][0]['type']);
        $this->assertSame('outline.pdf', $merged[1]['content'][0]['file']['filename']);
    }

    public function test_rejects_too_many_files(): void
    {
        $this->expectException(SatelliteAiException::class);
        $normalizer = new AttachmentNormalizer();
        $files = [];
        for ($i = 0; $i < 11; $i++) {
            $files[] = [
                'filename' => "n{$i}.txt",
                'media_type' => 'text/plain',
                'data' => base64_encode('x'),
            ];
        }
        $normalizer->merge([['role' => 'user', 'content' => 'hi']], $files);
    }

    public function test_rejects_unknown_types(): void
    {
        $this->expectException(SatelliteAiException::class);
        $normalizer = new AttachmentNormalizer();
        $normalizer->merge(
            [['role' => 'user', 'content' => 'hi']],
            [[
                'filename' => 'payload.exe',
                'media_type' => 'application/octet-stream',
                'data' => base64_encode('MZ'),
            ]],
        );
    }
}
