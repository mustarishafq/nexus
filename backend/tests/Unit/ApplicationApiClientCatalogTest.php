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

    public function test_extract_access_token_from_common_sso_verify_shapes(): void
    {
        $this->assertSame('abc', $this->client->extractAccessToken(['token' => 'abc']));
        $this->assertSame('abc', $this->client->extractAccessToken(['data' => ['access_token' => 'abc']]));
        $this->assertSame('abc', $this->client->extractAccessToken(['success' => true, 'data' => ['token' => 'abc']]));
        $this->assertNull($this->client->extractAccessToken(['ok' => true]));
        $this->assertNull($this->client->extractAccessToken(['data' => [['path' => '/api/items']]]));
    }

    public function test_scope_payload_keeps_only_acting_user_records(): void
    {
        $payload = [
            'items' => [
                ['id' => 1, 'assigned_to_id' => '42', 'title' => 'Mine'],
                ['id' => 2, 'assigned_to_id' => '99', 'title' => 'Other'],
            ],
            'total' => 2,
        ];

        $scoped = $this->client->scopePayloadToActingUser(
            $payload,
            ['email' => 'alex@example.com', 'user_id' => '42', 'headers' => []],
            'GET',
        );

        $this->assertCount(1, $scoped['items']);
        $this->assertSame('Mine', $scoped['items'][0]['title']);
        $this->assertSame(1, $scoped['total']);
    }

    public function test_scope_payload_skips_org_wide_queries(): void
    {
        $payload = [
            'items' => [
                ['id' => 1, 'assigned_to_id' => '42'],
                ['id' => 2, 'assigned_to_id' => '99'],
            ],
        ];

        $scoped = $this->client->scopePayloadToActingUser(
            $payload,
            ['email' => 'alex@example.com', 'user_id' => '42', 'headers' => []],
            'GET',
            ['scope' => 'all'],
        );

        $this->assertCount(2, $scoped['items']);
    }
}
