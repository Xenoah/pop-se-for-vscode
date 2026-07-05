import * as vscode from 'vscode';
import { AUDIO_ENGINE_VIEW_ID, AudioEngineHost } from './audioEngineHost';
import { SoundService } from './soundService';
import { registerAllListeners } from './listeners';
import { registerCommands } from './commands';
import { SettingsPanel } from './settingsPanel';
import { getSettings } from './config';
import { debug, initLog, setDebugEnabled } from './log';

let engine: AudioEngineHost | undefined;

export function activate(context: vscode.ExtensionContext): void {
  initLog(context);
  setDebugEnabled(getSettings().debugLog);
  debug('activating');

  // Audio Engine (常駐WebviewView)。retainContextWhenHiddenで
  // パネルが非表示でもAudioContextを維持し、低遅延再生を保つ。
  engine = new AudioEngineHost(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(AUDIO_ENGINE_VIEW_ID, engine, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  const sound = new SoundService(engine);

  registerAllListeners(context, sound);
  registerCommands(context, engine, sound, () =>
    SettingsPanel.createOrShow(context.extensionUri, engine!, sound)
  );

  // 設定変更の反映: キャッシュ更新 → エンジンへ転送 → 設定画面へ再送
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration('popSe')) { return; }
      const s = getSettings();
      setDebugEnabled(s.debugLog);
      sound.refresh();
      SettingsPanel.refreshIfOpen();
      // 無効→有効に戻したときはエンジンビューを再初期化する
      // (無効化中はwhen句によりビューごと破棄されているため)
      if (e.affectsConfiguration('popSe.enabled') && s.enabled && engine && !engine.isRunning()) {
        void engine.ensureStarted(true);
      }
    })
  );

  // 起動時のエンジン自動初期化。WebviewViewは一度表示されるまで
  // resolveされないため、workbench安定後に一度だけ表示を要求する。
  const settings = getSettings();
  if (settings.enabled && settings.autoStartEngine) {
    setTimeout(() => {
      if (engine && !engine.isRunning()) {
        void engine.ensureStarted(false);
      }
    }, 1500);
  }

  debug('activated');
}

export function deactivate(): void {
  // Webview・リスナー等はcontext.subscriptionsで解放される。
  // エンジンには停止指示を送り、再生中の音を止める。
  engine?.dispose();
  engine = undefined;
  SettingsPanel.disposeIfOpen();
}
