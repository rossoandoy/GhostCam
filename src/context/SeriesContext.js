import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  generateSeriesId,
  loadStoreAsync,
  migrateLegacyPhotosAsync,
  normalizeStore,
  sanitizeLabel,
  sanitizeName,
  saveStoreAsync,
} from '../lib/seriesStore';

const SeriesContext = createContext(null);

export function SeriesProvider({ children }) {
  const [status, setStatus] = useState('loading');
  const [store, setStore] = useState(null);
  const storeRef = useRef(null);
  const mutationQueueRef = useRef(Promise.resolve());
  const migrationAttemptedRef = useRef(false);

  useEffect(() => {
    storeRef.current = store;
  }, [store]);

  useEffect(() => {
    let isMounted = true;

    loadStoreAsync().then(loadedStore => {
      if (!isMounted) return;
      storeRef.current = loadedStore;
      setStore(loadedStore);
      setStatus('ready');
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Serializes all store mutations so a slow/failed save can never be
  // clobbered by a later mutation reading a stale closure of `store`.
  // Failures propagate to the caller instead of being swallowed.
  const mutateStore = useCallback(updater => {
    const run = mutationQueueRef.current.then(async () => {
      const base = storeRef.current;
      const next = normalizeStore(await updater(base));
      await saveStoreAsync(next);
      storeRef.current = next;
      setStore(next);
      return next;
    });
    mutationQueueRef.current = run.catch(() => {});
    return run;
  }, []);

  // Legacy (pre-series) photos live outside any series folder. Retry the
  // migration on every launch until it succeeds, independent of onboarding,
  // so a failed attempt never strands photos permanently.
  useEffect(() => {
    if (status !== 'ready' || !store || migrationAttemptedRef.current) return;
    if (store.legacyPhotosMigratedAt !== null) return;

    migrationAttemptedRef.current = true;
    mutateStore(current =>
      current.legacyPhotosMigratedAt === null
        ? migrateLegacyPhotosAsync(current, current.activeSeriesId)
        : current
    ).catch(error => {
      console.warn('[SeriesContext] Failed to migrate legacy photos:', error);
    });
  }, [status, store, mutateStore]);

  const setActiveSeries = useCallback(
    id =>
      mutateStore(current => {
        if (!current.series.some(item => item.id === id)) {
          return current;
        }
        return { ...current, activeSeriesId: id };
      }),
    [mutateStore]
  );

  const createSeries = useCallback(
    ({ name, locationLabel } = {}) => {
      const now = Date.now();
      const newSeries = {
        id: generateSeriesId(),
        name: sanitizeName(name),
        locationLabel: sanitizeLabel(locationLabel),
        createdAt: now,
        updatedAt: now,
      };

      return mutateStore(current => ({
        ...current,
        series: [...current.series, newSeries],
        activeSeriesId: newSeries.id,
      })).then(nextStore => nextStore.series.find(item => item.id === newSeries.id) || newSeries);
    },
    [mutateStore]
  );

  const updateSeries = useCallback(
    (id, { name, locationLabel } = {}) =>
      mutateStore(current => ({
        ...current,
        series: current.series.map(item =>
          item.id === id
            ? {
                ...item,
                name: sanitizeName(name),
                locationLabel: sanitizeLabel(locationLabel),
                updatedAt: Date.now(),
              }
            : item
        ),
      })),
    [mutateStore]
  );

  const completeOnboarding = useCallback(
    ({ firstSeriesName } = {}) =>
      mutateStore(current => {
        const activeSeriesId = current.activeSeriesId;
        return {
          ...current,
          series: current.series.map(item =>
            item.id === activeSeriesId
              ? { ...item, name: sanitizeName(firstSeriesName), updatedAt: Date.now() }
              : item
          ),
          onboardingCompleted: true,
        };
      }),
    [mutateStore]
  );

  const value = useMemo(() => {
    const seriesList = store ? store.series : [];
    const activeSeries =
      status === 'ready' && store
        ? seriesList.find(item => item.id === store.activeSeriesId) || seriesList[0] || null
        : null;

    return {
      status,
      onboardingCompleted: store ? store.onboardingCompleted : false,
      seriesList,
      activeSeries,
      setActiveSeries,
      createSeries,
      updateSeries,
      completeOnboarding,
    };
  }, [
    status,
    store,
    setActiveSeries,
    createSeries,
    updateSeries,
    completeOnboarding,
  ]);

  return <SeriesContext.Provider value={value}>{children}</SeriesContext.Provider>;
}

export function useSeries() {
  const context = useContext(SeriesContext);
  if (!context) {
    throw new Error('useSeries must be used within a SeriesProvider');
  }
  return context;
}
