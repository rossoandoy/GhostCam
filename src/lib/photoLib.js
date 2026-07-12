import * as FileSystem from 'expo-file-system/legacy';

const PHOTOS_ROOT = FileSystem.documentDirectory + 'photos/';

function seriesDir(seriesId) {
  return PHOTOS_ROOT + seriesId + '/';
}

async function ensureSeriesDirAsync(seriesId) {
  const dir = seriesDir(seriesId);
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
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

export async function listSeriesPhotos(seriesId) {
  const dir = await ensureSeriesDirAsync(seriesId);
  const entries = await FileSystem.readDirectoryAsync(dir);
  const filenames = entries.filter(name => name.endsWith('.jpg')).sort().reverse();

  return filenames.map(filename => ({
    uri: dir + filename,
    filename,
    capturedAt: timestampFromFilename(filename),
  }));
}

export async function getLatestSeriesPhoto(seriesId) {
  const photos = await listSeriesPhotos(seriesId);
  return photos.length > 0 ? photos[0] : null;
}

export async function saveCameraPhoto(seriesId, tempUri) {
  const dir = await ensureSeriesDirAsync(seriesId);
  const filename = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`;
  const uri = dir + filename;

  await FileSystem.moveAsync({ from: tempUri, to: uri });

  return { uri, filename, capturedAt: timestampFromFilename(filename) };
}

export async function deletePhoto(uri) {
  await FileSystem.deleteAsync(uri, { idempotent: true });
}
