/**
 * Meta Tag Manager - Dynamically update Open Graph and social sharing meta tags
 * Useful for SEO, social media sharing (WhatsApp, Telegram, Twitter, Facebook, etc.)
 */

export const updateMetaTags = (config = {}) => {
  const {
    title,
    description = 'EMZI unified system access, simplified',
    image = `${typeof window !== 'undefined' ? window.location.origin : ''}/icons/pwa-icon-512.png`,
    url = typeof window !== 'undefined' ? window.location.href : '',
  } = config;

  // Browser tab title is owned by DocumentTitle. Only sync share tags when a page
  // still passes an explicit title.
  if (title) {
    updateMetaTag('og:title', title);
    updateMetaTag('twitter:title', title);
  }

  updateMetaTag('og:description', description);
  updateMetaTag('og:image', image);
  updateMetaTag('og:url', url);
  updateMetaTag('twitter:description', description);
  updateMetaTag('twitter:image', image);
  updateMetaTag('description', description);
};

/**
 * Update or create a meta tag with given property/name and content
 * @param {string} property - The meta property or name (e.g., 'og:title', 'description')
 * @param {string} content - The content value
 */
const updateMetaTag = (property, content) => {
  if (!content) return;

  // Determine if it's a property or name attribute
  const isProperty = property.includes(':');
  const selector = isProperty
    ? `meta[property="${property}"]`
    : `meta[name="${property}"]`;

  let meta = document.querySelector(selector);

  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(isProperty ? 'property' : 'name', property);
    document.head.appendChild(meta);
  }

  meta.setAttribute('content', content);
};

/**
 * Get the system name from environment or use default
 */
export const getSystemName = () => {
  return import.meta.env.VITE_SYSTEM_NAME || 'EMZI Nexus Brain';
};

/**
 * Build a notification share title
 */
export const buildNotificationShareTitle = (notification) => {
  return `${notification.title} - ${getSystemName()}`;
};

/**
 * Build a notification share description
 */
export const buildNotificationShareDescription = (notification) => {
  return notification.message || notification.title;
};

/**
 * Build a system status share description
 */
export const buildSystemStatusDescription = (unreadCount, totalCount) => {
  return `${unreadCount} unread of ${totalCount} total notifications`;
};
