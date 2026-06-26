<?php

namespace App\Services\Mcp;

use App\Models\User;

interface McpTool
{
    public function name(): string;

    public function description(): string;

    /**
     * JSON Schema for the tool's input, per the MCP spec.
     *
     * @return array<string, mixed>
     */
    public function inputSchema(): array;

    /**
     * @param  array<string, mixed>  $arguments
     * @return array<string, mixed>
     */
    public function call(User $user, array $arguments): array;
}
