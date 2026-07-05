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
  listeners.ts        VS Codeイベント監視 (typing/editor/diagnostics/tasks/terminal/AI検出)
  triggerBridge.ts    外部トリガーブリッジ (~/.pop-se/events/ のfs.watch監視)
  settingsPanel.ts    設定画面WebviewPanelのHost側
  menuView.ts         アクティビティバー (左側) のメニューTreeView
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

さらにアクティビティバー (左側) に **メニューTreeView** (`popSe.menu`, menuView.ts) がある。
これは音を鳴らさない純粋な入口UI (状態表示 + コマンド起動のみ)。
Audio Engineをサイドバーに置かないのは、サイドバービューは初回表示までresolveされず
起動時の自動初期化がパネルより不安定になるため。エンジン稼働状態の表示は
ビュー可視時のみ3秒ポーリングで追従 (extension.ts)。

WebviewViewは一度表示されるまでresolveされないため、起動1.5秒後に
`popSe.audioEngine.focus` → `workbench.action.focusActiveEditorGroup` で一度だけ初期化する
(`autoStartEngine`設定でオフ可)。workbench復元との競合に備え8秒後に一度だけ強制再試行。
`ensureStarted`は`startAttempted`フラグで1セッション1回に制限。
`popSe.enabled`がfalse→trueになったときだけ強制再起動する (extension.ts)。

### 自動再生制限 (音が出ない問題) への対策

WebviewのAudioContextは自動再生ポリシーで`suspended`のまま開始できないことがある。
以前は`handlePlay`が`state !== 'running'`で全ての音を黙って捨てていた (=無音の原因)。
現在の実装 (audioEngine.js):

- suspended検出時は1秒間隔でresumeを再試行 (最大30回)。Webview内の
  pointerdown/keydown/clickもresume契機にする
- 5回失敗した時点で`audioBlocked`メッセージをHostへ送り、Hostが通知を1回だけ表示
  (「Sound Engineビュー内の🔊音声を有効化ボタンをクリック」と案内)
- suspended中に届いた**通知音**は保留キュー (TTL 5秒 / 最大8件) に積み、
  running遷移時にまとめて再生する。**タイプ音は保留しない** (遅延再生は不自然)
- エンジンビューに「🔊 音声を有効化」ボタンを表示 (running時は非表示)
- エンジンビューに常設の「🔔 テスト音」ボタン: 設定・イベント割り当てを介さず
  destinationへ直接880Hzビープを鳴らす (`testTone`メッセージ、診断コマンドからも送信)。
  これが聞こえない場合は拡張の問題ではなくOS音量ミキサー/出力デバイス側と切り分けられる
- エンジン未起動のままplay()が呼ばれた場合、5秒間隔で最大5回まで起動を強制再試行
  (audioEngineHost.ts `startRetryCount`)

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

`'none'` | `'preset:<recipeId>'` | `'slot:<1-100>'`。
`popSe.eventMap`は差分保存で、`getEventMap()`が現在のプリセットのデフォルトに重ねて全37イベント分を返す。
プリセット適用 = `popSe.preset`更新 + eventMap全上書き。

### プリセットのキーとマイプリセット

- `popSe.preset`は組み込みPresetId または `'user:<id>'` (ユーザープリセット参照)。
  不正値は`getPresetKey()`が`'classicPc'`へ落とす
- マイプリセットは`popSe.userPresets`に`{id, label, map}`の配列で保存 (最大30件、
  `normalizeUserPresets`で正規化)。mapは全イベントのEventMapスナップショット
- 保存 (`saveCurrentAsUserPreset`) = userPresets追加 + preset切替。
  削除 (`deleteUserPreset`) は選択中でも音が変わらないよう、
  **先に`getEventMap()`を実体化してeventMapへ保存**してからpresetを'classicPc'へ戻す
- UIは3入口: 設定画面Presetタブ / コマンド`popSe.saveUserPreset` / サイドバーメニュー

### カスタムスロットの注意

- 初期10枠 (`MIN_SLOT_COUNT`)、追加で最大100枠 (`MAX_SLOT_COUNT`)。idは1始まりの連番で、
  `normalizeSlots`は保存値の最大idまで (10〜100にclamp) の連番配列に正規化する
- イベント割り当てが`slot:<id>`で参照するためidは不変。**削除は末尾のみ** (`removeLastSlot`、
  10枠以下には減らせない)。音源設定済みスロットの削除はHost側でmodal確認を取る
- スロット削除後は`preloadAllSlots`が現枠数より大きいidのWebviewキャッシュをclearSlotで破棄
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
- AIアシスタント (Claude Code / Codex / Copilot) 検出は二系統:
  1. ターミナル名にツール名を含む端末のopen/close (Claude Code拡張は「Claude Code」端末を開く)
  2. Shell Integrationの`onDidStart/EndTerminalShellExecution`でコマンドラインの
     **先頭トークンの実行ファイル名** (claude/codex/copilot/gh-copilot) を判定。
     該当実行はWeakMapで追跡し、汎用のcommandSuccess/Failureとは二重に鳴らさない。
     コマンドライン内容は判定にのみ使い、保存・ログ出力しない (プライバシー要件)
  - Copilotのインライン補完/チャット本文テキストは公開APIで検出不可 (既知の制限)
- aiOutput (AI応答出力中) の自動検出 (`registerAiOutputListener`):
  1. チャット系仮想ドキュメント (スキームに chat/copilot/codex を含む) の変更 —
     Copilot Chatのコードブロックストリームで発火
  2. **アクティブエディタ以外**のfileスキームドキュメントへの**挿入を伴う**変更 —
     エージェント編集のストリームで発火 (ユーザータイプはアクティブエディタなので干渉しない)
  - リスナー側で250msに間引き (ストリーム中はティック音になる)。git操作等の誤検出は許容し、
    不要ならイベントを無音に。ドキュメント内容は読まない (スキームと変更有無のみ)

### 外部トリガーブリッジ (triggerBridge.ts)

AIフェーズイベント (aiPromptSend/aiOutput/aiConfirm/aiSelect/aiApprove/aiApproveDone/aiComplete)
はVS Code APIで検出できない (aiOutputのみ自動検出あり) ため、`~/.pop-se/events/` を
`fs.watch`で監視し、**イベントIDと同名のファイルの作成/更新**で該当音を鳴らす。
Claude Code hooksとの対応: UserPromptSubmit→aiPromptSend / Notification→aiApprove /
PreToolUse→aiApproveDone (承認不要の自動許可ツールでも鳴る点に注意) /
PostToolUse→aiOutput / Stop→aiComplete。

- Claude Code hooks / Codex notify などから `type nul > ...\aiComplete` (Win) /
  `touch ~/.pop-se/events/aiComplete` (Unix) するだけで連携できる
- ファイル名のみ使用し内容は読まない (プライバシー)。ファイルは削除せず放置 (最大でもイベントID数)
- fs.watchはrename/changeで多重発火するがSoundServiceのイベント別cooldown (150ms) で間引かれる
- どのイベントIDでも発火可能 (AIフェーズ専用ではない)
- `popSe.externalTriggers.enabled` (default true) でオン/オフ。設定変更でstart/stop切替 (extension.ts)
- 設定例ドキュメントは `popSe.setupAiHooks` コマンド (commands.ts `runShowAiHookExamples`) が
  プラットフォーム別に生成して untitled Markdown で開く

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
- アクティビティバー (左側) のメニューTreeView追加
- 音が出ない問題の修正 (自動再生制限対策: resumeリトライ / 保留キュー / 有効化ボタン / Host通知)
- マイプリセット (保存/適用/削除、最大30件、エクスポート・インポート対応)
- カスタムスロットの可変化 (初期10枠→最大100枠、追加/末尾削除)
- AIアシスタントトリガー6イベント追加 (Claude Code / Codex / GitHub Copilot の開始・終了)
- AIフェーズイベント7種 (送信/出力/確認/選択/承認要求/承認完了/作業完了、計37イベント) +
  外部トリガーブリッジ (~/.pop-se/events/ 監視、Claude Code hooks / Codex notify 連携、
  設定例表示コマンド `popSe.setupAiHooks`)
- aiOutputの自動検出 (チャットコードブロックのストリーム + エージェントの非アクティブファイル編集)。
  デフォルト音もタイプ音系ティックに変更 (minimalUi/alertHeavy/silentAssistantは無音のまま)
- 音が出ない問題の切り分け強化: エンジンビューの「🔔 テスト音」ボタン (設定非経由の直接ビープ)、
  診断コマンドのテスト音自動再生、play()時の起動強制再試行 (5秒×5回)
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
- AIアシスタント検出はターミナル名/CLIコマンド名ベースのヒューリスティック。
  Copilotのインライン補完・チャット、Codexサイドバーパネルの応答は検出できない

## コーディング規約

- TypeScript strict。`npm run compile`が警告ゼロで通ること
- ログは`log.ts`経由のみ。**ユーザーの入力内容・コード内容をログに出さない**
- 音量は常に0.0〜1.0で扱いclamp01で正規化
- Webviewは`makeNonce`によるCSP nonce必須、`settings.js`はinnerHTML禁止 (DOMヘルパー`h()`を使う)
- UI文言は日本語
