# ヒビカメ (HibiCam) プロジェクト規約

定点観測カメラアプリ（Expo SDK 55 / Managed Workflow）の iOS App Store 公開プロジェクト。
**まず `HANDOFF.md`（現状）と `RELEASE_PLAYBOOK.md`（残作業の完全手順書）を読むこと。**
**v1.0 提出後の継続開発は `DEVELOPMENT.md` の GitHub フロー（Issue → ブランチ → PR → AI フレッシュレビュー → squash merge）に従う。main へ直接 push しない。**

## 絶対に守ること

- **`expo-file-system` は新 API（`File` / `Directory` / `Paths`）を使う**（v1.1 で移行済み）。`expo-file-system/legacy` を新規に import しない。レガシー API（`documentDirectory` / `getInfoAsync` 等）を通常 import から呼ぶと実行時に throw する。新 API の注意: **インスタンスは `move()` で `uri` が書き換わる**ため使い回さず、操作ごとに `new File(...)` を作り直すこと
- Bundle ID / Android package は `com.rossoandoy.ghostcam` で確定済み・**変更禁止**（ストア提出後は変更不可）
- `docs/` は GitHub Pages で**一般公開されるページ**。内部メモ・引き継ぎ資料を置かない（それらはリポジトリ直下へ）
- 要件書 `GhostCam_REQUIREMENTS.md` の禁止事項を守る: ログイン/クラウド/編集・フィルター/アルバム分け/複雑な設定画面は実装しない
- iOS 実機確認は **development build 前提**（Expo Go の SDK 55 iOS 版は未公開）。`npx expo start --dev-client`

## 開発プロセス

- 実装完了後、merge 前に **AI フレッシュレビュー**を実施する: 実装に関与していない別エージェント（Sonnet サブエージェント等）に diff と設計意図を渡してレビューさせ、結果を PR コメントに残す。重要な設計判断は実装前にもレビューを通す
  （旧プロセスの codex レビューは 2026-10 の契約終了につき**廃止**。`codex` コマンドは使わない）
- コミット前に `npm run lint` を必ず通す（ESLint flat config 導入済み）
- コミットメッセージは日本語。作業完了時は commit / push まで行う
- まとまった実装タスクはサブエージェント（Sonnet）に委任して良い。その場合 **git commit はサブエージェントにさせず**、フレッシュレビュー後に親セッションが行う
- 人間（アンドウさん）にしかできない作業: Apple/ASC 操作、対話式 `eas` コマンド、実機テスト、審査提出、GitHub Pages 設定。AI はコマンド準備と検証まで

## リリース運用

- ビルド: `eas.json`（development / preview / production、`appVersionSource: "remote"` + `autoIncrement` なのでローカルの buildNumber は増やさない）
- ストア文言・審査ノート: `docs/store-metadata.md`（審査ノートは英語）
- プラポリ: `docs/index.md`（GitHub Pages: https://rossoandoy.github.io/GhostCam/）
