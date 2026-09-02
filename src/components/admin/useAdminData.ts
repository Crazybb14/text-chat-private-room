import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Loads admin data once (and on an interval when refreshMs is set).
 * Never throws — failures surface as an error string.
 */
export function useAdminData<T>(loader: () => Promise<T>, refreshMs = 0) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const load = useCallback(async () => {
    try {
      const next = await loaderRef.current();
      setData(next);
      setError(null);
    } catch {
      setError("Couldn't load this right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    if (!refreshMs) return;
    const timer = setInterval(load, refreshMs);
    return () => clearInterval(timer);
  }, [load, refreshMs]);

  return { data, loading, error, refresh: load };
}
