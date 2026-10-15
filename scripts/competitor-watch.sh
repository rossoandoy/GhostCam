#!/usr/bin/env bash
# 競合ウォッチ: iTunes Lookup + カスタマーレビューRSS のスナップショットを
# research/snapshots/YYYY-MM-DD.md に書き出す。
# 使い方: bash scripts/competitor-watch.sh
# 運用は research/competitor-watch.md を参照（月1回、前回スナップショットと diff）。
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="research/snapshots/$(date +%Y-%m-%d).md"
mkdir -p research/snapshots

# trackId|表示名（ウォッチリストの追加・削除はここを編集）
APPS=(
  "6821589320|ヒビカメ（自アプリ）"
  "6673892329|ミクラベ"
  "1434641802|Photo Diary（成長を写真で比較）"
  "1470036060|BAミラー"
  "1115974495|タイムスタンプカメラ"
  "6757739492|kasanete"
  "1595838369|スケルカメラ"
  "980538523|1secCamera"
)

REVIEWS_PER_APP="${REVIEWS_PER_APP:-15}"

{
  echo "# 競合スナップショット $(date +%Y-%m-%d)"
  echo
  echo "生成: \`scripts/competitor-watch.sh\`（iTunes Lookup + レビューRSS, country=jp）"
  echo

  for entry in "${APPS[@]}"; do
    id="${entry%%|*}"
    name="${entry#*|}"
    echo "## ${name} (id: ${id})"
    echo

    curl -s "https://itunes.apple.com/jp/lookup?id=${id}" | python3 -c '
import json, sys
d = json.load(sys.stdin)
if not d.get("results"):
    print("（Lookup 結果なし — ストア未反映 or 取り下げ）")
else:
    r = d["results"][0]
    rating = round(r.get("averageUserRating") or 0, 2)
    count = r.get("userRatingCount", 0)
    version = r.get("version")
    price = r.get("formattedPrice")
    updated = str(r.get("currentVersionReleaseDate") or "")[:10]
    print(f"- バージョン: {version} / 評価: {rating}（{count}件） / 価格: {price}")
    print(f"- 更新日: {updated}")
    notes = (r.get("releaseNotes") or "").replace(chr(10), " ")[:300]
    if notes:
        print(f"- リリースノート: {notes}")
'
    echo

    curl -s "https://itunes.apple.com/jp/rss/customerreviews/id=${id}/sortby=mostrecent/json" | REVIEWS_PER_APP="$REVIEWS_PER_APP" python3 -c '
import json, os, sys
limit = int(os.environ["REVIEWS_PER_APP"])
try:
    d = json.load(sys.stdin)
except Exception:
    print("（レビューRSS 取得不可）")
    sys.exit(0)
entries = d.get("feed", {}).get("entry", [])
if isinstance(entries, dict):
    entries = [entries]
reviews = [e for e in entries if "im:rating" in e]
if not reviews:
    print("（レビューなし）")
    sys.exit(0)
print(f"直近レビュー（全{len(reviews)}件中 最大{limit}件）:")
print()
for e in reviews[:limit]:
    rating = e["im:rating"]["label"]
    title = e["title"]["label"]
    content = e["content"]["label"].replace(chr(10), " ")[:200]
    print(f"- [{rating}★] {title} — {content}")
'
    echo
  done
} > "$OUT"

echo "wrote $OUT"
