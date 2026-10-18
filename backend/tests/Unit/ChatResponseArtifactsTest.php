<?php

namespace Tests\Unit;

use App\Models\User;
use App\Support\ChatResponseArtifacts;
use App\Support\GeneralChatAttachments;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ChatResponseArtifactsTest extends TestCase
{
    public function test_normalizes_a_single_series_bar_chart(): void
    {
        $chart = ChatResponseArtifacts::normalizeChart([
            'type' => 'bar',
            'title' => 'Scores',
            'points' => [
                ['label' => 'A', 'value' => 2],
                ['label' => 'B', 'value' => 5],
            ],
        ]);

        $this->assertSame('bar', $chart['type']);
        $this->assertSame('Scores', $chart['title']);
        $this->assertSame('Value', $chart['series'][0]['label']);
        $this->assertSame(5.0, $chart['points'][1]['s0']);
    }

    public function test_normalizes_named_series(): void
    {
        $chart = ChatResponseArtifacts::normalizeChart([
            'type' => 'line',
            'title' => 'Tasks',
            'series' => ['Open', 'Done'],
            'points' => [
                ['label' => 'Week 1', 'values' => [4, 2]],
            ],
        ]);

        $this->assertSame(['Open', 'Done'], array_column($chart['series'], 'label'));
        $this->assertSame(4.0, $chart['points'][0]['s0']);
        $this->assertSame(2.0, $chart['points'][0]['s1']);
    }

    public function test_rejects_a_chart_without_numbers(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        ChatResponseArtifacts::normalizeChart([
            'type' => 'pie',
            'title' => 'Empty',
            'points' => [['label' => 'A']],
        ]);
    }

    public function test_writes_a_csv_and_neutralizes_formulas(): void
    {
        Storage::fake('public');
        $user = new User;
        $user->id = 7;

        $result = ChatResponseArtifacts::createSpreadsheet($user, [
            'filename' => 'Scores export',
            'format' => 'csv',
            'columns' => ['Name', 'Score'],
            'rows' => [
                ['A', 2],
                ['B', '=1+1'],
            ],
        ], 0);

        $this->assertTrue($result['ok']);
        $this->assertSame('scores-export.csv', $result['attachment']['name']);
        $relative = ltrim(substr($result['attachment']['url'], strlen('/storage/')), '/');
        $csv = Storage::disk('public')->get($relative);
        $this->assertStringContainsString('Name,Score', $csv);
        $this->assertStringContainsString("'=1+1", $csv);
    }

    public function test_writes_an_xlsx_the_chat_reader_can_open(): void
    {
        Storage::fake('public');
        $user = new User;
        $user->id = 7;

        $result = ChatResponseArtifacts::createSpreadsheet($user, [
            'filename' => 'tasks',
            'format' => 'xlsx',
            'columns' => ['Task'],
            'rows' => [['Sitegiant problem']],
        ], 0);

        $this->assertTrue($result['ok']);
        $content = GeneralChatAttachments::toLlmContent('read this', [$result['attachment']]);
        $blob = is_string($content) ? $content : json_encode($content);
        $this->assertStringContainsString('Sitegiant problem', $blob);
    }

    public function test_second_chart_in_one_reply_is_rejected(): void
    {
        $result = ChatResponseArtifacts::presentChart([
            'type' => 'bar',
            'title' => 'Again',
            'points' => [['label' => 'A', 'value' => 1]],
        ], 1);

        $this->assertFalse($result['ok']);
        $this->assertNull($result['visual']);
    }
}
