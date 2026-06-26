<?php

namespace App\Services\Mcp;

use App\Services\Mcp\Tools\CallApplicationApiTool;
use App\Services\Mcp\Tools\DescribeApplicationApiTool;
use App\Services\Mcp\Tools\ListApplicationsTool;
use Illuminate\Container\Container;

class ToolRegistry
{
    /** @var array<int, class-string<McpTool>> */
    private array $toolClasses = [
        ListApplicationsTool::class,
        DescribeApplicationApiTool::class,
        CallApplicationApiTool::class,
    ];

    /** @var array<string, McpTool>|null */
    private ?array $tools = null;

    public function __construct(private Container $container) {}

    /**
     * @return array<string, McpTool>
     */
    public function all(): array
    {
        if ($this->tools === null) {
            $this->tools = [];
            foreach ($this->toolClasses as $class) {
                $tool = $this->container->make($class);
                $this->tools[$tool->name()] = $tool;
            }
        }

        return $this->tools;
    }

    public function find(string $name): ?McpTool
    {
        return $this->all()[$name] ?? null;
    }
}
