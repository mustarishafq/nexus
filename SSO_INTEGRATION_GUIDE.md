# Nexus SSO Integration Guide

This document describes what a **connected system** must implement to support
automatic login (Single Sign-On) initiated from the Nexus notification hub.

---

## Overview

Nexus uses **signed JWT tokens** (HS256) to prove a user's identity to connected
systems without transmitting passwords.  The flow is:

```
User clicks "Launch" in Nexus
        │
        ▼
Nexus calls POST /api/connected-systems/{id}/launch
        │  (server-side, using the shared api_key as signing secret)
        ▼
Nexus receives { launch_url, token, expires_in: 60 }
        │
        ▼
Browser opens  https://your-system.com/sso/nexus?token=<JWT>&return_to=<URL>
        │
        ▼
Your system verifies the JWT → creates a session → redirects user to app
```

---

## Step 1 — Share a secret key

In Nexus, open **Connected Systems → Edit** and fill in the **API Key** field.

- Use a random string of **at least 32 characters** (e.g. `openssl rand -hex 32`)
- Store the **same value** in your system's environment/config
- Never expose it in client-side code or logs

---

## Step 2 — Implement the SSO endpoint

Your system must expose a route that accepts the token:

```
GET /sso/nexus?token=<JWT>&return_to=<URL>
```

> You may also accept it as `POST /sso/nexus` with a `token` body field if you
> prefer a form POST — just ensure Nexus's `launch_url` pattern matches.

### Verification steps

1. **Decode** the token using your JWT library with the shared `api_key` secret and algorithm `HS256`
2. **Validate standard claims**:
   - `exp` — reject if the current time is past the expiry (tokens last 60 s)
   - `iss` — should equal the Nexus app URL (e.g. `http://localhost:8000`)
3. **Read identity claims**:

   | Claim   | Type   | Description                                  |
   |---------|--------|----------------------------------------------|
   | `sub`   | string | Nexus user ID                                |
   | `email` | string | User's email address (use this to look up)   |
   | `name`  | string | User's display name                          |
   | `sys`   | string | Slug of the connected system being launched  |
    | `return_to` | string | Nexus URL to redirect user to after logout |
   | `iat`   | int    | Issued-at timestamp (Unix seconds)           |
   | `exp`   | int    | Expiry timestamp (Unix seconds, iat + 60)    |

4. **Find or provision the user** by `email`
5. **Create a session** (set cookie / issue your own session token)
6. **Redirect** the user to the appropriate page inside your app
7. Store `return_to` in session so logout can send user back to Nexus

---

## Logout Redirect Back To Nexus

On your connected system, after SSO login:

1. Read `return_to` from query or JWT claim
2. Save it in server-side session (example key: `nexus_return_to`)
3. On logout, redirect there instead of default login page

Example logout target:

```
https://nexus.example.com/systems
```

---

## Step 3 — Code examples

### Laravel (PHP)

```php
// composer require firebase/php-jwt
use Firebase\JWT\JWT;
use Firebase\JWT\Key;

Route::get('/sso/nexus', function (Request $request) {
    $token  = $request->query('token');
    $secret = config('services.nexus.api_key'); // same value stored in Nexus

    try {
        $payload = JWT::decode($token, new Key($secret, 'HS256'));
    } catch (\Throwable $e) {
        abort(401, 'Invalid SSO token: ' . $e->getMessage());
    }

    $user = User::firstOrCreate(
        ['email' => $payload->email],
        ['name'  => $payload->name, 'password' => \Illuminate\Support\Str::random(32)],
    );

    Auth::login($user);

    return redirect('/dashboard');
});
```

### Node / Express (JavaScript)

```js
// npm install jsonwebtoken
const jwt = require('jsonwebtoken');

app.get('/sso/nexus', (req, res) => {
    const { token } = req.query;
    const secret = process.env.NEXUS_API_KEY;

    let payload;
    try {
        payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
    } catch (err) {
        return res.status(401).send('Invalid SSO token: ' + err.message);
    }

    // Find or create user by payload.email, then create session
    req.session.userId = payload.sub;
    res.redirect('/dashboard');
});
```

### Python / Django

```python
# pip install PyJWT
import jwt
from django.conf import settings
from django.contrib.auth import login, get_user_model
from django.shortcuts import redirect

def sso_nexus(request):
    token = request.GET.get('token', '')
    try:
        payload = jwt.decode(token, settings.NEXUS_API_KEY, algorithms=['HS256'])
    except jwt.PyJWTError as e:
        return HttpResponse(f'Invalid SSO token: {e}', status=401)

    User = get_user_model()
    user, _ = User.objects.get_or_create(
        email=payload['email'],
        defaults={'name': payload.get('name', '')}
    )
    login(request, user)
    return redirect('/dashboard/')
```

---

## Security checklist

- [ ] Secret key is **at least 32 characters** of random entropy
- [ ] Secret key is stored in environment variables, **not** in source code
- [ ] Token `exp` claim is validated — reject tokens older than 60 seconds
- [ ] Token `iss` claim is validated — reject tokens from unexpected issuers
- [ ] The SSO endpoint is served over **HTTPS** in production
- [ ] Your system does **not** log the raw token value
- [ ] On `firstOrCreate` provisioning, a random password is assigned so the account cannot be brute-forced via normal login

---

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `422 System has no api_key configured` | API Key field empty in Nexus | Edit the system and add the shared key |
| `403 System is not enabled` | `is_enabled` is false | Enable the system in Nexus |
| `401 Signature verification failed` | Secrets don't match | Ensure both sides use the exact same key value |
| `401 Expired token` | Token used after 60 s | Re-click Launch in Nexus to get a fresh token |
| `422 System has no base URL` | Base URL field empty | Edit the system and add the Base URL |
