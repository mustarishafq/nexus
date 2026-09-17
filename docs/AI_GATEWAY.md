# Brain AI provider

SSO apps (Campus, Resource, and others) use **Nexus Brain as their AI provider**. Brain holds the OpenRouter key and default model. Apps never talk to OpenRouter.

Each app owns prompts and output parsing. Brain forwards `messages` plus attachments and returns an OpenAI-style chat completion.

## Enable an application

1. Register the app under **Applications** with a shared `api_key` (≥ 32 characters).
2. Edit the application and turn on **AI provider**.
3. Configure OpenRouter key/model in **Settings → Admin → AI** (or `OPENROUTER_API_KEY` / `OPENROUTER_MODEL`).

## Auth

Same satellite service auth as other `/api/nexus/v1/*` routes:

- `X-Nexus-Api-Key: <Application.api_key>`
- and/or `Authorization: Bearer <JWT>` signed with that key (`typ=service` or `sub=system`, `aud=brain-ai`)

To attribute usage to a Nexus person, also send:

- `X-Nexus-Acting-User-Id: <Brain user id>`
- and/or `X-Nexus-Acting-Email: <Brain or SSO email>`

You can send the same values in the JSON body as `user_id` / `nexus_user_id` / `user.email`. Without this, the usage log User column is empty because the call is a service credential, not a logged-in Brain session.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/nexus/v1/ai/models` | The Brain default model id |
| `POST` | `/api/nexus/v1/ai/chat/completions` | Chat completion |

### Completions JSON

```json
{
  "messages": [
    { "role": "system", "content": "Your prompt. You own this." },
    { "role": "user", "content": "Instructor notes…" }
  ],
  "response_format": { "type": "json_object" },
  "temperature": 0.2,
  "max_tokens": 4000,
  "attachments": [
    {
      "filename": "syllabus.md",
      "media_type": "text/markdown",
      "data": "<base64>"
    }
  ]
}
```

`model` is optional and must match Brain’s default if sent. `tools` are ignored.

### Multipart

`multipart/form-data` with:

- `payload` — JSON string of the body above (without large files)
- `files[]` — uploaded files (markdown, text, CSV, JSON, PDF, png/jpeg/webp/gif)

Limits: 10 files, 12MB total, ~200k inlined text characters.

### Normalization

| Type | Upstream |
|------|----------|
| `.md` `.txt` `.csv` `.json` | Extra `text` content parts (`Attached file {name}:…`) |
| Images | `image_url` data URLs |
| PDF | OpenRouter `file` parts |

Response is the OpenRouter/OpenAI body (`id`, `model`, `choices`, `usage`). Usage is logged as `feature=satellite_ai` with the application slug.

## Campus

Campus (Herd `LMS`) should call this API with `X-Nexus-Api-Key` and keep course-draft prompts and JSON validation in Campus. See Campus `docs/BRAIN_AI.md`.
