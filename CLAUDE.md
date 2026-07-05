# CLAUDE.md — Pop SE (VS Code Sound Theme Engine) 開発メモ

VS Codeの操作・イベントに効果音を鳴らす拡張機能。仕様と実装状況はREADME.mdと本ファイルが正。

## ビルド / 実行

```bash
npm install
npm run compile        # tsc -p . → out/
npm run watch          # F5デバッグのpreLaunchTask
```

F5 (Run Extension) でExtension Development Hostが起動する。自動テストは未整備。動作確認は実機 (F5) で行う。

## ディレクトリ構成

```
src/
  extension.ts        activate/deactivate。全モジュールの配線と設定変更の反映
  types.ts            共有型 + Host⇔Webviewメッセージ契約 (EventId/CustomSlot/SoundRef等)
  config.ts           設定の読み書き・正規化・リセット・エクスポート/インポート
  presets.ts          8プリセットテーマ (イベント→SoundRefの完全マップ)
  soundRecipes.ts     生成音レシピ約80種 (Web Audio合成パラメータのデータ定義)
  soundService.ts     イベントID→soundId変換 + 再生ゲート (設定キャッシュ/cooldown)
  audioEngineHost.ts  Audio Engine WebviewViewのHost側 (プリロード/再生命令/診断ping)
  listeners.ts        VS Codeイベント監視 (typing/editor/diagnostics/tasks/terminal)
  settingsPanel.ts    設定画面WebviewPanelのHost側
  commands.ts         コマンド実装 (リセット/診断/エクスポート等)
  log.ts              出力チャンネル。debugLog設定でゲート
media/
  audioEngine.js      Audio Engine Webview本体 (Web Audio API再生エンジン)
  settings.js         設定画面UI (DOM直組み、フレームワーク不使用)
  settings.css        設定画面スタイル (VS Codeテーマ変数ベース)
  icon.svg            パネルビューコンテナ用アイコン
```

## アーキテクチャの要点

### 2つのWebviewは役割が違う

1. **Audio Engine** (`popSe.audioEngine`): パネル領域のWebviewView。
   `registerWebviewViewProvider`の第3引数 `webviewOptions.retainContextWhenHidden: true` で
   非表示でもAudioContextが生き続ける。**これが唯一の音声再生経路**。
   ユーザーがビューを閉じる/`popSe.enabled=false` (viewのwhen句) でエンジンは破棄され音は止まる。
2. **設定画面** (`popSe.settings`): 通常のWebviewPanel。閉じても音は鳴り続ける (要件)。

WebviewViewは一度表示されるまでresolveされないため、起動1.5秒後に
`popSe.audioEngine.focus` → `workbench.action.focusActiveEditorGroup` で一度だけ初期化する
(`autoStartEngine`設定でオフ可)。`ensureStarted`は`startAttempted`フラグで1セッション1回に制限。
`popSe.enabled`がfalse→trueになったときだけ強制再起動する (extension.ts)。

### 低遅延設計 (要件: タイプ音のタイムラグ最小化)

- イベント発生時のファイルI/Oはゼロ。カスタム音は起動時/設定変更時に
  Host側でfs.readFile→base64→postMessage→`decodeAudioData`でAudioBufferキャッシュ
  (`audioEngineHost.preloadSlot`、同一パスは再転送しない)
- 生成音はinit時に転送済みレシピ(パラメータ)から即時ノード合成
- SoundServiceは設定をキャッシュし、`onDidChangeConfiguration`時のみ再読込
- cooldownゲートは二段: Host側 (postMessage自体を間引く) + Webview側 (最終ゲート+スロット個別cooldownMs)
- タイプ音の同時再生数制限は「短音優先」: 上限到達時に残り再生時間が最長のボイスをフェード停止
- ピッチランダム化は`keyClick`のみ ±6%

### SoundRefの形式

`'none'` | `'preset:<recipeId>'` | `'slot:<1-10>'`。
`popSe.eventMap`は差分保存で、`getEventMap()`が現在のプリセットのデフォルトに重ねて全24イベント分を返す。
プリセット適用 = `popSe.preset`更新 + eventMap全上書き。

### カスタムスロットの注意

- 固定10枠。`normalizeSlots`がどんな保存値でも10枠に正規化する (id範囲外は捨てる)
- `type: 'generated'` のとき **filePathフィールドにレシピIDを格納** している (仕様上のフィールド流用)
- generated型でレシピIDが不正な場合はnormalize時にtype:'none'へ落とす

### イベント判定のヒューリスティック (listeners.ts)

- Backspace/Delete判別: `onDidChangeTextEditorSelection`で直前カーソル位置を記録し、
  削除範囲のstart側にカーソルがあればDelete、それ以外はBackspace
- Enter: 挿入テキストが改行を含み`trim()`が空 (自動インデント対応)。改行含み非空白はPaste
- 1〜3文字挿入=keyClick (IME確定・括弧補完込み)、4文字以上=Paste
- Undo/Redoは`TextDocumentChangeReason`で正確に判定
- **入力文字列そのものは保存・ログ出力しない** (プライバシー要件。判定は長さ/種別のみ)
- 起動後3秒 (`WARMUP_MS`) は復元タブ・復元ターミナル・初回diagnosticsスキャンの音を抑制
- Diagnostics: uriごとに{errors,warnings}スナップショットを持ち、0→n / n→0 の遷移のみ発音
  (同一ファイル内でエラーが増えても鳴らない)。加えて`diagnostics.cooldownMs`
- タスク: `onDidEndTaskProcess`のexitCodeが正。プロセスなしタスクは`onDidEndTask`+150ms遅延で成功扱い
- ターミナル成功/失敗: `onDidEndTerminalShellExecution` (VS Code 1.93+)。
  API不在環境ではfeature detect (`hasShellIntegrationApi`) して無音 + 設定画面に警告表示

### オールリセット

`runResetAllWithConfirmation` (commands.ts) のみが入口。modal警告ダイアログで
「すべて初期化」を明示選択した場合だけ`resetAllSettings()`実行。設定画面のResetタブも同関数を呼ぶ。

### モジュール依存の制約

`commands.ts`は`settingsPanel.ts`をimportしない (逆方向のみ)。循環回避のため、
設定画面を開くコールバックはextension.tsから`registerCommands`へ注入する。
設定変更後の画面更新は`onDidChangeConfiguration`→`SettingsPanel.refreshIfOpen()`で一元化。

## 進捗 / TODO

### 完了 (2026-07-05)

- 全仕様の初期実装 (プリセット8種 / スロット10枠 / 24イベント / 設定2系統 /
  オールリセット / 診断 / エクスポート・インポート / 低遅延エンジン)
- tsc strictでコンパイル成功

### 未着手

- [ ] 実機での音質・音量バランス・遅延の調整 (レシピのパラメータはF5で聴いて要チューニング)
- [ ] 自動テスト (config正規化・eventMapマージ・importバリデーションが対象候補)
- [ ] Marketplace公開準備 (publisher名確定、アイコンPNG、CHANGELOG、vsce package)
- [ ] READMEへのスクリーンショット/デモGIF追加

### 既知の制限

- Sound Engineビューをユーザーが完全に閉じると音は鳴らない (診断コマンドが案内する)
- Webview経由のため数十ms程度の再生遅延は原理的に残る (postMessage往復)
- コマンド成功/失敗はShell Integration非対応シェルでは判定不可 (仕様どおり無音)
- IME確定を含む1〜3文字挿入はすべてkeyClick扱い (キー種別のヒューリスティックの限界)

## コーディング規約

- TypeScript strict。`npm run compile`が警告ゼロで通ること
- ログは`log.ts`経由のみ。**ユーザーの入力内容・コード内容をログに出さない**
- 音量は常に0.0〜1.0で扱いclamp01で正規化
- Webviewは`makeNonce`によるCSP nonce必須、`settings.js`はinnerHTML禁止 (DOMヘルパー`h()`を使う)
- UI文言は日本語
