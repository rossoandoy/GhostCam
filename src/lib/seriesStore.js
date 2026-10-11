import { File, Directory, Paths } from 'expo-file-system';

const STORE_NAME = 'series.json';
const STORE_BAK_NAME = STORE_NAME + '.bak';
const PHOTOS_DIR_NAME = 'photos';
const DEFAULT_SERIES_NAME = 'マイシリーズ';
const MAX_TEXT_LENGTH = 30;
const SERIES_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

// File/Directory instances mutate their `uri` when moved, so always build a
// fresh instance per operation instead of sharing module-level singletons.
function storeFile() {
  return new File(Paths.document, STORE_NAME);
}

function storeBakFile() {
  return new File(Paths.document, STORE_BAK_NAME);
}

function photosRootDir() {
  return new Directory(Paths.document, PHOTOS_DIR_NAME);
}

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
  const tmpName = `${STORE_NAME}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  const tmp = new File(Paths.document, tmpName);

  try {
    tmp.write(JSON.stringify(normalizeStore(store)));

    const current = storeFile();
    if (current.exists) {
      const bak = storeBakFile();
      if (bak.exists) {
        bak.delete();
      }
      current.move(bak);
    }

    try {
      tmp.move(storeFile());
    } catch (error) {
      // Restore the previous store so a failed swap never leaves us without
      // a readable series.json (which would look like data loss on next launch).
      const bak = storeBakFile();
      if (bak.exists) {
        bak.move(storeFile());
      }
      throw error;
    }

    // The swap succeeded; failing to drop the stale .bak must not fail the
    // save (and must not trigger the restore path above).
    try {
      const bak = storeBakFile();
      if (bak.exists) {
        bak.delete();
      }
    } catch {
      // Best-effort cleanup.
    }
  } finally {
    // `tmp.uri` is rewritten by a successful move, so re-resolve by name
    // before cleaning up — otherwise we would delete the store we just wrote.
    try {
      const leftover = new File(Paths.document, tmpName);
      if (leftover.exists) {
        leftover.delete();
      }
    } catch {
      // Cleanup is best-effort.
    }
  }
}

export async function loadStoreAsync() {
  try {
    const raw = await storeFile().text();
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
    const root = photosRootDir();
    if (!root.exists) {
      return { ...store, legacyPhotosMigratedAt: Date.now() };
    }

    const legacyJpgs = root
      .list()
      .filter(entry => entry instanceof File && entry.name.endsWith('.jpg'));

    if (legacyJpgs.length === 0) {
      return { ...store, legacyPhotosMigratedAt: Date.now() };
    }

    const targetDir = new Directory(root, targetSeriesId);
    if (!targetDir.exists) {
      targetDir.create({ intermediates: true });
    }

    for (const file of legacyJpgs) {
      file.move(targetDir);
    }

    return { ...store, legacyPhotosMigratedAt: Date.now() };
  } catch (error) {
    console.warn('[seriesStore] Failed to migrate legacy photos:', error);
    return store;
  }
}
