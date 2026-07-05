import * as vscode from 'vscode';
import * as path from 'path';
import { AudioEngineHost, makeNonce } from './audioEngineHost';
import { SoundService } from './soundService';
import {
  addSlot, deleteUserPreset, getEventMap, getPresetKey, getSettings, getSlots,
  getUserPresets, removeLastSlot, saveCurrentAsUserPreset, saveEventMap, saveSlots,
  setSetting, applyPreset as applyPresetConfig,
} from './config';
import { PRESET_THEMES } from './presets';
import { SOUND_RECIPES } from './soundRecipes';
import {
  ALL_EVENT_IDS, EVENT_CATEGORY, EVENT_LABEL_JA, EventId, MAX_SLOT_COUNT,
  MAX_USER_PRESETS, MIN_SLOT_COUNT, SoundRef, SUPPORTED_AUDIO_EXTENSIONS,
  USER_PRESET_PREFIX,
} from './types';
import { hasShellIntegrationApi } from './listeners';
import { debug } from './log';
import { runResetAllWithConfirmation, runExport, runImport } from './commands';

/**
 * 専用設定画面 (Webview Panel)。
 * Audio Engine Webviewとは別物なので、この画面を閉じても音は鳴り続ける。
 */
export class SettingsPanel {
  private static current: SettingsPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  static createOrShow(
    extensionUri: vscode.Uri,
    engine: AudioEngineHost,
    sound: SoundService
  ): void {
    if (SettingsPanel.current) {
      SettingsPanel.current.panel.reveal();
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'popSe.settings',
      'Pop SE サウンド設定',
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
      }
    );
    SettingsPanel.current = new SettingsPanel(panel, extensionUri, engine, sound);
  }

  /** 設定変更時に外部から呼ばれ、画面の状態を再送する */
  static refreshIfOpen(): void {
    SettingsPanel.current?.sendState();
  }

  static disposeIfOpen(): void {
    SettingsPanel.current?.dispose();
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    private readonly engine: AudioEngineHost,
    private readonly sound: SoundService
  ) {
    this.panel = panel;
    panel.webview.html = this.buildHtml(panel.webview, extensionUri);
    panel.onDidDispose(() => this.dispose(), null, this.disposables);
    panel.webview.onDidReceiveMessage(
      (msg) => void this.onMessage(msg),
      null,
      this.disposables
    );
  }

  private dispose(): void {
    SettingsPanel.current = undefined;
    this.panel.dispose();
    for (const d of this.disposables.splice(0)) { d.dispose(); }
  }

  private sendState(): void {
    const settings = getSettings();
    void this.panel.webview.postMessage({
      cmd: 'state',
      state: {
        settings,
        currentPreset: getPresetKey(),
        eventMap: getEventMap(),
        slots: getSlots(),
        minSlots: MIN_SLOT_COUNT,
        maxSlots: MAX_SLOT_COUNT,
        presets: PRESET_THEMES.map((t) => ({ id: t.id, label: t.label, description: t.description })),
        userPresets: getUserPresets().map((p) => ({
          id: USER_PRESET_PREFIX + p.id, label: p.label,
        })),
        maxUserPresets: MAX_USER_PRESETS,
        recipes: SOUND_RECIPES.map((r) => ({ id: r.id, label: r.label })),
        events: ALL_EVENT_IDS.map((id) => ({
          id, label: EVENT_LABEL_JA[id], category: EVENT_CATEGORY[id],
        })),
        shellIntegration: hasShellIntegrationApi(),
        engineRunning: this.engine.isRunning(),
        supportedExtensions: SUPPORTED_AUDIO_EXTENSIONS,
      },
    });
  }

  private async onMessage(msg: Record<string, unknown>): Promise<void> {
    try {
      switch (msg.cmd) {
        case 'ready':
          this.sendState();
          break;

        case 'applyPreset': {
          const key = String(msg.presetId);
          await applyPresetConfig(key);
          debug(`preset applied from settings panel: ${key}`);
          // 適用したテーマの保存音を鳴らしてフィードバック
          const feedback = getEventMap().fileSave;
          if (feedback && feedback.sound !== 'none') { this.testPlay(feedback.sound); }
          break;
        }

        case 'saveUserPreset': {
          const label = await vscode.window.showInputBox({
            title: '現在の設定をプリセットとして保存',
            prompt: 'プリセット名を入力してください (40文字まで)',
            validateInput: (v) => v.trim() ? undefined : '名前を入力してください',
          });
          if (label) {
            const preset = await saveCurrentAsUserPreset(label.trim());
            debug('user preset saved');
            void vscode.window.showInformationMessage(`Pop SE: プリセット「${preset.label}」を保存しました。`);
          }
          break;
        }

        case 'deleteUserPreset': {
          const key = String(msg.presetId);
          if (!key.startsWith(USER_PRESET_PREFIX)) { break; }
          const id = key.slice(USER_PRESET_PREFIX.length);
          const target = getUserPresets().find((p) => p.id === id);
          if (!target) { break; }
          const DELETE = '削除';
          const answer = await vscode.window.showWarningMessage(
            `ユーザープリセット「${target.label}」を削除しますか？`,
            { modal: true },
            DELETE
          );
          if (answer === DELETE) {
            await deleteUserPreset(id);
          }
          break;
        }

        case 'addSlot': {
          const slot = await addSlot();
          if (!slot) {
            void vscode.window.showWarningMessage(`Pop SE: カスタム音スロットは最大${MAX_SLOT_COUNT}枠です。`);
          }
          break;
        }

        case 'removeSlot': {
          const slots = getSlots();
          if (slots.length <= MIN_SLOT_COUNT) { break; }
          const last = slots[slots.length - 1];
          if (last.type !== 'none') {
            const REMOVE = '削除';
            const answer = await vscode.window.showWarningMessage(
              `スロット #${last.id}「${last.name}」には音源が設定されています。削除しますか？`,
              { modal: true },
              REMOVE
            );
            if (answer !== REMOVE) { break; }
          }
          await removeLastSlot();
          await this.engine.preloadAllSlots();
          break;
        }

        case 'setSetting':
          await setSetting(String(msg.key), msg.value);
          break;

        case 'setEventSetting': {
          const eventId = String(msg.eventId) as EventId;
          if (!ALL_EVENT_IDS.includes(eventId)) { break; }
          const map = getEventMap();
          const patch = msg.patch as { sound?: SoundRef; enabled?: boolean };
          if (typeof patch.sound === 'string') { map[eventId].sound = patch.sound; }
          if (typeof patch.enabled === 'boolean') { map[eventId].enabled = patch.enabled; }
          await saveEventMap(map);
          break;
        }

        case 'updateSlot': {
          const slotId = Number(msg.slotId);
          const slots = getSlots();
          const slot = slots[slotId - 1];
          if (!slot) { break; }
          Object.assign(slot, msg.patch);
          await saveSlots(slots);
          await this.engine.preloadSlot(getSlots()[slotId - 1]);
          break;
        }

        case 'pickFile': {
          const slotId = Number(msg.slotId);
          const picked = await vscode.window.showOpenDialog({
            canSelectMany: false,
            filters: { '音声ファイル': [...SUPPORTED_AUDIO_EXTENSIONS] },
            title: `カスタム${slotId} の音声ファイルを選択`,
          });
          if (picked && picked[0]) {
            const slots = getSlots();
            const slot = slots[slotId - 1];
            slot.type = 'file';
            slot.filePath = picked[0].fsPath;
            if (!slot.description) {
              slot.description = path.basename(picked[0].fsPath);
            }
            await saveSlots(slots);
            await this.engine.preloadSlot(getSlots()[slotId - 1]);
          }
          break;
        }

        case 'clearFile': {
          const slotId = Number(msg.slotId);
          const slots = getSlots();
          const slot = slots[slotId - 1];
          if (!slot) { break; }
          slot.type = 'none';
          slot.filePath = '';
          await saveSlots(slots);
          await this.engine.preloadSlot(getSlots()[slotId - 1]);
          break;
        }

        case 'testSound':
          this.testPlay(String(msg.sound));
          break;

        case 'resetAll':
          await runResetAllWithConfirmation(this.sound);
          break;

        case 'export':
          await runExport();
          break;

        case 'import':
          await runImport(this.sound);
          break;

        case 'startEngine':
          await this.engine.ensureStarted(true);
          break;
      }
    } catch (e) {
      void vscode.window.showErrorMessage(`Pop SE: 操作に失敗しました: ${(e as Error).message}`);
    }
    // どの操作でも最新状態を再送して画面と設定の一致を保つ
    this.sendState();
  }

  private testPlay(sound: SoundRef): void {
    if (!this.engine.isRunning()) {
      void this.engine.ensureStarted(true).then(() => {
        setTimeout(() => this.engine.play(sound, 'notification'), 400);
      });
      return;
    }
    this.engine.play(sound, 'notification');
  }

  private buildHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'settings.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'settings.css'));
    const nonce = makeNonce();
    return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${webview.cspSource};">
<link rel="stylesheet" href="${styleUri}">
<title>Pop SE サウンド設定</title>
</head>
<body>
  <nav id="nav">
    <h1>🔊 Pop SE</h1>
    <button class="nav-item active" data-section="preset">Preset</button>
    <button class="nav-item" data-section="custom">Custom Sounds</button>
    <button class="nav-item" data-section="mapping">Event Mapping</button>
    <button class="nav-item" data-section="volume">Volume</button>
    <button class="nav-item" data-section="advanced">Advanced</button>
    <button class="nav-item" data-section="reset">Reset</button>
    <div id="engine-status"></div>
  </nav>
  <main id="main">
    <section id="section-preset" class="section active"></section>
    <section id="section-custom" class="section"></section>
    <section id="section-mapping" class="section"></section>
    <section id="section-volume" class="section"></section>
    <section id="section-advanced" class="section"></section>
    <section id="section-reset" class="section"></section>
  </main>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
