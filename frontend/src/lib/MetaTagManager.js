/**
 * Meta Tag Manager - Dynamically update Open Graph and social sharing meta tags
 * Useful for SEO, social media sharing (WhatsApp, Telegram, Twitter, Facebook, etc.)
 */

export const updateMetaTags = (config = {}) => {
  const {
    title = 'Nexus Brain',
    description = 'System notification and event management platform',
    image = `${import.meta.env.VITE_API_BASE_URL || ''}/icons/pwa-icon-512x512.png`,
    url = typeof window !== 'undefined' ? window.location.href : '',
  } = config;

  // Update document title
  document.title = title;
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) {
    pageTitle.textContent = title;
  }

  // Update OG tags
  updateMetaTag('og:title', title);
  updateMetaTag('og:description', description);
  updateMetaTag('og:image', image);
  updateMetaTag('og:url', url);

  // Update Twitter tags
  updateMetaTag('twitter:title', title);
  updateMetaTag('twitter:description', description);
  updateMetaTag('twitter:image', image);

  // Update general meta tags
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
  return import.meta.env.VITE_SYSTEM_NAME || 'Nexus';
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
