# 引き継ぎ: ヒビカメ App Store 公開（2026-07-13 時点）

読み手: このプロジェクトを引き継ぐ AI エージェントと本人。
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
- **2026-07-11〜12**: dev build を実機で起動し MVP の動作確認済み。GitHub Pages 公開 + 連絡先メール（hibicam.app@gmail.com）反映完了
- **2026-10-08〜09**: 検証端末に iPhone 17（無印・6.3インチ）を追加。`eas device:create` で UDID 登録（`00008150-00163C580C83C01C`）→ 登録前に走らせた dev build のプロファイルに UDID が入らず「整合性を確認できなかった」エラー → `eas build:resign` で再署名して解決・インストール済み。ストア用スクショは [openscrgen.app](https://openscrgen.app/) で合成する方式に変更済み（`store-assets/README.md` 参照。iPhone 17 実機スクショ 1206×2622 を素材にする）
- **2026-07-13（v1.0 スコープ拡張、dd62b15 で push 済み）**: ユーザー要望により初回提出前に**シリーズ機能**（複数の定点観測を並行運用、series.json + photos/<seriesId>/、切替チップ・Picker/Form モーダル・前回撮影日時と場所ラベルのオーバーレイ表示）と**初回オンボーディング**（1枚・シリーズ名入力・完了後に権限リクエスト）を追加。Plan 設計 → codex 計画レビュー → Sonnet 3並列実装 → codex 実装レビュー（重大2件含む7件）→ 修正反映まで完了。lint / expo export 検証済み。**新機能の実機 E2E は未実施**。Android 布石として recordAudioAndroid:false + RECORD_AUDIO 除去も実施

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

## 現在の状態: 🟡 再審査待ち（2026-10-13 再提出完了）

- **1.0.0 (build 3) を再提出済み**（コミット 8d64f49 = マイク文言除去 #9 + ヒビカサネ #3 + ビューア日時 #2 + 新アイコン #10 + fs移行 #1 を同梱）
- 承認されたら: ASC で「このバージョンをリリース」を押した時点で App Store 公開（手動リリース設定）
- 公開後のタスク: #4（ストアURL反映・git tag v1.0・HANDOFF更新）
- 別の指摘が来たら通知全文を AI に貼る

## 旧状態メモ: 🟠 リジェクト対応済み・再提出待ち（2026-10-13）

- **2026-10-13 リジェクト**（自動チェック）: NSMicrophoneUsageDescription がプレースホルダー判定 → expo-camera プラグインに `microphonePermission: false` を設定しキー自体を除去（#9、introspect で検証済み）
- 再提出ビルドには v1.1/v1.2 機能も同梱される: file-system 新 API（#1）/ ビューア日時表示（#2）/ **ヒビカサネ**（#3・テンプレ3種選択式）/ 新アイコン（#10）
- 🧑 残作業: main で `eas build --profile production` → `eas submit --latest` → ASC でリジェクトされた提出のビルドを 1.0.0 (3) に差し替えて再提出（審査ノートに追記文あり: docs/store-metadata.md 末尾）

## 旧状態メモ: 🟡 審査待ち（2026-10-11 20:32 提出 → 10-13 リジェクト）

- **1.0.0 (build 2) を App Review に提出済み**（提出ID: 3b0afce8-5583-4055-bda1-9d42b06a155c）
- リリース方式は**手動リリース**: 承認後に ASC で「このバージョンをリリース」を押した時点で公開される
- 審査結果はメール + ASC 通知で届く。**リジェクト時は通知文をそのまま AI に貼る**（対応カードは RELEASE_PLAYBOOK.md）
- 審査待ち中の AI 作業候補: v1.1 ブランチで expo-file-system 新 API 移行（プレイブックの v1.1 カード）
- 補足: ASC の新 UI ではスクショ枠が「中型ディスプレイ」= 1206×2622 に変更されていた（`store-assets/out/medium/` に配置済み）。審査ノートは 4000 字制限のため 3,189 字に短縮済み

## 次のアクション（参考: 提出まで＝完了済み）

完了済み: ストア画像5枚（`store-assets/out/`、1320×2868、ユーザー承認待ちだが生成済み）/ ASC アプリ作成済み（**ヒビカメ / Apple ID: 6821589320**）/ eas.json に submit 設定追加済み / ギャラリーのプライバシーリンク折り返しバグ修正済み（コミット済み・実機未確認）

1. 🧑 `npx eas-cli build --platform ios --profile production`（外のターミナルで）
2. 🧑 `npx eas-cli submit --platform ios --profile production --latest`
3. 🧑 TestFlight 内部テストで最終 E2E（**提出前必須ゲート**）: オンボーディング→撮影→ゴースト+情報行→シリーズ作成/切替/編集→ギャラリー（プライバシーリンクが1行表示か確認）→共有/削除→再起動で状態維持→アスペクト比一致
4. 🧑 メタデータ入力（`docs/store-metadata.md` からコピペ + スクショ5枚アップロード + EU トレーダーステータス申告は「トレーダーではない」）→ フェーズ6（Add for Review → Submit for Review）
5. E2E で問題が出たら AI が修正タスク化

---

## 次エージェント向け初回プロンプト（コピペ用）

```
ヒビカメ（GhostCam）の App Store 公開プロジェクトの続きをお願いします。
まず CLAUDE.md / HANDOFF.md / RELEASE_PLAYBOOK.md を読んでください。
現在の状況: <Apple 承認が下りた / まだ 等を記入>
HANDOFF.md の「次のアクション」から現在のフェーズを特定し、プレイブックの該当セクションに従って進めてください。
実装はサブエージェント委任可・コミット前に npm run lint、merge 前に AI フレッシュレビュー（CLAUDE.md 参照）を必ず通すこと。
人間タスク（🧑）は実行せず、コマンドと手順の提示までにとどめてください。
作業後は HANDOFF.md の「やったこと」「次のアクション」を更新して commit / push してください。
```
