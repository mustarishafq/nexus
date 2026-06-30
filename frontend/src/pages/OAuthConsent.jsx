import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import db from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Loader2 } from 'lucide-react';

export default function OAuthConsent() {
  const [searchParams] = useSearchParams();
  const [client, setClient] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState(false);
  const [error, setError] = useState('');

  const params = {
    client_id: searchParams.get('client_id') || '',
    redirect_uri: searchParams.get('redirect_uri') || '',
    state: searchParams.get('state') || '',
    scope: searchParams.get('scope') || '',
    code_challenge: searchParams.get('code_challenge') || '',
    code_challenge_method: searchParams.get('code_challenge_method') || 'S256',
  };

  useEffect(() => {
    if (!params.client_id || !params.redirect_uri || !params.code_challenge) {
      setError('This authorization link is missing required parameters.');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const [clientInfo, user] = await Promise.all([
          db.oauth.getClient(params.client_id, params.redirect_uri),
          db.auth.me().catch(() => null),
        ]);
        setClient(clientInfo);

        if (!user) {
          const returnTo = `/mcp-consent?${searchParams.toString()}`;
          window.location.href = `/login?redirect=${encodeURIComponent(returnTo)}`;
          return;
        }

        setCurrentUser(user);
      } catch (err) {
        setError(err?.data?.message || err.message || 'Could not load this connection request.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const denyAndRedirect = () => {
    const query = new URLSearchParams({ error: 'access_denied' });
    if (params.state) query.set('state', params.state);
    const separator = params.redirect_uri.includes('?') ? '&' : '?';
    window.location.href = `${params.redirect_uri}${separator}${query.toString()}`;
  };

  const allow = async () => {
    setDeciding(true);
    setError('');
    try {
      const { redirect_to } = await db.oauth.decide(params);
      window.location.href = redirect_to;
    } catch (err) {
      setError(err?.data?.message || err.message || 'Could not complete authorization.');
      setDeciding(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg space-y-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-lg font-semibold">
            {client?.name || 'An application'} wants to connect
          </h1>
          <p className="text-sm text-muted-foreground">
            {currentUser?.email ? `Signed in as ${currentUser.email}. ` : ''}
            This will let it list connected systems, look up their APIs, and call them on your behalf via Nexus&apos;s MCP server.
            First-time connections start with read-only access. An admin can grant more from API tokens.
          </p>
        </div>

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}

        {!error && (
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={denyAndRedirect} disabled={deciding}>
              Deny
            </Button>
            <Button className="flex-1" onClick={allow} disabled={deciding}>
              {deciding ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Allow'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
