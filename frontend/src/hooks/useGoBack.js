import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Returns a handler that navigates to the previous page in history (-1),
 * or to a fallback route when there is no in-app history to go back to.
 */
export function useGoBack(fallback = '/') {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(() => {
    if (location.key !== 'default') {
      navigate(-1);
      return;
    }

    navigate(fallback);
  }, [navigate, location.key, fallback]);
}
