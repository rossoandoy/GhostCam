# 引き継ぎ: ヒビカメ App Store 公開（2026-07-10 時点）

読み手: このプロジェクトを引き継ぐ AI エージェント（Opus / Sonnet / codex）と本人。
進め方は `RELEASE_PLAYBOOK.md`、規約は `CLAUDE.md` を参照。

## やったこと（すべて push 済み）

- 公開計画を策定し codex レビュー済み（指摘7件反映）。方針: iOS 先行 / 表示名ヒビカメ / Bundle ID `com.rossoandoy.ghostcam`
- git/GitHub 初期化: 空 repo だった github.com/rossoandoy/GhostCam に main を push（6f1c4f6）
- **[P0] SDK 55 で中核機能が全滅するバグを修正**: `expo-file-system/legacy` import に変更（b1816f4）。lint クリーン・`node --check` パス。**実機未確認**
- 審査対策実装（b1816f4）: エラー Alert / 権限拒否時の「設定を開く」/ SafeArea / useFocusEffect / 写真ビューア（共有・削除）/ ゴースト透明度切替 15・30・50% / アプリ内プラポリリンク — Guideline 4.2・5.1.1 対策
- ビルド構成: `eas.json`（development/preview/production）+ `expo-dev-client` 追加
- ストア文書: `docs/index.md`（プラポリ日英+サポート）、`docs/store-metadata.md`（説明文・キーワード・英語審査ノート・App Privacy 根拠）
- ESLint（flat config）導入、README 追加（6d593bd）
- 上記実装は codex レビュー済み（URI キャプチャ・deleteAsync idempotent・Linking catch 等の指摘を反映済み）
- **2026-07-10（Apple 承認後のビルド前検証、すべて push 済み）**:
  - expo-doctor 19/19 パス化: SDK 55 要求バージョンへ依存整合 + **`react-native-gesture-handler` 追加**（@react-navigation/stack の必須 peer。未導入だと dev/production build で起動クラッシュの恐れがあった）（fc14f9b）
  - **CameraView の children を絶対配置の兄弟要素へ移動**（expo-camera が公式に「非サポート・クラッシュしうる」と警告するパターンだった）。pointerEvents 透過、コンテナスタイル分離、GestureHandlerRootView 追加（03c9375）。Sonnet フレッシュ監査 + codex レビュー済み
  - `npx expo export --platform ios` でバンドルコンパイル成功を確認（実機は未確認のまま）

## 変更ファイル

- `src/screens/CameraScreen.js` / `GalleryScreen.js` — legacy import + 上記全機能
- `App.js` — SafeAreaProvider 追加
- `app.json` — 表示名ヒビカメ / bundleIdentifier / buildNumber:"1" / supportsTablet:false / android.package
- `package.json` — name:ghostcam、expo-dev-client / eslint 系追加、lint script
- 新規: `eas.json` / `eslint.config.js` / `docs/index.md` / `docs/store-metadata.md` / `README.md` / `CLAUDE.md` / `RELEASE_PLAYBOOK.md` / 本ファイル

## 未完了・注意点

- **Apple Developer Program: 承認済み**（2026-07-10）。コード側のビルド前検証も完了し、フェーズ3のブロッカーは Expo ログインのみ
- `eas login` / `eas init` は完了（2026-07-11、projectId: 3c29766c… / owner: rossoando が app.json に反映済み）
- eas init 時に `android.permissions` へ `RECORD_AUDIO` が自動追加された。本アプリは動画撮影しないため **Android 公開時（フェーズ7）に `blockedPermissions` で除外するか要検討**（Data safety 申告に影響。iOS には無関係）
- GitHub Pages 公開済み（https://rossoandoy.github.io/GhostCam/ が 200、2026-07-11 確認）
- 連絡先メールは専用アドレス **hibicam.app@gmail.com** に置換済み（フェーズ4は完全クローズ）
- dev build 完了・実機インストール済み。iOS のデベロッパモード有効化を案内済み（設定 → プライバシーとセキュリティ → デベロッパモード ON → 再起動）。**実機 E2E は未実施**
- 全コードは**実機未確認**（Expo Go SDK 55 iOS 版が無いため確認手段がまだ無い）。特にゴーストとプレビューのアスペクト比一致はフェーズ3 E2E の最重要確認項目
- eas.json に submit セクションは意図的に無い（ASC アプリ作成後に ascAppId 付きで追加する。プレイブック フェーズ5参照）
- ASC で「ヒビカメ」の名称空きは未確認

## 次のアクション

1. 🧑 iPhone のデベロッパモードを ON → dev build を起動 → **プレイブック フェーズ3の実機 E2E チェックリスト**（最重要: ゴーストとプレビューのアスペクト比一致）→ 結果を AI に報告
2. 🧑 E2E パス後、同ビルドでスクリーンショット撮影（3〜5枚）
3. フェーズ5（ASC アプリ作成 → production build → EAS Submit → TestFlight）→ フェーズ6（審査提出）をプレイブック通りに
4. E2E で問題が出たら AI が修正タスク化（アスペクト比ズレは expo-image-manipulator crop カード）

---

## 次エージェント向け初回プロンプト（コピペ用）

```
ヒビカメ（GhostCam）の App Store 公開プロジェクトの続きをお願いします。
まず CLAUDE.md / HANDOFF.md / RELEASE_PLAYBOOK.md を読んでください。
現在の状況: <Apple 承認が下りた / まだ 等を記入>
HANDOFF.md の「次のアクション」から現在のフェーズを特定し、プレイブックの該当セクションに従って進めてください。
実装はサブエージェント委任可・コミット前に npm run lint と codex レビュー（CLAUDE.md のコマンド）を必ず通すこと。
人間タスク（🧑）は実行せず、コマンドと手順の提示までにとどめてください。
作業後は HANDOFF.md の「やったこと」「次のアクション」を更新して commit / push してください。
```
