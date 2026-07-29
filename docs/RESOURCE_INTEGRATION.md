# EMZI Nexus Resource integration

Brain hub contract for the **EMZI Nexus Resource** Human Capital satellite (attendance SoR, employee roster details, AutoCount leave).

Resource lives beside Brain as a sibling Herd app (not nested under `nexus/`). See Resource `README.md` and `docs/e2e-checklist.md` for satellite setup and smoke tests.

## Prerequisites

1. In Brain **Applications**, create **EMZI Nexus Resource**:
   - `base_url` = Resource SPA origin (must serve `/sso/nexus` and proxy `/api`)
   - `auth_mode` = `jwt`
   - `api_key` ≥ 32 characters (shared secret)
2. In Resource **Settings → Nexus SSO**: issuer = Brain `APP_URL`, same API key.
3. Resource advertises capabilities at `/.well-known/nexus-integration.json` (SPA `public/` + API mirror).

## Brain APIs (satellite service auth)

Auth: `X-Nexus-Api-Key: <Application.api_key>` and/or Bearer JWT signed with that key (`typ=service` / `sub=system`).

| Method | Path | Audience (`aud`) | Purpose |
|--------|------|------------------|---------|
| `GET` | `/api/nexus/v1/employees` | `brain-employees` | Export identity + full staff profile for Resource sync |
| `POST` | `/api/nexus/v1/employees` | `brain-employees` | Provision / link a Brain login from Resource |
| `PUT` | `/api/nexus/v1/employees` | `brain-employees` | Bidirectional staff upsert (`{ employees: [...] }`, last-write-wins on save) |
| `GET` | `/api/nexus/v1/attendance` | `brain-attendance` | Paginated history export (`after_id`, `limit`, optional `captured_from` / `captured_to`) |

Employee rows include identity, full staff/HR profile (phones, demographics, IC/EPF/SOCSO/tax, next-of-kin, spouse/children, skills, education/work history, manager), plus `department_name` / `company_name` and `inactive` / `deleted` flags.

On profile save in Brain (admin user update or self profile), Brain pushes the employee snapshot to Insan’s `PUT /api/nexus/v1/employees` (`employees.sync` well-known capability). Insan pushes back on employee create/update. Inbound apply uses an echo guard so pushes do not loop.

Attendance export rows use Brain record id as `external_id` so Resource ingest/migrate stays idempotent.

## Clock punch forward

After a successful Brain clock (`POST /api/attendance/clock`), Brain fail-soft forwards to Resource:

1. Resolve Application named **EMZI Nexus Resource** (or slug/name containing `resource`), else the first enabled app whose well-known advertises `attendance.ingest`.
2. `GET {base_url}/.well-known/nexus-integration.json` (cached briefly).
3. `POST {base_url}{endpoints.attendance_ingest}` with the punch payload and the Application API key.

Failures are logged only — Brain clock still returns 201.

## Related docs

- Satellite bootstrap: [`INITIAL_SETUP.md`](./INITIAL_SETUP.md)
- SSO JWT contract: [`SSO_INTEGRATION_GUIDE.md`](./SSO_INTEGRATION_GUIDE.md)
- MCP catalog (Resource side): [`emzi-nexus-mcp-catalog-spec.md`](./emzi-nexus-mcp-catalog-spec.md)
