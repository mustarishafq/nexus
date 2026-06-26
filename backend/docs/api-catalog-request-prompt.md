# API Catalog Request

Paste this into a Claude/AI session that has access to this system's codebase (or hand it to the maintainer). The goal: add **one new endpoint**, `GET /api/mcp-catalog`, that returns this system's own API catalog as JSON. Nexus (our internal SSO hub) calls this endpoint live every time it needs to know what this system can do — nothing is cached or stored elsewhere, so it can never go stale.

---

Please add an endpoint `GET /api/mcp-catalog` that returns a JSON array describing every endpoint another internal system might reasonably need to call. It should require the same service-to-service auth this system already uses for other internal API calls (e.g. the API key Nexus already authenticates with). For each endpoint include:

```json
[
  {
    "method": "GET",
    "path": "/api/leads/{id}",
    "description": "Fetch a single lead by ID, including contact details and status.",
    "auth_required": true,
    "params": [
      { "name": "id", "in": "path", "type": "integer", "required": true, "description": "Lead ID" }
    ],
    "response_example": { "id": 1, "name": "Jane Doe", "status": "open" }
  }
]
```

Rules:
- `method`: one of GET, POST, PUT, PATCH, DELETE.
- `path`: relative path only (no host), using `{param}` for path parameters.
- `description`: one sentence, plain language, written for someone who has never seen this codebase — what does calling this endpoint actually do/return.
- `auth_required`: true unless the endpoint is genuinely public.
- `params`: list query/body/path parameters. Use `"in"` values: `path`, `query`, or `body`. Omit the field entirely if there are no parameters.
- `response_example`: a small realistic example of the JSON response, trimmed to the important fields. Omit if the response is large/irrelevant — a short description is fine instead.
- Only include endpoints meant for **server-to-server** use (skip anything that only makes sense from this system's own frontend, like CSRF/session endpoints, unless they're genuinely needed externally).
- `GET /api/mcp-catalog` itself does not need to appear in its own output.
- The endpoint can return this list however it likes internally (hardcoded array, generated from route definitions, etc.) as long as the JSON shape above is correct and it stays in sync with reality — that's the whole point of making it live instead of a one-off document.

---

Once this endpoint exists and is reachable at `{base_url}/api/mcp-catalog` using this system's existing Nexus-issued API key, no further registration is needed — Nexus's `describe_application_api` MCP tool will call it directly whenever asked.
