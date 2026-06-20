import React from 'react';

import SplashSystemName from '@/components/pwa/splash-animations/SplashSystemName';

export default function SplashExperienceFrame({ runtime, preview = false, children }) {
  const title = <SplashSystemName runtime={runtime} preview={preview} />;

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      {runtime.title.position === 'above' ? title : null}
      {children}
      {runtime.title.position === 'below' ? title : null}
    </div>
  );
}
