import * as React from "react"

export const MOBILE_BREAKPOINT = 768
export const XL_BREAKPOINT = 1280

/** Sync viewport check for non-React launch helpers (matches useIsMobile). */
export function isMobileViewport() {
  if (typeof window === 'undefined') return false
  return window.innerWidth < MOBILE_BREAKPOINT
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false
  )

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange);
  }, [])

  return !!isMobile
}

/** True at the same xl breakpoint used by profile/feed multi-column layouts. */
export function useIsXlUp() {
  const [isXlUp, setIsXlUp] = React.useState(() => (
    typeof window !== 'undefined' ? window.innerWidth >= XL_BREAKPOINT : false
  ))

  React.useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${XL_BREAKPOINT}px)`)
    const onChange = () => setIsXlUp(window.innerWidth >= XL_BREAKPOINT)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isXlUp
}

/** Mobile + tablet: full-width bottom nav instead of the desktop dock. */
export function useIsCompactNav() {
  return !useIsXlUp()
}
