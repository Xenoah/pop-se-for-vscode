import * as vscode from 'vscode';
import { getPresetId, getSettings } from './config';
import { PRESET_MAP } from './presets';
import { AudioEngineHost, AUDIO_ENGINE_VIEW_ID } from './audioEngineHost';

export const MENU_VIEW_ID = 'popSe.menu';

interface MenuEntry {
  label: string;
  description?: string;
  icon: string;          // codicon名
  commandId?: string;
  tooltip?: string;
}

/**
 * アクティビティバー (左側) の Pop SE メニュー。
 * 現在の状態表示と、各コマンドへの入口を提供する。
 */
export class MenuViewProvider implements vscode.TreeDataProvider<MenuEntry> {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.emitter.event;

  constructor(private readonly engine: AudioEngineHost) {}

  refresh(): void {
    this.emitter.fire();
  }

  getTreeItem(entry: MenuEntry): vscode.TreeItem {
    const item = new vscode.TreeItem(entry.label);
    item.description = entry.description;
    item.iconPath = new vscode.ThemeIcon(entry.icon);
    item.tooltip = entry.tooltip;
    if (entry.commandId) {
      item.command = { command: entry.commandId, title: entry.label };
    }
    return item;
  }

  getChildren(element?: MenuEntry): MenuEntry[] {
    if (element) { return []; }
    const s = getSettings();
    const preset = PRESET_MAP.get(getPresetId());
    const engineRunning = this.engine.isRunning();

    return [
      // ---- 状態 ----
      {
        label: s.enabled ? 'サウンド: 有効' : 'サウンド: 無効',
        icon: s.enabled ? 'unmute' : 'mute',
        commandId: 'popSe.toggleEnabled',
        tooltip: 'クリックで有効/無効を切り替え',
      },
      {
        label: 'プリセット',
        description: preset?.label ?? '-',
        icon: 'symbol-color',
        commandId: 'popSe.applyPreset',
        tooltip: 'クリックでプリセットテーマを選択して一括適用',
      },
      {
        label: engineRunning ? 'Sound Engine: 稼働中' : 'Sound Engine: 停止中',
        icon: engineRunning ? 'pass' : 'warning',
        commandId: `${AUDIO_ENGINE_VIEW_ID}.focus`,
        tooltip: 'クリックでパネルのSound Engineビューを表示',
      },
      // ---- 操作 ----
      {
        label: 'サウンド設定画面を開く',
        icon: 'settings-gear',
        commandId: 'popSe.openSettings',
      },
      {
        label: 'カスタム音ファイルを割り当て',
        icon: 'file-media',
        commandId: 'popSe.pickCustomSoundFile',
      },
      {
        label: 'サウンドをテスト再生',
        icon: 'play',
        commandId: 'popSe.testSound',
      },
      {
        label: 'サウンド診断',
        icon: 'pulse',
        commandId: 'popSe.diagnose',
      },
      {
        label: '設定をエクスポート',
        icon: 'export',
        commandId: 'popSe.exportSettings',
      },
      {
        label: '設定をインポート',
        icon: 'desktop-download',
        commandId: 'popSe.importSettings',
      },
      {
        label: 'オールリセット…',
        icon: 'trash',
        commandId: 'popSe.resetAll',
        tooltip: '確認ダイアログの後、すべてのサウンド設定を初期化します',
      },
    ];
  }
}
