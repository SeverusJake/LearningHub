import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const AppStateContext = createContext(null);

function usePersisted(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue];
}

export const PROGRESS_STEPS = ['todo', 'doing', 'done'];

export function AppStateProvider({ children }) {
  // progress: { [missionId]: 'todo' | 'doing' | 'done' }
  const [progress, setProgress] = usePersisted('atelier.progress', {});
  // stars: { [missionId]: true }
  const [stars, setStars] = usePersisted('atelier.stars', {});
  // recent: [{ id, tab, ts }] — most recent first
  const [recent, setRecent] = usePersisted('atelier.recent', []);
  // checks: { [docId]: { [checkboxIndex]: true } }
  const [checks, setChecks] = usePersisted('atelier.checks', {});

  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  const toast = useCallback((message) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, message, leaving: false }]);
    // Begin the exit animation just before removal so it slides out.
    setTimeout(() => {
      setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    }, 3000);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3260);
  }, []);

  const toggleStar = useCallback(
    (missionId) => {
      setStars((s) => {
        const next = { ...s };
        if (next[missionId]) delete next[missionId];
        else next[missionId] = true;
        return next;
      });
    },
    [setStars],
  );

  const cycleProgress = useCallback(
    (missionId) => {
      setProgress((p) => {
        const cur = p[missionId] ?? 'todo';
        const next = PROGRESS_STEPS[(PROGRESS_STEPS.indexOf(cur) + 1) % PROGRESS_STEPS.length];
        return { ...p, [missionId]: next };
      });
    },
    [setProgress],
  );

  const recordVisit = useCallback(
    (id, tab) => {
      setRecent((r) => {
        const rest = r.filter((x) => x.id !== id);
        return [{ id, tab, ts: Date.now() }, ...rest].slice(0, 10);
      });
    },
    [setRecent],
  );

  const toggleCheck = useCallback(
    (docId, index) => {
      setChecks((c) => {
        const doc = { ...(c[docId] ?? {}) };
        if (doc[index]) delete doc[index];
        else doc[index] = true;
        return { ...c, [docId]: doc };
      });
    },
    [setChecks],
  );

  const resetData = useCallback(() => {
    setProgress({});
    setStars({});
    setRecent([]);
    setChecks({});
  }, [setProgress, setStars, setRecent, setChecks]);

  return (
    <AppStateContext.Provider
      value={{
        progress,
        stars,
        recent,
        checks,
        toasts,
        toast,
        toggleStar,
        cycleProgress,
        recordVisit,
        toggleCheck,
        resetData,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  return useContext(AppStateContext);
}
