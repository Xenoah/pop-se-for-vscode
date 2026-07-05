import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import { AudioEngineHost } from './audioEngineHost';
import { SoundService } from './soundService';
import {
  applyPreset, exportSnapshot, getSettings, getSlots, getUserPresets,
  importSnapshot, resetAllSettings, saveCurrentAsUserPreset, saveSlots,
} from './config';
import { PRESET_THEMES } from './presets';
import { SOUND_RECIPES } from './soundRecipes';
import { SUPPORTED_AUDIO_EXTENSIONS, USER_PRESET_PREFIX } from './types';
import { hasShellIntegrationApi } from './listeners';
import { info, showLog } from './log';
import * as path from 'path';
import * as os from 'os';

/**
 * オールリセット。必ず確認ダイアログを出し、
 * ユーザーが明示的に「すべて初期化」を選んだ場合のみ実行する。
 */
export async function runResetAllWithConfirmation(sound: SoundService): Promise<boolean> {
  const CONFIRM = 'すべて初期化';
  const answer = await vscode.window.showWarningMessage(
    'すべてのサウンド設定を初期化します。',
    {
      modal: true,
      detail: 'カスタム音源、イベント割り当て、音量設定も削除されます。\nこの操作は元に戻せません。',
    },
    CONFIRM
    // モーダルには「キャンセル」ボタンが自動で付く
  );
  if (answer !== CONFIRM) {
    return false;
  }
  await resetAllSettings();
  sound.refresh();
  info('all settings have been reset');
  void vscode.window.showInformationMessage('Pop SE: すべてのサウンド設定を初期化しました。');
  return true;
}

/** 設定エクスポート (JSONファイルへ保存) */
export async function runExport(): Promise<void> {
  const target = await vscode.window.showSaveDialog({
    title: 'Pop SE 設定をエクスポート',
    filters: { JSON: ['json'] },
    defaultUri: vscode.Uri.file(path.join(os.homedir(), 'pop-se-settings.json')),
  });
  if (!target) { return; }
  const json = JSON.stringify(exportSnapshot(), null, 2);
  await fs.writeFile(target.fsPath, json, 'utf8');
  void vscode.window.showInformationMessage(`Pop SE: 設定をエクスポートしました: ${target.fsPath}`);
}

/** 設定インポート (JSONファイルから適用) */
export async function runImport(sound: SoundService): Promise<void> {
  const picked = await vscode.window.showOpenDialog({
    title: 'Pop SE 設定をインポート',
    canSelectMany: false,
    filters: { JSON: ['json'] },
  });
  if (!picked || !picked[0]) { return; }
  try {
    const text = await fs.readFile(picked[0].fsPath, 'utf8');
    await importSnapshot(JSON.parse(text));
    sound.refresh();
    void vscode.window.showInformationMessage('Pop SE: 設定をインポートしました。');
  } catch (e) {
    void vscode.window.showErrorMessage(`Pop SE: インポートに失敗しました: ${(e as Error).message}`);
  }
}

/** 音が鳴らない場合の診断コマンド */
async function runDiagnose(engine: AudioEngineHost): Promise<void> {
  const s = getSettings();
  const status = await engine.queryStatus();
  const slots = getSlots();

  const lines: string[] = [];
  lines.push('===== Pop SE 診断 =====');
  lines.push(`拡張機能有効        : ${s.enabled ? 'はい' : '★いいえ (popSe.enabledをオンにしてください)'}`);
  lines.push(`マスター音量        : ${s.masterVolume}${s.masterVolume === 0 ? ' ★0になっています' : ''}`);
  lines.push(`タイプ音有効        : ${s.typingEnabled} (音量 ${s.typingVolume})`);
  lines.push(`通知音量            : ${s.notificationVolume}`);
  lines.push(`プリセット          : ${vscode.workspace.getConfiguration('popSe').get('preset')}`);
  lines.push(`低遅延モード        : ${s.lowLatencyMode}`);
  lines.push('');
  lines.push(`Sound Engine稼働    : ${status.running ? 'はい' : '★いいえ (パネルの「Sound Engine」ビューを表示してください)'}`);
  if (status.running) {
    lines.push(`AudioContext状態    : ${status.audioContextState}${status.audioContextState !== 'running' ? ' ★runningではありません' : ''}`);
    lines.push(`サンプルレート      : ${status.sampleRate} Hz`);
    lines.push(`baseLatency         : ${status.baseLatency !== undefined && status.baseLatency >= 0 ? (status.baseLatency * 1000).toFixed(1) + ' ms' : '不明'}`);
    lines.push(`キャッシュ済スロット: [${(status.cachedSlots ?? []).join(', ')}]`);
    lines.push(`再生中ボイス数      : ${status.activeVoices}`);
  }
  lines.push('');
  lines.push(`Shell Integration   : ${hasShellIntegrationApi() ? '利用可能' : '利用不可 (コマンド成功/失敗イベントは無音)'}`);
  lines.push('');
  lines.push('--- カスタム音スロット ---');
  for (const slot of slots) {
    let fileState = '';
    if (slot.type === 'file') {
      if (!slot.filePath) {
        fileState = ' ★ファイル未選択';
      } else {
        try {
          await fs.access(slot.filePath);
          fileState = ` (${path.basename(slot.filePath)})`;
        } catch {
          fileState = ` ★ファイルが見つかりません: ${slot.filePath}`;
        }
      }
    } else if (slot.type === 'generated') {
      fileState = ` (生成音: ${slot.filePath})`;
    }
    lines.push(`#${slot.id} ${slot.name}: type=${slot.type}, enabled=${slot.enabled}, volume=${slot.volume}, cooldown=${slot.cooldownMs}ms${fileState}`);
  }
  lines.push('=======================');

  for (const line of lines) { info(line); }
  showLog();

  const summary = !s.enabled ? '拡張機能が無効です。'
    : !status.running ? 'Sound Engineが起動していません。パネルの「Sound Engine」ビューを表示してください。'
    : status.audioContextState !== 'running' ? 'AudioContextがrunningではありません。Sound Engineビューを一度クリックしてください。'
    : s.masterVolume === 0 ? 'マスター音量が0です。'
    : '基本状態は正常です。詳細は出力パネル (Pop SE) を確認してください。';
  void vscode.window.showInformationMessage(`Pop SE 診断: ${summary}`);
}

export function registerCommands(
  context: vscode.ExtensionContext,
  engine: AudioEngineHost,
  sound: SoundService,
  openSettingsPanel: () => void
): void {
  const reg = (id: string, fn: (...args: unknown[]) => unknown) =>
    context.subscriptions.push(vscode.commands.registerCommand(id, fn));

  reg('popSe.openSettings', () => openSettingsPanel());

  reg('popSe.applyPreset', async () => {
    const items: Array<vscode.QuickPickItem & { id: string }> = PRESET_THEMES.map((t) => ({
      label: t.label,
      description: t.description,
      id: t.id as string,
    }));
    const userPresets = getUserPresets();
    if (userPresets.length > 0) {
      items.push(
        { label: 'マイプリセット', kind: vscode.QuickPickItemKind.Separator, id: '' },
        ...userPresets.map((p) => ({
          label: p.label,
          description: '保存したプリセット',
          id: USER_PRESET_PREFIX + p.id,
        }))
      );
    }
    const picked = await vscode.window.showQuickPick(items, {
      title: 'プリセットテーマを一括適用', placeHolder: 'テーマを選択してください',
    });
    if (picked && picked.id) {
      await applyPreset(picked.id);
      void vscode.window.showInformationMessage(`Pop SE: プリセット「${picked.label}」を適用しました。`);
    }
  });

  reg('popSe.saveUserPreset', async () => {
    const label = await vscode.window.showInputBox({
      title: '現在の設定をプリセットとして保存',
      prompt: 'プリセット名を入力してください (40文字まで)',
      validateInput: (v) => v.trim() ? undefined : '名前を入力してください',
    });
    if (!label) { return; }
    try {
      const preset = await saveCurrentAsUserPreset(label.trim());
      void vscode.window.showInformationMessage(`Pop SE: プリセット「${preset.label}」を保存しました。`);
    } catch (e) {
      void vscode.window.showErrorMessage(`Pop SE: ${(e as Error).message}`);
    }
  });

  reg('popSe.pickCustomSoundFile', async () => {
    const slots = getSlots();
    const pickedSlot = await vscode.window.showQuickPick(
      slots.map((slot) => ({
        label: `#${slot.id} ${slot.name}`,
        description: slot.type === 'file' ? path.basename(slot.filePath) : slot.type,
        slotId: slot.id,
      })),
      { title: 'どのスロットに音声ファイルを割り当てますか？' }
    );
    if (!pickedSlot) { return; }
    const pickedFile = await vscode.window.showOpenDialog({
      canSelectMany: false,
      filters: { '音声ファイル': [...SUPPORTED_AUDIO_EXTENSIONS] },
      title: `カスタム${pickedSlot.slotId} の音声ファイルを選択`,
    });
    if (!pickedFile || !pickedFile[0]) { return; }
    const current = getSlots();
    const slot = current[pickedSlot.slotId - 1];
    slot.type = 'file';
    slot.filePath = pickedFile[0].fsPath;
    await saveSlots(current);
    await engine.preloadSlot(getSlots()[pickedSlot.slotId - 1]);
    void vscode.window.showInformationMessage(`Pop SE: ${slot.name} に ${path.basename(slot.filePath)} を割り当てました。`);
  });

  reg('popSe.testSound', async () => {
    const slotItems = getSlots()
      .filter((s) => s.type !== 'none')
      .map((s) => ({ label: `#${s.id} ${s.name}`, description: 'カスタム音', sound: `slot:${s.id}` }));
    const recipeItems = SOUND_RECIPES.map((r) => ({
      label: r.label, description: r.id, sound: `preset:${r.id}`,
    }));
    const picked = await vscode.window.showQuickPick([...slotItems, ...recipeItems], {
      title: 'テスト再生する音を選択',
    });
    if (picked) {
      await engine.ensureStarted(true);
      engine.play(picked.sound, 'notification');
    }
  });

  reg('popSe.toggleEnabled', async () => {
    const next = !getSettings().enabled;
    await vscode.workspace.getConfiguration('popSe')
      .update('enabled', next, vscode.ConfigurationTarget.Global);
    void vscode.window.showInformationMessage(`Pop SE: サウンドを${next ? '有効' : '無効'}にしました。`);
  });

  reg('popSe.resetAll', () => runResetAllWithConfirmation(sound));
  reg('popSe.diagnose', () => runDiagnose(engine));
  reg('popSe.exportSettings', () => runExport());
  reg('popSe.importSettings', () => runImport(sound));
}
