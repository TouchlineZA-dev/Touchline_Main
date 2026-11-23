import { DependencyList, useCallback, useEffect, useRef, useState } from 'react';

interface ApiState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  reload: () => void;
}

/** Runs an async loader on mount (and when deps change) and tracks loading / error state. */
export function useApi<T>(loader: () => Promise<T>, deps: DependencyList = []): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const callId = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(loader, deps);

  const reload = useCallback(() => {
    const id = ++callId.current;
    setLoading(true);
    setError(null);
    run()
      .then((result) => {
        if (id === callId.current) setData(result);
      })
      .catch((e) => {
        if (id === callId.current) setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (id === callId.current) setLoading(false);
      });
  }, [run]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, loading, reload };
}
