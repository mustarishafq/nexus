import { useEffect } from 'react';
import { updateMetaTags } from '@/lib/MetaTagManager';

/**
 * useMetaTags - React hook for updating meta tags on page mount
 * @param {Object} config - Configuration object for meta tags
 * @param {string} config.title - Page title
 * @param {string} config.description - Page description
 * @param {string} config.image - OG image URL
 * @param {string} config.url - Page URL
 * @example
 * useMetaTags({
 *   title: 'Notifications - Nexus',
 *   description: '3 unread notifications pending',
 * });
 */
export const useMetaTags = (config = {}) => {
  useEffect(() => {
    updateMetaTags(config);
  }, [config?.title, config?.description, config?.image, config?.url]);
};
