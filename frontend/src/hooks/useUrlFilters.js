import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Keeps a flat set of filter values (search text, department, access group,
 * pagination, etc.) mirrored into the URL query string, so filters survive
 * navigating away (e.g. into a user's profile) and back, and can be
 * bookmarked/shared as-is.
 *
 * `schema` maps each filter key to its "empty"/default value. A value that
 * equals its default is omitted from the URL entirely, so existing links
 * without any filter params keep working exactly as before.
 *
 * Reads/writes go through `replace` navigation so adjusting filters never
 * spams browser history — only the single most recent filter state is kept
 * as the current entry, which is what Back should return you to.
 *
 * Usage:
 *   const [urlFilters, setUrlFilters] = useUrlFilters({ q: '', department: 'all' });
 *   // urlFilters.q / urlFilters.department reflect the current URL (or defaults)
 *   // setUrlFilters({ q: 'jane' }) merges and updates the URL in place
 */
export function useUrlFilters(schema) {
  const [searchParams, setSearchParams] = useSearchParams();

  const values = useMemo(() => {
    const result = {};
    for (const key of Object.keys(schema)) {
      const raw = searchParams.get(key);
      result[key] = raw === null || raw === '' ? schema[key] : raw;
    }
    return result;
  }, [searchParams, schema]);

  const setUrlFilters = useCallback((patch) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const entries = typeof patch === 'function' ? patch(values) : patch;
      for (const [key, value] of Object.entries(entries || {})) {
        const isDefault = value === undefined || value === null || String(value) === String(schema[key]);
        if (isDefault) {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      }
      return next;
    }, { replace: true });
  }, [setSearchParams, schema, values]);

  return [values, setUrlFilters];
}
