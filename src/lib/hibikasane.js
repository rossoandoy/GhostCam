// ヒビカサネ: シリーズの写真から時系列の比較画像を1タップ生成するための
// 写真選択ロジック。UI は components/HibikasaneModal.js。

const DEFAULT_MAX_COUNT = 4;

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
