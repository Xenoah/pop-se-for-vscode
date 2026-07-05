import * as vscode from 'vscode';
import { AUDIO_ENGINE_VIEW_ID, AudioEngineHost } from './audioEngineHost';
import { SoundService } from './soundService';
import { registerAllListeners } from './listeners';
import { registerCommands } from './commands';
import { SettingsPanel } from './settingsPanel';
import { MenuViewProvider, MENU_VIEW_ID } from './menuView';
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

  // アクティビティバー (左側) のメニュー
  const menu = new MenuViewProvider(engine);
  const menuView = vscode.window.createTreeView(MENU_VIEW_ID, { treeDataProvider: menu });
  context.subscriptions.push(menuView);
  // エンジン稼働状態は設定イベントを発しないため、ビューが見えている間だけ定期更新する
  let menuTimer: NodeJS.Timeout | undefined;
  const updateMenuPolling = () => {
    if (menuView.visible && !menuTimer) {
      menuTimer = setInterval(() => menu.refresh(), 3000);
    } else if (!menuView.visible && menuTimer) {
      clearInterval(menuTimer);
      menuTimer = undefined;
    }
  };
  context.subscriptions.push(menuView.onDidChangeVisibility(updateMenuPolling));
  context.subscriptions.push({ dispose: () => { if (menuTimer) { clearInterval(menuTimer); } } });
  updateMenuPolling();

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
      menu.refresh();
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
