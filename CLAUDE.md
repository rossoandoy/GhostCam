# ヒビカメ (HibiCam) プロジェクト規約

定点観測カメラアプリ（Expo SDK 55 / Managed Workflow）の iOS App Store 公開プロジェクト。
**まず `HANDOFF.md`（現状）と `RELEASE_PLAYBOOK.md`（残作業の完全手順書）を読むこと。**

## 絶対に守ること

- **`expo-file-system` は必ず `expo-file-system/legacy` から import する**。SDK 55 ではレガシー API（`documentDirectory` / `getInfoAsync` 等）を通常 import で呼ぶと実行時に throw する（アプリの中核機能が全滅する）
- Bundle ID / Android package は `com.rossoandoy.ghostcam` で確定済み・**変更禁止**（ストア提出後は変更不可）
- `docs/` は GitHub Pages で**一般公開されるページ**。内部メモ・引き継ぎ資料を置かない（それらはリポジトリ直下へ）
- 要件書 `GhostCam_REQUIREMENTS.md` の禁止事項を守る: ログイン/クラウド/編集・フィルター/アルバム分け/複雑な設定画面は実装しない
- iOS 実機確認は **development build 前提**（Expo Go の SDK 55 iOS 版は未公開）。`npx expo start --dev-client`

## 開発プロセス

- 実装計画の確定前・実装完了後に **codex レビュー**を実施する:
  ```bash
  codex exec --sandbox read-only --cd "$PWD" "<レビュー依頼>

  確認や質問は不要です。具体的な提案・修正案・コード例まで自主的に出力してください。"
  ```
  （末尾の指示文は省略しない。出力が大きい場合は保存ファイルの末尾 = 最終回答を読む）
- コミット前に `npm run lint` を必ず通す（ESLint flat config 導入済み）
- コミットメッセージは日本語。作業完了時は commit / push まで行う
- まとまった実装タスクはサブエージェント（Sonnet）に委任して良い。その場合 **git commit はサブエージェントにさせず**、codex レビュー後に親セッションが行う
- 人間（アンドウさん）にしかできない作業: Apple/ASC 操作、対話式 `eas` コマンド、実機テスト、審査提出、GitHub Pages 設定。AI はコマンド準備と検証まで

## リリース運用

- ビルド: `eas.json`（development / preview / production、`appVersionSource: "remote"` + `autoIncrement` なのでローカルの buildNumber は増やさない）
- ストア文言・審査ノート: `docs/store-metadata.md`（審査ノートは英語）
- プラポリ: `docs/index.md`（GitHub Pages: https://rossoandoy.github.io/GhostCam/）
