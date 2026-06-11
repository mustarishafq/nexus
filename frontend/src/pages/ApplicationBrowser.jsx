import db, { API_ORIGIN } from '@/api/base44Client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const toAbsoluteUrl = (url) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }

  if (!API_ORIGIN) return url;

  return url.startsWith('/') ? `${API_ORIGIN}${url}` : `${API_ORIGIN}/${url}`;
};

function detectEmbedBlocked(iframe) {
  if (!iframe) return false;

  try {
    const doc = iframe.contentDocument;
    if (!doc) return false;

    const href = iframe.contentWindow?.location?.href ?? '';
    if (href === 'about:blank' || href.startsWith('chrome-error://')) {
      return true;
    }

    return doc.body?.childElementCount === 0 && doc.body?.textContent?.trim() === '';
  } catch {
    // Cross-origin means the page loaded in the iframe.
    return false;
  }
}

export default function ApplicationBrowser() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const redirectTo = useMemo(() => {
    const fromQuery = new URLSearchParams(location.search).get('redirect_to');
    if (fromQuery) return fromQuery;

    return location.state?.redirectTo || undefined;
  }, [location.search, location.state?.redirectTo]);
  const iframeRef = useRef(null);
  const [launchUrl, setLaunchUrl] = useState(null);
  const [launchError, setLaunchError] = useState(null);
  const [embedBlocked, setEmbedBlocked] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [loadingLaunch, setLoadingLaunch] = useState(true);

  const { data: system, isLoading: loadingSystem, error: systemError } = useQuery({
    queryKey: ['application', id],
    queryFn: () => db.entities.Application.get(id),
    retry: false,
  });

  useEffect(() => {
    if (!id) return undefined;

    let cancelled = false;
    setLoadingLaunch(true);
    setLaunchError(null);
    setLaunchUrl(null);
    setEmbedBlocked(false);

    db.launchSystem(id, { redirect_to: redirectTo || undefined })
      .then(({ launch_url }) => {
        if (!cancelled) {
          setLaunchUrl(launch_url);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLaunchError(err.message || 'Unable to launch application.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingLaunch(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id, redirectTo]);

  const checkEmbedStatus = useCallback(() => {
    if (detectEmbedBlocked(iframeRef.current)) {
      setEmbedBlocked(true);
    }
  }, []);

  useEffect(() => {
    if (!launchUrl) return undefined;

    const timer = window.setTimeout(checkEmbedStatus, 2500);
    return () => window.clearTimeout(timer);
  }, [launchUrl, iframeKey, checkEmbedStatus]);

  const openInNewTab = () => {
    if (!launchUrl) return;

    const tab = window.open(launchUrl, '_blank', 'noopener,noreferrer');
    if (tab) {
      tab.opener = null;
      return;
    }

    toast.error('Pop-up blocked. Allow pop-ups for this site or use the link below.');
  };

  const refreshFrame = () => {
    setEmbedBlocked(false);
    setIframeKey((current) => current + 1);
  };

  if (loadingSystem) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (systemError || !system) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-muted-foreground">
          {systemError?.message || 'Application not found or access denied.'}
        </p>
        <Button variant="outline" onClick={() => navigate('/applications')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Applications
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="flex items-center gap-3 border-b border-border bg-card/80 px-4 py-2.5 backdrop-blur-xl shrink-0">
        <Button variant="ghost" size="sm" className="gap-1.5 shrink-0" onClick={() => navigate('/applications')}>
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {system.icon_url ? (
            <img
              src={toAbsoluteUrl(system.icon_url)}
              alt={system.name}
              className="h-7 w-7 shrink-0 rounded-md object-cover"
            />
          ) : (
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white"
              style={{ backgroundColor: system.color || '#6366f1' }}
            >
              {system.name?.[0]?.toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{system.name}</p>
            {launchUrl ? (
              <p className="truncate text-[11px] text-muted-foreground">{launchUrl}</p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Refresh" onClick={refreshFrame} disabled={!launchUrl}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={openInNewTab} disabled={!launchUrl}>
            <ExternalLink className="w-3.5 h-3.5" />
            Open in tab
          </Button>
        </div>
      </div>

      {embedBlocked ? (
        <div className="flex items-start gap-3 border-b border-warning/30 bg-warning/10 px-4 py-3 text-sm shrink-0">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">This site cannot be embedded</p>
            <p className="text-muted-foreground">
              Sites like Google Sheets block in-app browsers for security. Open it in a new tab instead.
            </p>
          </div>
          <Button size="sm" className="shrink-0" onClick={openInNewTab}>
            Open in new tab
          </Button>
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1 bg-muted/20">
        {loadingLaunch ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
          </div>
        ) : null}

        {launchError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-sm text-muted-foreground">{launchError}</p>
            <Button variant="outline" onClick={() => navigate('/applications')}>
              Back to Applications
            </Button>
          </div>
        ) : null}

        {launchUrl && !launchError ? (
          <iframe
            key={iframeKey}
            ref={iframeRef}
            src={launchUrl}
            title={system.name}
            className="h-full w-full border-0 bg-white"
            onLoad={checkEmbedStatus}
            referrerPolicy="no-referrer-when-downgrade"
            allow="clipboard-read; clipboard-write; fullscreen"
          />
        ) : null}
      </div>
    </div>
  );
}
