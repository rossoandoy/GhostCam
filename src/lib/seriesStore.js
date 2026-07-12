import * as FileSystem from 'expo-file-system/legacy';

const STORE_PATH = FileSystem.documentDirectory + 'series.json';
const STORE_BAK_PATH = STORE_PATH + '.bak';
const PHOTOS_ROOT = FileSystem.documentDirectory + 'photos/';
const DEFAULT_SERIES_NAME = 'マイシリーズ';
const MAX_TEXT_LENGTH = 30;
const SERIES_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function generateSeriesId() {
  return 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function cleanText(value) {
  return (value === null || value === undefined ? '' : String(value))
    .replace(/[\r\n]+/g, '')
    .trim();
}

export function sanitizeName(str) {
  const cleaned = cleanText(str).slice(0, MAX_TEXT_LENGTH);
  return cleaned || DEFAULT_SERIES_NAME;
}

export function sanitizeLabel(str) {
  return cleanText(str).slice(0, MAX_TEXT_LENGTH);
}

function createDefaultSeriesEntry() {
  const now = Date.now();
  return {
    id: generateSeriesId(),
    name: DEFAULT_SERIES_NAME,
    locationLabel: '',
    createdAt: now,
    updatedAt: now,
  };
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeSeriesEntry(item) {
  if (
    !isPlainObject(item) ||
    typeof item.id !== 'string' ||
    !SERIES_ID_PATTERN.test(item.id)
  ) {
    return null;
  }

  const now = Date.now();
  return {
    id: item.id,
    name: sanitizeName(item.name),
    locationLabel: sanitizeLabel(item.locationLabel),
    createdAt: typeof item.createdAt === 'number' ? item.createdAt : now,
    updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : now,
  };
}

// Normalizes `raw` and also reports whether the input needed repair, so
// callers can decide to persist the repaired result (see loadStoreAsync).
function normalizeStoreWithMeta(raw) {
  const source = isPlainObject(raw) ? raw : {};
  let repaired = !isPlainObject(raw);

  const rawSeriesArray = Array.isArray(source.series) ? source.series : null;
  if (!rawSeriesArray) {
    repaired = true;
  }

  let series = rawSeriesArray
    ? rawSeriesArray.map(normalizeSeriesEntry).filter(Boolean)
    : [];
  if (rawSeriesArray && series.length !== rawSeriesArray.length) {
    repaired = true;
  }

  if (series.length === 0) {
    series = [createDefaultSeriesEntry()];
    repaired = true;
  }

  let activeSeriesId =
    typeof source.activeSeriesId === 'string' ? source.activeSeriesId : null;
  if (!activeSeriesId || !series.some(item => item.id === activeSeriesId)) {
    activeSeriesId = series[0].id;
    repaired = true;
  }

  if (typeof source.onboardingCompleted !== 'boolean') {
    repaired = true;
  }
  if (source.legacyPhotosMigratedAt !== null && typeof source.legacyPhotosMigratedAt !== 'number') {
    repaired = true;
  }
  if (source.schemaVersion !== 1) {
    repaired = true;
  }

  const store = {
    schemaVersion: 1,
    onboardingCompleted: source.onboardingCompleted === true,
    activeSeriesId,
    legacyPhotosMigratedAt:
      typeof source.legacyPhotosMigratedAt === 'number' ? source.legacyPhotosMigratedAt : null,
    series,
  };

  return { store, repaired };
}

export function normalizeStore(raw) {
  return normalizeStoreWithMeta(raw).store;
}

export async function saveStoreAsync(store) {
  const tmpPath = `${STORE_PATH}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  await FileSystem.writeAsStringAsync(tmpPath, JSON.stringify(normalizeStore(store)));

  const current = await FileSystem.getInfoAsync(STORE_PATH);
  if (current.exists) {
    await FileSystem.deleteAsync(STORE_BAK_PATH, { idempotent: true });
    await FileSystem.moveAsync({ from: STORE_PATH, to: STORE_BAK_PATH });
  }

  try {
    await FileSystem.moveAsync({ from: tmpPath, to: STORE_PATH });
    await FileSystem.deleteAsync(STORE_BAK_PATH, { idempotent: true });
  } catch (error) {
    // Restore the previous store so a failed swap never leaves us without
    // a readable series.json (which would look like data loss on next launch).
    const bak = await FileSystem.getInfoAsync(STORE_BAK_PATH);
    if (bak.exists) {
      await FileSystem.moveAsync({ from: STORE_BAK_PATH, to: STORE_PATH });
    }
    throw error;
  } finally {
    await FileSystem.deleteAsync(tmpPath, { idempotent: true }).catch(() => {});
  }
}

export async function loadStoreAsync() {
  try {
    const raw = await FileSystem.readAsStringAsync(STORE_PATH);
    const parsed = JSON.parse(raw);
    const { store, repaired } = normalizeStoreWithMeta(parsed);
    if (repaired) {
      // Persist the repair immediately; otherwise a valid-but-corrupt store
      // would regenerate a fresh default series (new id) on every launch,
      // orphaning any photos already saved under the previous id.
      await saveStoreAsync(store).catch(error => {
        console.warn('[seriesStore] Failed to persist repaired store:', error);
      });
    }
    return store;
  } catch (error) {
    console.warn('[seriesStore] Failed to load store, initializing default:', error);
    const store = normalizeStore({});
    await saveStoreAsync(store);
    return store;
  }
}

export async function migrateLegacyPhotosAsync(store, targetSeriesId) {
  try {
    const rootInfo = await FileSystem.getInfoAsync(PHOTOS_ROOT);
    if (!rootInfo.exists) {
      return { ...store, legacyPhotosMigratedAt: Date.now() };
    }

    const entries = await FileSystem.readDirectoryAsync(PHOTOS_ROOT);
    const legacyJpgs = entries.filter(name => name.endsWith('.jpg'));

    if (legacyJpgs.length === 0) {
      return { ...store, legacyPhotosMigratedAt: Date.now() };
    }

    const targetDir = PHOTOS_ROOT + targetSeriesId + '/';
    const targetDirInfo = await FileSystem.getInfoAsync(targetDir);
    if (!targetDirInfo.exists) {
      await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });
    }

    for (const filename of legacyJpgs) {
      await FileSystem.moveAsync({
        from: PHOTOS_ROOT + filename,
        to: targetDir + filename,
      });
    }

    return { ...store, legacyPhotosMigratedAt: Date.now() };
  } catch (error) {
    console.warn('[seriesStore] Failed to migrate legacy photos:', error);
    return store;
  }
}
