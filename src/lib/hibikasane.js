// ヒビカサネ: シリーズの写真から時系列の比較画像を生成・保存する機能の
// 選択ロジックと永続化。UI は components/HibikasaneModal.js。
// 生成画像は hibikasane/<seriesId>/ に保存し、撮影写真 (photos/) とは
// 分離する（ゴースト機能・写真ギャラリーに影響させない）。

import { File, Directory, Paths } from 'expo-file-system';
import { timestampFromFilename, formatCapturedDate } from './photoLib';

const HIBIKASANE_DIR_NAME = 'hibikasane';
const DEFAULT_MAX_COUNT = 4;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 新しい順の写真配列から、古い順に等間隔で最大 maxCount 枚を選ぶ。
 * 先頭（最古）と末尾（最新）は必ず含まれる。
 */
export function pickTimelinePhotos(photosNewestFirst, maxCount = DEFAULT_MAX_COUNT) {
  const chrono = [...(photosNewestFirst || [])].reverse();
  const total = chrono.length;
  const n = Math.min(maxCount, total);

  if (n <= 0) {
    return [];
  }
  if (n === total) {
    return chrono;
  }
  if (n === 1) {
    // Degenerate maxCount: show the latest photo (division below needs n >= 2).
    return [chrono[total - 1]];
  }

  const picked = [];
  for (let i = 0; i < n; i++) {
    const index = Math.round((i * (total - 1)) / (n - 1));
    const photo = chrono[index];
    if (picked[picked.length - 1] !== photo) {
      picked.push(photo);
    }
  }
  return picked;
}

/**
 * 「2026/07/01 〜 2026/10/12・103日間のきろく」のような期間ラベルを返す。
 * 日付が取れない場合や1枚のみの場合は空文字。
 */
export function timelineRangeLabel(pickedChrono) {
  if (!pickedChrono || pickedChrono.length < 2) {
    return '';
  }
  const first = pickedChrono[0].capturedAt;
  const last = pickedChrono[pickedChrono.length - 1].capturedAt;
  if (first === null || first === undefined || last === null || last === undefined) {
    return '';
  }

  const range = `${formatCapturedDate(first)} 〜 ${formatCapturedDate(last)}`;
  const days = Math.floor((last - first) / DAY_MS) + 1;
  return days >= 2 ? `${range}・${days}日間のきろく` : range;
}

function ensureFileUri(uri) {
  // react-native-view-shot (iOS) returns a plain absolute path.
  return uri.startsWith('file://') ? uri : `file://${uri}`;
}

function hibikasaneDir(seriesId) {
  return new Directory(Paths.document, HIBIKASANE_DIR_NAME, seriesId);
}

async function ensureHibikasaneDirAsync(seriesId) {
  const dir = hibikasaneDir(seriesId);
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
  return dir;
}

/** 保存済みヒビカサネの一覧（新しい順）。Photo と同じ形を返す。 */
export async function listHibikasane(seriesId) {
  const dir = await ensureHibikasaneDirAsync(seriesId);

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

/** 生成済みの一時画像をシリーズのヒビカサネ置き場へ移動して保存する。 */
export async function saveHibikasaneImage(seriesId, tmpUri) {
  const dir = await ensureHibikasaneDirAsync(seriesId);
  const filename = `hibikasane_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`;

  const file = new File(ensureFileUri(tmpUri));
  file.move(new File(dir, filename));

  return { uri: file.uri, filename, capturedAt: timestampFromFilename(filename) };
}
