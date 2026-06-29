# EMZI Nexus — Frontend

React + Vite SPA for **EMZI Nexus Brain**.

## Prerequisites

- Node.js 18+
- Running Nexus backend (see [install.md](../install.md))

## Setup

```bash
npm install
```

Create `.env` (or `.env.local`) in this directory:

```
VITE_API_BASE_URL=http://localhost:8000
VITE_SYSTEM_NAME=EMZI Nexus Brain
```

## Development

```bash
npm run dev
```

The dev server proxies `/api`, `/storage`, and MCP/OAuth paths to the backend.

## Build

```bash
npm run build
```

Output is written to `dist/`. See [install.md](../install.md) for deployment.
