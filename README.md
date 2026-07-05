# Pop SE — VS Code Sound Theme Engine

VS Codeの各種操作・イベントに効果音を鳴らす拡張機能です。
プリセットテーマを選ぶだけで、保存・入力・ターミナル・ビルド・エラー検知などの効果音を一括適用できます。音声ファイルは同梱せず、プリセット音はすべてWeb Audio API (Oscillator / Gain / Filter / Envelope) でリアルタイム合成するため軽量で、権利面の問題もありません。

## 進捗

| 機能 | 状態 |
|---|---|
| プリセットテーマ 8種 (生成音・一括適用) | ✅ 実装済み |
| カスタム音スロット 固定10枠 (wav/mp3/ogg/m4a) | ✅ 実装済み |
| イベント割り当て (全24イベント) | ✅ 実装済み |
| タイプ音 低遅延エンジン (同時再生数制限/cooldown/短音優先/間引き/ピッチランダム化) | ✅ 実装済み |
| Diagnostics差分検出・過剰発火抑制 | ✅ 実装済み |
| タスク開始/成功/失敗 (Task API) | ✅ 実装済み |
| ターミナル + Shell Integrationによるコマンド成功/失敗判定 | ✅ 実装済み |
| VS Code標準Settings対応 | ✅ 実装済み |
| 専用Webview設定画面 (Preset/Custom Sounds/Event Mapping/Volume/Advanced/Reset) | ✅ 実装済み |
| オールリセット (確認ダイアログ必須) | ✅ 実装済み |
| 設定エクスポート / インポート (JSON) | ✅ 実装済み |
| 診断コマンド (音が鳴らない場合の切り分け) | ✅ 実装済み |
| 実機での音質・遅延チューニング | ⬜ 未着手 (F5で動作確認可能) |
| Marketplace公開 (アイコン・パッケージング) | ⬜ 未着手 |
| 自動テスト | ⬜ 未着手 |

## 使い方

1. このリポジトリを開いて `npm install` → F5 (Run Extension) でデバッグ起動
2. 起動後、パネル (ターミナルの並び) に **Sound Engine** ビューが常駐します。これが音声再生エンジンです — 閉じると音が鳴らなくなります
3. コマンドパレットから **`Pop SE: サウンド設定画面を開く`** で設定画面を開きます
4. **Preset** タブでテーマを選んで「一括適用」

音が鳴らないときは **`Pop SE: サウンド診断`** を実行してください。

## プリセットテーマ

| テーマ | 内容 |
|---|---|
| Classic PC | 昔のPCスピーカー風ビープ (矩形波) |
| Retro Game | 8bitゲーム機風 (コイン・ジャンプ・ファンファーレ) |
| Mechanical Keyboard | ノイズ合成による打鍵音 + 控えめなベル通知 |
| Sci-Fi Console | サイン波スイープのSFコンソール風 |
| Robot Terminal | ノコギリ波のローファイ端末風 |
| Minimal UI | タイプ音なし、要所のみごく控えめ |
| Alert Heavy | タイプ音なし、エラー・ビルド結果をはっきり通知 |
| Silent Assistant | すべて無音 (一時ミュート用) |

## 対象イベント (24種)

- **タイプ音**: 通常入力 / Enter / Backspace / Delete / Space / Tab / Paste / Undo / Redo
- **エディタ操作**: ファイル保存 / ファイルを開く / アクティブエディタ変更 / タブを閉じる
- **Diagnostics**: Error発生 / Warning発生 / Error解消 / Warning解消
- **タスク・ビルド**: タスク開始 / 終了成功 / 終了失敗
- **ターミナル**: 作成 / 終了 / コマンド成功 / コマンド失敗 (成功・失敗はShell Integrationが利用できる場合のみ)

各イベントには「プリセット音 / カスタム音スロット / 無音」を割り当てられます。

## カスタム音スロット (固定10枠)

各スロットは `id / name / enabled / type / filePath / volume / cooldownMs / description` を持ちます。

- `type: none` — 未設定
- `type: file` — 音声ファイル (wav / mp3 / ogg / m4a)。選択時にプリロードされ、AudioBufferとしてキャッシュされます
- `type: generated` — 生成音レシピ (`filePath` にレシピIDを格納)

ファイル選択は設定画面の「ファイル選択…」または `Pop SE: カスタム音スロットに音声ファイルを割り当て` コマンドから行えます。

## コマンド一覧

| コマンド | 説明 |
|---|---|
| `Pop SE: サウンド設定画面を開く` | 専用Webview設定画面 |
| `Pop SE: プリセットテーマを適用` | QuickPickで一括適用 |
| `Pop SE: カスタム音スロットに音声ファイルを割り当て` | スロット→ファイルの順に選択 |
| `Pop SE: サウンドをテスト再生` | 任意の音をテスト |
| `Pop SE: サウンドの有効/無効を切り替え` | 全体トグル |
| `Pop SE: オールリセット` | 確認ダイアログ後に全設定初期化 |
| `Pop SE: サウンド診断` | エンジン状態・設定・スロットの診断レポート |
| `Pop SE: 設定をエクスポート / インポート` | JSONで保存・復元 |

## 主な設定 (settings.json)

| キー | 既定値 | 説明 |
|---|---|---|
| `popSe.enabled` | `true` | 全体の有効/無効 (無効時は全イベント音停止) |
| `popSe.masterVolume` | `0.6` | マスター音量 (0.0〜1.0) |
| `popSe.preset` | `classicPc` | プリセットテーマ (変更で一括適用) |
| `popSe.typing.enabled` / `popSe.typing.volume` | `true` / `0.5` | タイプ音 |
| `popSe.typing.pitchRandomization` | `true` | 通常入力音のピッチランダム化 |
| `popSe.typing.cooldownMs` / `popSe.typing.maxVoices` | `25` / `8` | 連打時の間引き・同時再生数制限 |
| `popSe.notification.volume` | `0.7` | 通知音量 |
| `popSe.diagnostics.cooldownMs` | `1500` | エラー/警告音の連続発火抑制 |
| `popSe.lowLatencyMode` | `true` | AudioContextを`interactive`で常時稼働 |
| `popSe.debugLog` | `false` | デバッグログ (イベント名と状態のみ記録) |
| `popSe.eventMap` / `popSe.customSlots` | — | イベント割り当て / スロット (通常は設定画面から編集) |

## アーキテクチャ (低遅延設計)

```
┌─ Extension Host ──────────────────┐   ┌─ Audio Engine Webview (常駐) ────┐
│ listeners.ts   VS Codeイベント監視 │   │ audioEngine.js                    │
│ soundService   イベント→soundId変換│──▶│  Web Audio API 再生               │
│                cooldownゲート      │   │  生成音: レシピから即時合成        │
│ config.ts      設定管理・キャッシュ │   │  カスタム音: AudioBufferキャッシュ │
│ audioEngineHost ファイルプリロード  │   │  タイプ音: 低遅延チャンネル        │
│                 Webviewへ再生命令  │   │  音量/同時再生数/cooldown制御     │
└───────────────────────────────────┘   └───────────────────────────────────┘
          ▲ 設定変更                              (設定画面とは独立)
┌─ Settings Webview Panel ─┐
│ Preset / Custom Sounds / │
│ Event Mapping / Volume / │
│ Advanced / Reset         │
└──────────────────────────┘
```

- 音声ファイルはイベント発生時には読み込みません。起動時・設定時にExtension Hostが読み込み、Webviewへ転送してAudioBufferとしてキャッシュします
- Audio Engineはパネル領域のWebviewView (`retainContextWhenHidden`) として常駐し、設定画面を閉じても再生は継続します
- タイプ音はイベント発生→`postMessage`→キャッシュ済みパラメータから即合成、の最短経路で再生されます

## プライバシー / 安全性

- タイプ音処理で入力文字列は保存・送信・ログ出力しません (判定に使うのは文字数・改行有無・空白種別のみ)
- デバッグログはイベント名と状態のみ
- 外部通信はありません。プリセット音は完全に合成音です

## 開発

```bash
npm install
npm run compile   # または npm run watch
# F5 で Extension Development Host を起動
```

詳細な設計メモは [CLAUDE.md](CLAUDE.md) を参照してください。
