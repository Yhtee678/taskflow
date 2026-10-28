import { createContext, useContext, useEffect, useRef, useState } from 'react';
// Focus synchronization is separate from explicit invalidation and resource keys.
export const BackgroundRefreshContext = createContext(0);
export interface Remote<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}
export function useRemote<T>(key: string, load: () => Promise<T>): Remote<T> {
  const backgroundRefresh = useContext(BackgroundRefreshContext);
  const latest = useRef(load);
  latest.current = load;
  const [state, setState] = useState<Remote<T> & { key: string }>({
    key: '',
    data: null,
    error: null,
    loading: true,
  });
  useEffect(() => {
    let active = true;
    setState((previous) => ({
      key,
      data: previous.key === key ? previous.data : null,
      error: null,
      loading: previous.key !== key || previous.data === null,
    }));
    void latest
      .current()
      .then((data) => {
        if (active) setState({ key, data, error: null, loading: false });
      })
      .catch((error) => {
        if (active)
          setState({
            key,
            data: null,
            error:
              error instanceof Error
                ? error
                : new Error('Unable to load data.'),
            loading: false,
          });
      });
    return () => {
      active = false;
    };
  }, [key, backgroundRefresh]);
  return state.key === key ? state : { data: null, error: null, loading: true };
}
