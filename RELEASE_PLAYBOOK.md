# App Store 公開プレイブック（残フェーズ完全手順書）

どの AI モデル・エージェントでも、このファイルだけで残作業の**手順管理と実装**を完遂できるように書いてある。
役割分担: **AI = 手順の管理・コマンド準備・実装・検証、人間（🧑）= Apple/ASC 操作・対話式 eas コマンド・実機テスト・審査提出**。🧑 タスクで止まったら手順を提示して人間の完了報告を待つこと。
現状スナップショットは `HANDOFF.md` を参照。フェーズ0〜2・4（AI 分）は完了済み。

**進め方の原則**: 各フェーズの開始時にこのファイルの該当セクションを読み、終了時に DoD を検証 → `HANDOFF.md` の「次のアクション」を更新 → commit / push。実装を伴う変更は codex レビュー（`CLAUDE.md` のコマンド）を挟んでからコミットする。

---

## フェーズ3: development build + 実機テスト + スクショ

### 前提（人間が完了させる。AI は確認だけ）
- [ ] Apple Developer Program 承認済み（メール受領）
- [ ] `npx eas-cli login` 済み（`npx eas-cli whoami` で確認）
- [ ] `npx eas-cli init` 済み → app.json に `extra.eas.projectId` が入る。**入ったら commit すること**

### 手順
1. 🧑 実機登録: `npx eas-cli device:create`（表示される URL を iPhone で開いてプロファイルをインストール）
2. 🧑 ビルド: `npx eas-cli build --profile development --platform ios`
   - 初回は Apple アカウント連携・証明書/Provisioning 自動生成の対話あり → すべて EAS 任せ（デフォルト）で良い
   - AI: ビルドログで Xcode バージョンを確認（SDK 55 は Xcode 26.2+ が必要。ASC へのアップロードは 2026/4/28 以降 Xcode 26+ / iOS 26 SDK ビルドが必須。満たさない場合は eas.json の該当プロファイルに `"image"` 指定を追加して対応）
   - 無料枠は iOS 15 ビルド/月。本計画の残り消費は 2〜3 ビルドの想定
3. 🧑 ビルド完了 → QR で実機インストール → `npx expo start --dev-client` で接続
4. 🧑 実機 E2E チェックリスト（全項目パスが DoD）:
   - [ ] 初回起動で権限ダイアログ → 許可 → カメラプレビュー表示
   - [ ] 撮影 → ギャラリーに写真が出る → カメラに戻るとゴーストが重なって見える
   - [ ] 透明度ボタンで 15/30/50% が巡回し、表示が変わる
   - [ ] **ゴーストとプレビューのズレ確認**: 同じ被写体を動かさず2枚撮り、ゴーストと実景が一致すること（ズレたら下の「アスペクト比修正カード」を実施）
   - [ ] ビューアで共有（シェアシートが開き画像を送れる）・削除（確認→消える→カメラに戻るとゴーストも更新）
   - [ ] アプリ強制終了 → 再起動 → 写真とゴーストが残っている
   - [ ] 設定アプリでカメラ権限を OFF → アプリ起動 → 「設定を開く」ボタンで設定に飛べる
   - [ ] ギャラリーの「プライバシー」リンクでプラポリページが開く（フェーズ4完了後）
5. 🧑 スクリーンショット撮影（このビルドで実施）:
   - 枚数: 3〜5枚。①ゴースト重畳中のカメラ ②透明度切替 ③ギャラリー ④ビューア
   - サイズ: ASC の「6.9インチディスプレイ」枠の許容サイズは **1260×2736 / 1290×2796 / 1320×2868（縦）**。最近の iPhone の実機スクショはそのまま使えることが多い。合わない機種なら AI が `sips -z 2868 1320 <file>` 等でリサイズ支援
   - 保存先: リポジトリ外（例: ~/Desktop/hibicam-screenshots/）。リポジトリに入れない

### DoD
E2E 全項目パス、スクショ確保、projectId 入りの app.json を commit / push 済み。

---

## フェーズ4残り: GitHub Pages 公開（人間 5分）

1. 🧑 `docs/index.md` の `{{CONTACT_EMAIL}}` を公開して良いメールアドレスに全置換（6箇所）。
   AI 支援: `sed -i '' 's/{{CONTACT_EMAIL}}/実アドレス/g' docs/index.md` → commit / push
2. 🧑 GitHub → Settings → Pages → Source: `Deploy from a branch`, Branch: `main`, Folder: `/docs` → Save
3. AI: 数分後に `curl -s -o /dev/null -w "%{http_code}" https://rossoandoy.github.io/GhostCam/` が 200 を返すことを確認

---

## フェーズ5: App Store Connect + TestFlight

1. 🧑 [App Store Connect](https://appstoreconnect.apple.com) → マイ App → 「+」→ 新規 App
   - プラットフォーム: iOS / 名前: **ヒビカメ**（取られていたら「ヒビカメ - 定点観測カメラ」）
   - プライマリ言語: 日本語 / Bundle ID: `com.rossoandoy.ghostcam` / SKU: `ghostcam-ios-001`
2. AI: 作成後に ASC の「App 情報」に表示される **Apple ID（数字）** を聞き、eas.json に submit 設定を追加して commit:
   ```json
   "submit": {
     "production": {
       "ios": { "ascAppId": "<数字のApple ID>" }
     }
   }
   ```
3. 🧑 本番ビルド & アップロード:
   ```bash
   npx eas-cli build --profile production --platform ios
   npx eas-cli submit --platform ios --profile production --latest
   ```
   （EAS Submit は無料プラン可。submit = App Store Connect へのアップロードであり審査提出ではない）
4. 🧑 TestFlight 内部テスト（Beta App Review 不要）:
   - TestFlight タブ → Internal Testing の「+」→ グループ名 `Internal QA` で作成
   - Invite Testers → 自分の App Store Connect ユーザーを追加
   - Add Builds → 対象ビルドを追加（What to Test は `docs/store-metadata.md` §7 の要約で可）
   - 輸出コンプライアンス（暗号化）の設問が出たら回答（本アプリは標準的な HTTPS すら使わないため通常「なし」相当）
   - iPhone の TestFlight アプリで招待を受諾 → **本番ビルドでフェーズ3の E2E を再実施**（提出前必須ゲート）
5. 🧑 メタデータ入力（文言はすべて `docs/store-metadata.md` からコピペ）:
   - スクショ / プロモーションテキスト / 説明 / キーワード / サポート URL / プラポリ URL / Copyright
   - カテゴリ: 写真/ビデオ / 価格: 無料 / 年齢: 設問に正直に回答（全て「なし」→ 4+ 相当）
   - App Privacy: **「データは収集されていません」**（根拠は store-metadata.md §8）
   - アクセシビリティ表示（Nutrition Label）: 該当項目のみ正直に申告
   - **EU 配信判断**: DSA トレーダー申告をしたくなければ配信国から EU を外す（後から追加可能・推奨）。申告する場合は個人情報（住所等）が EU ストアに表示される点に注意
   - 審査ノート（App Review 情報 → メモ）: store-metadata.md §7 の英語文をコピペ

### 提出前 ASC 必須チェック（🧑 / AI が読み上げ確認）
- [ ] Agreements（契約・税金・口座）に未署名の警告が出ていない
- [ ] App Review Information: 連絡先（姓名・電話・メール）入力済み / Notes に §7 / Sign-in required: No
- [ ] iOS 1.0 のページで対象ビルド（TestFlight で E2E したもの）が選択されている
- [ ] Export Compliance の設問に回答済み
- [ ] Pricing and Availability: 無料・配信国（EU 方針含む）設定済み

### DoD
TestFlight 本番ビルドで E2E パス、上記チェック全項目クリア。

---

## フェーズ6: 審査提出 → 公開 🧑

1. App Store Connect → Apps → ヒビカメ → サイドバーの「iOS 1.0」を開く
2. App Store Version Release で「**Manually release this version**（手動でリリース）」を選択 → Save
3. 右上の「**Add for Review**」→ Draft Submission が作成される
4. サイドバーの App Review（または Draft Submissions）を開き「**Submit for Review**」を押す（提出はこの2段階）
5. 結果は通常 24〜48h。**審査待ち中に AI がやること**: 下記 v1.1 移行カードの準備（ブランチ `v1.1-filesystem-migration`）、README の仕上げ
6. 承認 → ステータスが Pending Developer Release になったら 🧑 が「Release This Version」→ Confirm で公開 🎉
7. 公開後: HANDOFF.md を「公開済み」に更新し、フェーズ7の判断（Android 着手時期）をユーザーに確認

---

## リジェクト対応プレイブック

**リジェクトが来たら**: Resolution Center の指摘全文を読み、該当 Guideline 番号で以下を選ぶ。反論（Reply）より修正再提出の方が早いことが多い。修正実装は Sonnet 委任 → codex レビュー → TestFlight 再確認 → 再提出。

### Guideline 4.2（Minimum Functionality）だった場合 — 追加機能カード
優先順に 1〜2 個実装して再提出:
1. **2枚比較ビュー**（実装 0.5日）: ギャラリーで2枚選択 → 左右 or 上下に並べて表示 + スライダーで重ね合わせ比較。定点観測の価値を直接強化
2. **カメラロール書き出し**（0.5日): `npx expo install expo-media-library` → ビューアに「カメラロールに保存」。`NSPhotoLibraryAddUsageDescription` を app.json の `ios.infoPlist` に追加（文言例: 「撮影した写真をカメラロールに保存するために使用します。」）
3. 撮影日時ラベルのギャラリー表示（0.25日）: ファイル名の timestamp から日付を出す

### Guideline 5.1.1（権限・プライバシー）だった場合
- purpose string の具体性を上げる / プラポリ URL の疎通・アプリ内リンクを再確認

### アスペクト比修正カード（E2E でゴーストがズレた場合）
原因: CameraView のプレビュー（FILL）と撮影画像（センサー比 4:3 等）の crop 差。
対応: `npx expo install expo-image-manipulator` → `takePicture` 内で保存前に画面アスペクト比へ crop:
```js
import * as ImageManipulator from 'expo-image-manipulator';
import { Dimensions } from 'react-native';
// photo.width/height と画面比 (Dimensions) を比べ、はみ出す辺を中央基準で crop してから moveAsync する
```
実装後は必ず実機で「同じ被写体の重ね撮り」を再確認。

---

## v1.1 移行カード（公開後・任意）

`expo-file-system/legacy` → 新 API への移行（legacy は将来の SDK で削除見込み）:
- `FileSystem.documentDirectory + 'photos/'` → `new Directory(Paths.document, 'photos')`
- `getInfoAsync` → `directory.exists` / `makeDirectoryAsync` → `directory.create()`
- `readDirectoryAsync` → `directory.list()` / `moveAsync` → `file.move(dest)` / `deleteAsync` → `file.delete()`
- 対象: `src/screens/CameraScreen.js`, `src/screens/GalleryScreen.js`。移行後に実機 E2E 全項目を再実施してからリリース（buildNumber は autoIncrement 任せ、`app.json` の `version` を 1.1.0 に）

---

## フェーズ7: Android 後追い（着手指示があるまで動かない）

準備済み: `android.package` / adaptive icon / eas.json のプラットフォーム非依存構成 / プラポリ英語版。
着手時の要点: Google Play Console 登録($25) → 個人アカウントは **12人×14日のクローズドテスト**が本番公開の前提 → `Share.share` は Android では画像共有できないため `expo-sharing` へ置換（codex 指摘済み）→ Data safety フォームは「データ収集なし」で申告。
