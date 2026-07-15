# EMZI Nexus — MCP API Catalog Specification

Portable standard for exposing any EMZI Nexus application to **EMZI Nexus Brain**. Use this document when implementing or integrating MCP-ready REST APIs in Analytics, Care, or any future Nexus system.

---

## Catalog endpoint

**Use `GET /api/mcp/v1/catalog` as the only catalog endpoint.**

### Why v1

- **Versioned** — future `v2` can ship without breaking Brain
- **Standard envelope** — every MCP API uses `{ success, data, meta }`
- **Richer documentation** — each entry includes `auth`, `request_example`, `error_examples`
- **Aligned with EMZI Nexus MCP API Layer** — controllers, validation, logging, permissions
- **Tool mapping** — REST paths map cleanly to MCP tools (e.g. `customer.list` → `GET /api/mcp/v1/customers`)

---

## Architecture

```text
AI Assistant
      │
      ▼
EMZI Nexus Brain (MCP Server)
      │
      │  1. GET /api/mcp/v1/catalog   (discover APIs)
      │  2. GET/POST /api/mcp/v1/...  (call APIs)
      ▼
MCP API Layer (this application)
      │
      ▼
Existing Business Services
      │
      ▼
Database
```

The application is **not** an AI app. It only exposes secure REST APIs. Nexus Brain performs tool-to-REST mapping.

---

## Nexus Brain connection

### 1. Configure the application

Set a shared API key (environment or admin settings):

```env
MCP_API_KEY=your-long-random-secret-min-32-chars
MCP_API_KEYS=rotated-key-1,rotated-key-2   # optional, for rotation
MCP_RATE_LIMIT=60
```

### 2. Register in Nexus Brain → Connected Systems

| Field | Example |
|-------|---------|
| Base URL | `https://analytics.yourdomain.com` |
| API Key | Same value as `MCP_API_KEY` |
| Catalog URL | `{base_url}/api/mcp/v1/catalog` |

### 3. Verify

```bash
curl -s -H "X-API-Key: YOUR_KEY" \
  https://analytics.yourdomain.com/api/mcp/v1/catalog
```

Expected: HTTP 200 with `success: true` and a `data` array of endpoint definitions.

No further registration is required. Nexus Brain's `describe_application_api` tool calls the catalog live whenever it needs to know what the system can do.

---

## Authentication

Every MCP v1 route (including the catalog) requires one of:

| Method | Header | When |
|--------|--------|------|
| API Key | `X-API-Key: <secret>` | Server-to-server (Nexus Brain) — **recommended** |
| Bearer token | `Authorization: Bearer <sanctum-token>` | Acting on behalf of a logged-in user; permissions enforced |

Reject missing, invalid, or expired credentials with HTTP 401.

---

## Standard response envelope

All `/api/mcp/v1/*` endpoints (except 204) use this shape.

**Success:**

```json
{
  "success": true,
  "message": null,
  "data": {},
  "meta": {}
}
```

**Error:**

```json
{
  "success": false,
  "message": "Description of the error.",
  "errors": []
}
```

**Paginated list** (`meta` on success):

```json
{
  "success": true,
  "message": null,
  "data": [],
  "meta": {
    "current_page": 1,
    "last_page": 5,
    "per_page": 50,
    "total": 230
  }
}
```

---

## Catalog endpoint

### Request

```http
GET /api/mcp/v1/catalog
X-API-Key: <secret>
```

### Response

```json
{
  "success": true,
  "message": null,
  "data": [
    {
      "method": "GET",
      "path": "/api/mcp/v1/customers",
      "description": "List or search customers with filtering, sorting, and pagination.",
      "auth": ["X-API-Key", "Bearer"],
      "params": [
        {
          "name": "search",
          "in": "query",
          "type": "string",
          "required": false,
          "description": "Search by name or phone"
        },
        {
          "name": "page",
          "in": "query",
          "type": "integer",
          "required": false
        },
        {
          "name": "per_page",
          "in": "query",
          "type": "integer",
          "required": false,
          "rules": "min:1|max:200"
        }
      ],
      "request_example": "GET /api/mcp/v1/customers?search=jane&page=1&per_page=50",
      "response_example": {
        "success": true,
        "data": [{ "id": 1, "name": "Jane Doe" }],
        "meta": { "current_page": 1, "last_page": 1, "per_page": 50, "total": 1 }
      },
      "error_examples": [
        { "status": 401, "message": "Invalid or missing credentials." },
        { "status": 422, "message": "The given data was invalid." }
      ]
    }
  ],
  "meta": {}
}
```

The catalog endpoint **may include itself** in `data` so Brain always has a self-describing entry point.

---

## Catalog entry schema

Each object in `data`:

| Field | Required | Description |
|-------|----------|-------------|
| `method` | Yes | `GET`, `POST`, `PUT`, `PATCH`, or `DELETE` |
| `path` | Yes | Relative path only (no host). Use `{param}` for path params. MCP routes use `/api/mcp/v1/`; SSO and similar may use other `/api/` paths but must be documented here |
| `description` | Yes | One plain-language sentence for someone who has never seen the codebase |
| `auth` | Yes | Array of accepted auth methods: `X-API-Key`, `Bearer` |
| `params` | No | Query, body, and path parameters (see below) |
| `request_example` | No | Example URL, query string, or JSON body |
| `response_example` | No | Realistic trimmed example using the standard envelope |
| `error_examples` | No | Array of `{ status, message }` for common failures |

### Parameter object

```json
{
  "name": "status",
  "in": "query",
  "type": "string",
  "required": false,
  "description": "Filter by status",
  "rules": "optional validation hint"
}
```

`in` values: `path`, `query`, `body`.

---

## MCP API route rules

All MCP-exposed routes must:

1. Live under `/api/mcp/v1/` (never unversioned)
2. Use the standard success/error envelope
3. Authenticate via middleware (API key and/or Bearer)
4. Validate input with dedicated Request classes (not in controllers)
5. Return API Resources or DTOs (never raw ORM models)
6. Delegate business logic to existing services
7. Log every request (endpoint, client, request ID, duration, status)
8. Support pagination on list endpoints: `page`, `per_page`
9. Support filtering/sorting/search where applicable: `search`, `sort_by`, `sort_order`, domain filters

### Example tool → REST mapping

| MCP Tool (Brain-side) | REST API (application) |
|-----------------------|------------------------|
| `customer.list` | `GET /api/mcp/v1/customers` |
| `customer.show` | `GET /api/mcp/v1/customers/{id}` |
| `purchase.create` | `POST /api/mcp/v1/purchases` |
| `analytics.dashboard` | `GET /api/mcp/v1/analytics/dashboard` |

The application does not know about MCP tool names. Brain performs the mapping using the live catalog.

---

## What to include in the catalog

**Include:**

- Server-to-server endpoints Nexus Brain may call
- SSO verify endpoint if Brain needs to exchange tokens (`POST /api/sso/nexus/verify` — may live outside `/api/mcp/v1/` but should appear in the catalog)
- Read and write operations on core domain entities

**Exclude:**

- Frontend-only routes (CSRF, session cookie endpoints)
- Internal admin UI helpers unless Brain genuinely needs them
- Unauthenticated public routes unless required

---

## Implementation checklist (new system)

- [ ] `config/mcp.php` with API key(s) and rate limit
- [ ] `routes/mcp.php` registered at prefix `api/mcp/v1`
- [ ] `AuthenticateMcpClient` middleware (`X-API-Key` + Bearer)
- [ ] `LogMcpRequest` middleware
- [ ] `McpResponse` helper for standard envelope
- [ ] Versioned controllers under `app/Http/Controllers/Mcp/V1/`
- [ ] Form Requests under `app/Http/Requests/Mcp/V1/`
- [ ] API Resources under `app/Http/Resources/Mcp/V1/`
- [ ] Adapter services under `app/Services/Mcp/` (delegate to existing services)
- [ ] Documentation class (e.g. `app/Mcp/Documentation/McpV1Endpoints.php`)
- [ ] `GET /api/mcp/v1/catalog` returning documented entries
- [ ] Feature tests: auth, validation, success, errors, permissions

---

## AI implementation prompt

Paste the block below into an AI session with access to the target system's codebase.

---

### Prompt: Implement EMZI Nexus MCP API Layer

Implement an MCP API Layer for this system following the **EMZI Nexus MCP API Catalog Specification**.

This is **not** an AI module. Do not call LLM providers. Expose secure versioned REST APIs at `/api/mcp/v1/` that Nexus Brain can consume.

Requirements:

1. **Catalog:** `GET /api/mcp/v1/catalog` returns the standard envelope with a `data` array of endpoint definitions (method, path, description, auth, params, request_example, response_example, error_examples).

2. **Versioning:** All MCP routes under `/api/mcp/v1/`. Never expose unversioned MCP endpoints.

3. **Response format:**
   - Success: `{ "success": true, "message": null, "data": {}, "meta": {} }`
   - Error: `{ "success": false, "message": "...", "errors": [] }`
   - Pagination meta: `current_page`, `last_page`, `per_page`, `total`

4. **Auth:** Middleware accepting `X-API-Key` (with key rotation support) and `Authorization: Bearer` (with permission checks for user tokens).

5. **Architecture:** Thin controllers → adapter services → existing business services. No business logic in controllers. No direct DB access if a service already exists.

6. **Validation:** Dedicated Form Request classes.

7. **Serialization:** API Resources or DTOs only.

8. **Logging:** Log every MCP request (endpoint, client, request ID, duration, status).

9. **Documentation:** Every exposed endpoint documented in the catalog class.

10. **Tests:** Auth, validation, success responses, error responses, permission checks.

11. **Inbound routes:** Keep existing `/api/inbound/*` routes if present for direct integrations; MCP v1 is the Nexus Brain standard.

Reference implementation: EMZI Nexus Analytics (`/api/mcp/v1/catalog`, `routes/mcp.php`, `app/Mcp/`, `app/Services/Mcp/`).

Full spec: `emzi-nexus-mcp-catalog-spec.md` in the repository root.

---

## Reference: EMZI Nexus Analytics

| Item | Value |
|------|-------|
| Catalog | `GET /api/mcp/v1/catalog` |
| Auth header | `X-API-Key` |
| Config | `backend/config/mcp.php` |
| Routes | `backend/routes/mcp.php` |
| Endpoint docs | `backend/app/Mcp/Documentation/McpV1Endpoints.php` |

Example domains exposed: metadata, analytics, customers, purchases, SSO verify.
