import * as vscode from 'vscode';

/**
 * デバッグログ。イベント名や状態のみを記録し、
 * ユーザーの入力内容・コード内容は絶対に記録しない。
 */
let channel: vscode.OutputChannel | undefined;
let debugEnabled = false;

export function initLog(context: vscode.ExtensionContext): void {
  channel = vscode.window.createOutputChannel('Pop SE');
  context.subscriptions.push(channel);
}

export function setDebugEnabled(enabled: boolean): void {
  debugEnabled = enabled;
}

export function debug(message: string): void {
  if (debugEnabled && channel) {
    channel.appendLine(`[${new Date().toISOString()}] ${message}`);
  }
}

/** debugLog設定に関係なく出力する (診断・エラー用) */
export function info(message: string): void {
  channel?.appendLine(`[${new Date().toISOString()}] ${message}`);
}

export function showLog(): void {
  channel?.show(true);
}
