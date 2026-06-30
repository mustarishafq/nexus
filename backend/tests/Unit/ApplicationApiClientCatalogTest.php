<?php

namespace Tests\Unit;

use App\Services\ApplicationApiClient;
use Tests\TestCase;

class ApplicationApiClientCatalogTest extends TestCase
{
    private ApplicationApiClient $client;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client = app(ApplicationApiClient::class);
    }

    public function test_parse_catalog_endpoints_accepts_flat_array(): void
    {
        $payload = [
            ['method' => 'GET', 'path' => '/api/items'],
            ['method' => 'POST', 'path' => '/api/items'],
        ];

        $this->assertSame($payload, $this->client->parseCatalogEndpoints($payload));
    }

    public function test_parse_catalog_endpoints_accepts_wrapped_endpoints_key(): void
    {
        $payload = [
            'version' => '1.0',
            'endpoints' => [
                ['method' => 'GET', 'path' => '/api/items'],
            ],
        ];

        $this->assertSame(
            [['method' => 'GET', 'path' => '/api/items']],
            $this->client->parseCatalogEndpoints($payload)
        );
    }

    public function test_parse_catalog_endpoints_accepts_wrapped_data_key(): void
    {
        $payload = [
            'success' => true,
            'data' => [
                ['method' => 'DELETE', 'path' => '/api/items/{id}'],
            ],
        ];

        $this->assertSame(
            [['method' => 'DELETE', 'path' => '/api/items/{id}']],
            $this->client->parseCatalogEndpoints($payload)
        );
    }

    public function test_parse_catalog_endpoints_normalizes_uri_field(): void
    {
        $payload = [
            ['method' => 'GET', 'uri' => '/api/health'],
        ];

        $this->assertSame(
            [['method' => 'GET', 'uri' => '/api/health', 'path' => '/api/health']],
            $this->client->parseCatalogEndpoints($payload)
        );
    }

    public function test_parse_catalog_endpoints_ignores_non_endpoint_values(): void
    {
        $payload = [
            'version' => '1.0',
            'enabled' => true,
            'note' => 'catalog',
            'endpoints' => [
                ['method' => 'GET', 'path' => '/api/items'],
            ],
        ];

        $this->assertSame(
            [['method' => 'GET', 'path' => '/api/items']],
            $this->client->parseCatalogEndpoints($payload)
        );
    }
}
