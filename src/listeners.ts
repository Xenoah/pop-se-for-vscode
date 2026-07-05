import * as vscode from 'vscode';
import { SoundService } from './soundService';
import { EventId } from './types';
import { debug } from './log';

/**
 * VS Codeイベント監視。
 * 注意: タイプ音処理では入力された文字列そのものを保存・ログ出力しない。
 * 判定に使うのは文字数・改行有無・空白種別のみ。
 */

/** 起動直後のイベント洪水 (復元タブ/復元ターミナル/初回diagnostics) を抑制する猶予時間 */
const WARMUP_MS = 3000;

export function registerAllListeners(
  context: vscode.ExtensionContext,
  sound: SoundService
): void {
  const activatedAt = Date.now();
  const warmingUp = () => Date.now() - activatedAt < WARMUP_MS;

  registerTypingListener(context, sound);
  registerEditorListeners(context, sound, warmingUp);
  registerDiagnosticsListener(context, sound, warmingUp);
  registerTaskListeners(context, sound);
  registerTerminalListeners(context, sound, warmingUp);
  registerAiOutputListener(context, sound, warmingUp);
  registerAiFileActivityListener(context, sound, warmingUp);
}

// ============================================================
// タイプ音 (低遅延パス: 判定は最小限の分岐のみで即playEventを呼ぶ)
// ============================================================

function registerTypingListener(
  context: vscode.ExtensionContext,
  sound: SoundService
): void {
  // Backspace/Delete判別用: 直前のカーソル位置 (ドキュメントごと)
  const lastCursor = new Map<string, vscode.Position>();

  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection((e) => {
      if (e.selections.length > 0) {
        lastCursor.set(e.textEditor.document.uri.toString(), e.selections[0].active);
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      // ユーザーが実際に編集しているエディタのみ対象 (出力パネル等を除外)
      const active = vscode.window.activeTextEditor;
      if (!active || active.document !== e.document) { return; }
      const scheme = e.document.uri.scheme;
      if (scheme !== 'file' && scheme !== 'untitled') { return; }
      if (e.contentChanges.length === 0) { return; }

      if (e.reason === vscode.TextDocumentChangeReason.Undo) {
        sound.playEvent('undo');
        return;
      }
      if (e.reason === vscode.TextDocumentChangeReason.Redo) {
        sound.playEvent('redo');
        return;
      }

      const change = e.contentChanges[0];
      const text = change.text;

      // 削除 (Backspace / Delete)
      if (text.length === 0 && change.rangeLength > 0) {
        const cursor = lastCursor.get(e.document.uri.toString());
        // Backspace: カーソルは削除範囲の末尾 / Delete: 削除範囲の先頭
        if (cursor && cursor.isEqual(change.range.start)) {
          sound.playEvent('delete');
        } else {
          sound.playEvent('backspace');
        }
        return;
      }

      if (text.length === 0) { return; }

      // Enter (自動インデントの空白を含む改行も判定)
      if (text.includes('\n')) {
        if (text.trim().length === 0) {
          sound.playEvent('enter');
        } else {
          sound.playEvent('paste');
        }
        return;
      }

      if (text === ' ') {
        sound.playEvent('space');
        return;
      }
      if (text === '\t') {
        sound.playEvent('tab');
        return;
      }
      // 1〜3文字はキー入力扱い (IME確定/括弧自動補完を含む)、それ以上はPaste
      if (text.length <= 3) {
        sound.playEvent('keyClick');
      } else {
        sound.playEvent('paste');
      }
    })
  );
}

// ============================================================
// エディタ操作
// ============================================================

function registerEditorListeners(
  context: vscode.ExtensionContext,
  sound: SoundService,
  warmingUp: () => boolean
): void {
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(() => {
      sound.playEvent('fileSave');
    })
  );

  context.subscriptions.push(
    vscode.window.tabGroups.onDidChangeTabs((e) => {
      if (warmingUp()) { return; }
      if (e.opened.length > 0) { sound.playEvent('fileOpen'); }
      if (e.closed.length > 0) { sound.playEvent('tabClose'); }
    })
  );

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (warmingUp() || !editor) { return; }
      sound.playEvent('activeEditorChange');
    })
  );
}

// ============================================================
// Diagnostics (前回状態との差分検出 + 過剰発火抑制)
// ============================================================

function registerDiagnosticsListener(
  context: vscode.ExtensionContext,
  sound: SoundService,
  warmingUp: () => boolean
): void {
  // uri -> {errors, warnings} の前回スナップショット
  const prev = new Map<string, { errors: number; warnings: number }>();

  context.subscriptions.push(
    vscode.languages.onDidChangeDiagnostics((e) => {
      let errorAppear = false;
      let errorResolve = false;
      let warningAppear = false;
      let warningResolve = false;

      for (const uri of e.uris) {
        const key = uri.toString();
        let errors = 0;
        let warnings = 0;
        for (const d of vscode.languages.getDiagnostics(uri)) {
          if (d.severity === vscode.DiagnosticSeverity.Error) { errors++; }
          else if (d.severity === vscode.DiagnosticSeverity.Warning) { warnings++; }
        }
        const before = prev.get(key) ?? { errors: 0, warnings: 0 };

        // 0件→1件以上 / 1件以上→0件 の遷移のみ音を鳴らす。
        // 同一ファイル内でエラー数が増減しても (1→5など) 追加では鳴らさない。
        if (before.errors === 0 && errors > 0) { errorAppear = true; }
        if (before.errors > 0 && errors === 0) { errorResolve = true; }
        if (before.warnings === 0 && warnings > 0) { warningAppear = true; }
        if (before.warnings > 0 && warnings === 0) { warningResolve = true; }

        if (errors === 0 && warnings === 0) {
          prev.delete(key);
        } else {
          prev.set(key, { errors, warnings });
        }
      }

      if (warmingUp()) { return; } // 起動直後の初回スキャンでは鳴らさない (状態記録のみ)

      // 1回の変更バッチにつき各種別最大1回。連続発火はSoundService側の
      // diagnostics cooldownでさらに抑制される。
      if (errorAppear) { sound.playEvent('errorAppear'); }
      else if (errorResolve) { sound.playEvent('errorResolve'); }
      if (warningAppear) { sound.playEvent('warningAppear'); }
      else if (warningResolve) { sound.playEvent('warningResolve'); }
    })
  );
}

// ============================================================
// タスク / ビルド (VS Code Task API)
// ============================================================

function registerTaskListeners(
  context: vscode.ExtensionContext,
  sound: SoundService
): void {
  // onDidEndTaskProcessで終了コードを取得済みの実行を記録し、
  // onDidEndTask (プロセスを持たないタスク) との二重発音を防ぐ
  const processEnded = new WeakSet<vscode.TaskExecution>();

  context.subscriptions.push(
    vscode.tasks.onDidStartTask(() => {
      sound.playEvent('taskStart');
    })
  );

  context.subscriptions.push(
    vscode.tasks.onDidEndTaskProcess((e) => {
      processEnded.add(e.execution);
      if (e.exitCode === undefined || e.exitCode === 0) {
        sound.playEvent('taskSuccess');
      } else {
        sound.playEvent('taskFailure');
      }
      debug(`task process ended (exitCode=${e.exitCode ?? 'n/a'})`);
    })
  );

  context.subscriptions.push(
    vscode.tasks.onDidEndTask((e) => {
      // プロセス終了イベントが来るタスクはそちらで処理済み。
      // 少し待ってから未処理なら成功扱いで鳴らす。
      setTimeout(() => {
        if (!processEnded.has(e.execution)) {
          sound.playEvent('taskSuccess');
        }
      }, 150);
    })
  );
}

// ============================================================
// AI応答出力の検出 (aiOutput)
// ============================================================

/**
 * AIアシスタントが「文字を出している」ことをドキュメント変更から検出する。
 * 検出対象:
 *  1. チャット系の仮想ドキュメント — Copilot Chat等が応答内のコードブロックを
 *     ストリームする際に 'vscode-chat-code-block' などのスキームで
 *     onDidChangeTextDocumentが発火する
 *  2. アクティブエディタ以外のファイルへの変更 — エージェント (Copilot Edits /
 *     Claude Code / Codex) が編集中のファイルをストリーム更新すると発火する。
 *     ユーザーのタイプはアクティブエディタで起きるため干渉しない
 * 注意: 2はgit操作・一括置換などでも発火しうるヒューリスティック。
 * 音はaiOutputイベントに割り当てられたもので、無音にすれば無効化できる。
 * ここでもドキュメント内容は一切読まない (スキームと変更の有無のみ)。
 */
function registerAiOutputListener(
  context: vscode.ExtensionContext,
  sound: SoundService,
  warmingUp: () => boolean
): void {
  let lastOutputAt = 0;
  const THROTTLE_MS = 250; // ストリーミング中の連続発火をカタカタ音程度に間引く

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.contentChanges.length === 0 || warmingUp()) { return; }
      const scheme = e.document.uri.scheme;

      // チャット応答の仮想ドキュメント (Copilot Chat / Codex等)
      const isChatDoc = scheme.includes('chat') || scheme.includes('copilot') || scheme.includes('codex');

      if (!isChatDoc) {
        if (scheme !== 'file') { return; } // output等の内部スキームは対象外
        const active = vscode.window.activeTextEditor;
        // アクティブエディタへの変更はユーザーのタイプ音側で処理される
        if (active && active.document === e.document) { return; }
        // 削除のみの変更 (git checkout等で頻発) は対象外にし、挿入を伴うものだけ拾う
        if (!e.contentChanges.some((c) => c.text.length > 0)) { return; }
      }

      const now = Date.now();
      if (now - lastOutputAt < THROTTLE_MS) { return; }
      lastOutputAt = now;
      sound.playEvent('aiOutput');
    })
  );
}

/**
 * AIエージェントによるディスク上のファイル変更の検出 (aiOutput)。
 *
 * OpenAI Codex拡張やClaude Code拡張はWebview UIで動作し、ターミナルも
 * VS Codeのドキュメントも介さずファイルを直接ディスクへ書き込むことがある。
 * これはonDidChangeTextDocumentに現れないため、FileSystemWatcherで拾う。
 *
 * ユーザー由来の書き込みと区別するため:
 *  - onDidSaveTextDocumentで保存したファイルは直後2秒間ディスク変更を無視
 *    (手動保存・自動保存の両方をカバー)
 *  - .git / node_modules / out / dist 等の生成物ディレクトリは無視
 *    (加えてVS Code共有ウォッチャーはfiles.watcherExcludeも適用する)
 * git pull等の外部変更でも鳴りうるヒューリスティック。不要ならaiOutputを無音に。
 */
function registerAiFileActivityListener(
  context: vscode.ExtensionContext,
  sound: SoundService,
  warmingUp: () => boolean
): void {
  const recentSaves = new Map<string, number>();
  const SAVE_SUPPRESS_MS = 2000;
  const EXCLUDE = /[\\/](\.git|node_modules|out|dist|build|coverage|\.next|target)[\\/]/;
  let lastTick = 0;
  const THROTTLE_MS = 250;

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      recentSaves.set(doc.uri.toString(), Date.now());
    })
  );

  const watcher = vscode.workspace.createFileSystemWatcher('**/*');
  context.subscriptions.push(watcher);

  const onDiskChange = (uri: vscode.Uri) => {
    if (warmingUp()) { return; }
    if (uri.scheme !== 'file') { return; }
    if (EXCLUDE.test(uri.fsPath)) { return; }
    const now = Date.now();
    const savedAt = recentSaves.get(uri.toString()) ?? 0;
    if (now - savedAt < SAVE_SUPPRESS_MS) { return; } // ユーザー保存由来の変更
    if (now - lastTick < THROTTLE_MS) { return; }
    lastTick = now;
    sound.playEvent('aiOutput');
  };
  context.subscriptions.push(watcher.onDidChange(onDiskChange));
  context.subscriptions.push(watcher.onDidCreate(onDiskChange));
}

// ============================================================
// ターミナル (Shell Integration対応) + AIアシスタント検出
// ============================================================

/** Shell Integration API (VS Code 1.93+) が利用可能か */
export function hasShellIntegrationApi(): boolean {
  return typeof (vscode.window as unknown as Record<string, unknown>)
    .onDidEndTerminalShellExecution === 'function';
}

type AiTool = 'claude' | 'codex' | 'copilot';

const AI_START_EVENT: Record<AiTool, EventId> = {
  claude: 'aiClaudeStart', codex: 'aiCodexStart', copilot: 'aiCopilotStart',
};
const AI_END_EVENT: Record<AiTool, EventId> = {
  claude: 'aiClaudeEnd', codex: 'aiCodexEnd', copilot: 'aiCopilotEnd',
};

/**
 * ターミナル名からAIアシスタントを判定する。
 * Claude Code拡張は「Claude Code」という名前のターミナルでCLIを実行する。
 * Codex / Copilot もCLI実行用ターミナル名にツール名が含まれることを利用する。
 */
function detectAiToolFromName(name: string): AiTool | undefined {
  const n = name.toLowerCase();
  if (n.includes('claude')) { return 'claude'; }
  if (n.includes('codex')) { return 'codex'; }
  if (n.includes('copilot')) { return 'copilot'; }
  return undefined;
}

/**
 * コマンドラインの先頭トークン (実行ファイル名) からAIアシスタントCLIを判定する。
 * 注意: 判定に使うのは先頭トークンのみで、コマンドライン内容は保存もログ出力もしない。
 */
function detectAiToolFromCommandLine(commandLine: string | undefined): AiTool | undefined {
  if (!commandLine) { return undefined; }
  const first = commandLine.trim().split(/\s+/)[0] ?? '';
  // パス・クォート・Windows拡張子を除いた実行ファイル名に正規化
  const exe = first.replace(/^["']|["']$/g, '').split(/[\\/]/).pop()?.toLowerCase()
    .replace(/\.(exe|cmd|ps1|bat)$/, '') ?? '';
  if (exe === 'claude') { return 'claude'; }
  if (exe === 'codex') { return 'codex'; }
  if (exe === 'copilot' || exe === 'gh-copilot') { return 'copilot'; }
  return undefined;
}

function registerTerminalListeners(
  context: vscode.ExtensionContext,
  sound: SoundService,
  warmingUp: () => boolean
): void {
  context.subscriptions.push(
    vscode.window.onDidOpenTerminal((terminal) => {
      if (warmingUp()) { return; } // ウィンドウ復元時のターミナルでは鳴らさない
      // AIアシスタント用ターミナル (Claude Code拡張等) はAIイベントとして鳴らす
      const tool = detectAiToolFromName(terminal.name);
      if (tool) {
        sound.playEvent(AI_START_EVENT[tool]);
        debug(`ai terminal opened (${tool})`);
      } else {
        sound.playEvent('terminalOpen');
      }
    })
  );

  context.subscriptions.push(
    vscode.window.onDidCloseTerminal((terminal) => {
      const tool = detectAiToolFromName(terminal.name);
      if (tool) {
        if (warmingUp()) { return; }
        sound.playEvent(AI_END_EVENT[tool]);
        debug(`ai terminal closed (${tool})`);
      } else {
        sound.playEvent('terminalClose');
      }
    })
  );

  // コマンド成功/失敗はShell Integrationが有効な場合のみ判定できる。
  // 利用できない環境では対応外イベントとして無音。
  if (hasShellIntegrationApi()) {
    // 通常ターミナル内でAI CLI (claude / codex / copilot) を実行したケースの検出。
    // 開始時にAI開始イベント、終了時にAI終了イベントを鳴らし、汎用の
    // コマンド成功/失敗とは二重に鳴らさない。
    const aiExecutions = new WeakMap<vscode.TerminalShellExecution, AiTool>();

    if (typeof vscode.window.onDidStartTerminalShellExecution === 'function') {
      context.subscriptions.push(
        vscode.window.onDidStartTerminalShellExecution((e) => {
          const tool = detectAiToolFromCommandLine(e.execution.commandLine?.value);
          if (tool) {
            aiExecutions.set(e.execution, tool);
            sound.playEvent(AI_START_EVENT[tool]);
            debug(`ai cli started (${tool})`);
          }
        })
      );
    }

    context.subscriptions.push(
      vscode.window.onDidEndTerminalShellExecution((e) => {
        const tool = aiExecutions.get(e.execution)
          ?? detectAiToolFromCommandLine(e.execution.commandLine?.value);
        if (tool) {
          sound.playEvent(AI_END_EVENT[tool]);
          debug(`ai cli ended (${tool}, exitCode=${e.exitCode ?? 'n/a'})`);
          return;
        }
        if (e.exitCode === undefined) { return; } // 判定不能 (Ctrl+C等) は無音
        if (e.exitCode === 0) {
          sound.playEvent('commandSuccess');
        } else {
          sound.playEvent('commandFailure');
        }
        debug(`shell execution ended (exitCode=${e.exitCode})`);
      })
    );
    debug('shell integration API: available');
  } else {
    debug('shell integration API: not available');
  }
}
