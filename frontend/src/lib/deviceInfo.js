export function getDeviceInfo() {
  const ua = navigator.userAgent;
  const screenResolution = `${window.screen.width}x${window.screen.height}`;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  let browser = 'Unknown';
  let browserVersion = 'Unknown';

  if (ua.includes('Firefox/')) {
    browser = 'Firefox';
    browserVersion = ua.match(/Firefox\/([\d.]+)/)?.[1] || 'Unknown';
  } else if (ua.includes('Edg/')) {
    browser = 'Edge';
    browserVersion = ua.match(/Edg\/([\d.]+)/)?.[1] || 'Unknown';
  } else if (ua.includes('Chrome/')) {
    browser = 'Chrome';
    browserVersion = ua.match(/Chrome\/([\d.]+)/)?.[1] || 'Unknown';
  } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    browser = 'Safari';
    browserVersion = ua.match(/Version\/([\d.]+)/)?.[1] || 'Unknown';
  }

  let operatingSystem = 'Unknown';
  if (ua.includes('Windows')) operatingSystem = 'Windows';
  else if (ua.includes('Mac OS')) operatingSystem = 'macOS';
  else if (ua.includes('Linux')) operatingSystem = 'Linux';
  else if (ua.includes('Android')) operatingSystem = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) operatingSystem = 'iOS';

  let deviceType = 'desktop';
  if (/Tablet|iPad/i.test(ua)) deviceType = 'tablet';
  else if (/Mobi|Android/i.test(ua)) deviceType = 'mobile';

  return {
    browser,
    browser_version: browserVersion,
    operating_system: operatingSystem,
    device_type: deviceType,
    screen_resolution: screenResolution,
    timezone,
  };
}
