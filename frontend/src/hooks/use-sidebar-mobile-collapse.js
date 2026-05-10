import { useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Hook to auto-collapse sidebar on mobile by default.
 * @param {boolean} collapsed Current collapsed state
 * @param {function} setCollapsed Setter for collapsed state
 */
export function useSidebarMobileCollapse(collapsed, setCollapsed) {
  const isMobile = useIsMobile();
  useEffect(() => {
    if (isMobile && !collapsed) {
      setCollapsed(true);
    }
  }, [isMobile, collapsed, setCollapsed]);
}
