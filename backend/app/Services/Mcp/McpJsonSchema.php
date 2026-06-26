<?php

namespace App\Services\Mcp;

class McpJsonSchema
{
    /**
     * @param  array<string, mixed>  $properties
     * @param  array<int, string>  $required
     * @return array<string, mixed>
     */
    public static function object(array $properties = [], array $required = []): array
    {
        $schema = [
            'type' => 'object',
            'properties' => $properties === [] ? (object) [] : $properties,
        ];

        if ($required !== []) {
            $schema['required'] = $required;
        }

        return $schema;
    }

    /**
     * @return array<string, mixed>
     */
    public static function openObject(string $description): array
    {
        return [
            'type' => 'object',
            'description' => $description,
            'properties' => (object) [],
            'additionalProperties' => true,
        ];
    }

    /**
     * JSON Schema "properties" must encode as {} not [] for strict MCP clients.
     *
     * @param  array<string, mixed>  $schema
     * @return array<string, mixed>
     */
    public static function normalize(array $schema): array
    {
        if (array_key_exists('properties', $schema) && is_array($schema['properties']) && $schema['properties'] === []) {
            $schema['properties'] = (object) [];
        }

        if (isset($schema['properties']) && is_array($schema['properties'])) {
            foreach ($schema['properties'] as $key => $property) {
                if (is_array($property)) {
                    $schema['properties'][$key] = self::normalize($property);
                }
            }
        }

        return $schema;
    }
}
