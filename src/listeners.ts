import * as vscode from 'vscode';
import { SoundService } from './soundService';
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
// ターミナル (Shell Integration対応)
// ============================================================

/** Shell Integration API (VS Code 1.93+) が利用可能か */
export function hasShellIntegrationApi(): boolean {
  return typeof (vscode.window as unknown as Record<string, unknown>)
    .onDidEndTerminalShellExecution === 'function';
}

function registerTerminalListeners(
  context: vscode.ExtensionContext,
  sound: SoundService,
  warmingUp: () => boolean
): void {
  context.subscriptions.push(
    vscode.window.onDidOpenTerminal(() => {
      if (warmingUp()) { return; } // ウィンドウ復元時のターミナルでは鳴らさない
      sound.playEvent('terminalOpen');
    })
  );

  context.subscriptions.push(
    vscode.window.onDidCloseTerminal(() => {
      sound.playEvent('terminalClose');
    })
  );

  // コマンド成功/失敗はShell Integrationが有効な場合のみ判定できる。
  // 利用できない環境では対応外イベントとして無音。
  if (hasShellIntegrationApi()) {
    context.subscriptions.push(
      vscode.window.onDidEndTerminalShellExecution((e) => {
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
