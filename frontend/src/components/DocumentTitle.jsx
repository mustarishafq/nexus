import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import {
  applyDocumentTitle,
  DEFAULT_SYSTEM_NAME,
  formatDocumentTitle,
  getPageTitle,
} from '@/lib/pageTitles';

export default function DocumentTitle() {
  const location = useLocation();
  const { appPublicSettings, forcePasswordChange } = useAuth();
  const systemName = appPublicSettings?.system_name || DEFAULT_SYSTEM_NAME;

  useEffect(() => {
    const pageTitle = getPageTitle(location.pathname, { forcePasswordChange });
    applyDocumentTitle(formatDocumentTitle(pageTitle, systemName));
  }, [forcePasswordChange, location.pathname, systemName]);

  return null;
}
