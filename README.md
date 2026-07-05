# ヒビカメ (HibiCam)

「昨日の状態を透かして、今日の変化を撮るだけ」— 定点観測カメラアプリ。

前回撮影した写真をカメラプレビューに半透明で重ねる**ゴースト機能**で、毎日同じ画角の写真を撮れます。植物の成長、筋トレ、工事の進捗、片付けの記録などの定点観測に。

## 機能

- 📷 起動即カメラ。前回写真を透明度 15/30/50% でオーバーレイ
- 🖼 ギャラリー（3列グリッド）、全画面ビューア、共有・削除
- 🔒 完全オフライン。データ収集ゼロ。写真は端末内にのみ保存

## 技術スタック

- React Native / Expo SDK 55（Managed Workflow）
- `expo-camera` / `expo-file-system`（**注意: SDK 55 ではレガシー API は `expo-file-system/legacy` から import すること**）
- React Navigation (stack)

## 開発

```bash
npm install
npx expo start --dev-client   # Expo Go は SDK 55 iOS 版未公開のため development build 前提
npm run lint
```

iOS development build:

```bash
eas build --profile development --platform ios
```

## リリース関連

- ビルドプロファイル: `eas.json`（development / preview / production）
- プライバシーポリシー & サポート: `docs/index.md` → GitHub Pages で公開（Settings → Pages → main `/docs`）
- App Store メタデータ・審査ノート: `docs/store-metadata.md`
- Bundle ID: `com.rossoandoy.ghostcam`（iOS / Android 共通・変更不可）

## ライセンス / 開発者

個人開発: Kohei Ando (@rossoandoy)
