import { File, Directory, Paths } from 'expo-file-system';

const PHOTOS_DIR_NAME = 'photos';

// Instances mutate their `uri` when moved, so build fresh ones per operation.
function seriesDir(seriesId) {
  return new Directory(Paths.document, PHOTOS_DIR_NAME, seriesId);
}

async function ensureSeriesDirAsync(seriesId) {
  const dir = seriesDir(seriesId);
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
  return dir;
}

export function timestampFromFilename(filename) {
  const parts = (filename || '').split('_');
  if (parts.length < 2) {
    return null;
  }
  const value = parseInt(parts[1], 10);
  return Number.isNaN(value) ? null : value;
}

export function formatCapturedDate(ms) {
  if (ms === null || ms === undefined) {
    return '';
  }

  const date = new Date(ms);
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
}

export function formatCapturedAt(ms) {
  if (ms === null || ms === undefined) {
    return '';
  }

  const date = new Date(ms);
  const pad = n => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());

  return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
}

function startOfLocalDay(ms) {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

// Difference in local calendar days (0 = same day). Rounded so a DST
// shift of +/-1h on either side cannot skew the result.
export function daysBetweenLocal(fromMs, toMs) {
  if (fromMs === null || fromMs === undefined || toMs === null || toMs === undefined) {
    return null;
  }
  return Math.round((startOfLocalDay(toMs) - startOfLocalDay(fromMs)) / 86400000);
}

// Consecutive-day run ending at the newest photo's day.
// `photos` is newest-first, as returned by listSeriesPhotos.
export function computeStreak(photos) {
  const days = [];
  for (const photo of photos) {
    if (photo.capturedAt === null || photo.capturedAt === undefined) continue;
    const day = startOfLocalDay(photo.capturedAt);
    if (days[days.length - 1] !== day) {
      days.push(day);
    }
  }
  if (days.length === 0) {
    return 0;
  }

  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    if (Math.round((days[i - 1] - days[i]) / 86400000) === 1) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

export async function listSeriesPhotos(seriesId) {
  const dir = await ensureSeriesDirAsync(seriesId);

  return dir
    .list()
    .filter(entry => entry instanceof File && entry.name.endsWith('.jpg'))
    .sort((a, b) => (a.name < b.name ? 1 : -1))
    .map(file => ({
      uri: file.uri,
      filename: file.name,
      capturedAt: timestampFromFilename(file.name),
    }));
}

export async function getLatestSeriesPhoto(seriesId) {
  const photos = await listSeriesPhotos(seriesId);
  return photos.length > 0 ? photos[0] : null;
}

export async function saveCameraPhoto(seriesId, tempUri) {
  const dir = await ensureSeriesDirAsync(seriesId);
  const filename = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`;

  const file = new File(tempUri);
  file.move(new File(dir, filename));

  return { uri: file.uri, filename, capturedAt: timestampFromFilename(filename) };
}

export async function deletePhoto(uri) {
  const file = new File(uri);
  if (file.exists) {
    file.delete();
  }
}
