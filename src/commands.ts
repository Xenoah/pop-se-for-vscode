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
import { TRIGGER_DIR } from './triggerBridge';
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
  lines.push(`外部トリガー        : ${s.externalTriggersEnabled ? `有効 (監視: ${TRIGGER_DIR})` : '無効 (popSe.externalTriggers.enabled)'}`);
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

  // 状態が正常ならテスト音 (設定を介さない直接ビープ) を鳴らして実出力を確認する
  const canBeep = status.running && status.audioContextState === 'running';
  if (canBeep) {
    engine.playTestTone();
  }

  const summary = !s.enabled ? '拡張機能が無効です。'
    : !status.running ? 'Sound Engineが起動していません。パネルの「Sound Engine」ビューを表示してください。'
    : status.audioContextState !== 'running' ? 'AudioContextがrunningではありません。Sound Engineビュー内の「🔊 音声を有効化」をクリックしてください。'
    : s.masterVolume === 0 ? 'マスター音量が0です。'
    : 'テスト音を再生しました。聞こえない場合はOSの音量ミキサーでVS Codeの出力を確認してください。';
  void vscode.window.showInformationMessage(`Pop SE 診断: ${summary}`);
}

/**
 * AI連携フックの設定例をMarkdownドキュメントとして開く。
 * 外部トリガーブリッジ (~/.pop-se/events/) の使い方と、
 * Claude Code hooks / Codex notify の具体的な設定例を示す。
 */
async function runShowAiHookExamples(): Promise<void> {
  const isWin = process.platform === 'win32';
  const cmdFor = (id: string) => isWin
    ? `cmd /c type nul > "%USERPROFILE%\\.pop-se\\events\\${id}"`
    : `touch ~/.pop-se/events/${id}`;

  const claudeHooks = JSON.stringify({
    hooks: {
      UserPromptSubmit: [
        { hooks: [{ type: 'command', command: cmdFor('aiPromptSend') }] },
      ],
      Notification: [
        { hooks: [{ type: 'command', command: cmdFor('aiApprove') }] },
      ],
      PreToolUse: [
        { matcher: '', hooks: [{ type: 'command', command: cmdFor('aiApproveDone') }] },
      ],
      PostToolUse: [
        { matcher: '', hooks: [{ type: 'command', command: cmdFor('aiOutput') }] },
      ],
      Stop: [
        { hooks: [{ type: 'command', command: cmdFor('aiComplete') }] },
      ],
    },
  }, null, 2);

  const codexNotify = isWin
    ? `notify = ["cmd", "/c", 'type nul > %USERPROFILE%\\.pop-se\\events\\aiComplete']`
    : `notify = ["bash", "-lc", "touch ~/.pop-se/events/aiComplete"]`;

  const content = `# Pop SE — AI連携フックの設定例

Pop SE は次のディレクトリを監視しています (外部トリガーブリッジ):

\`\`\`
${TRIGGER_DIR}
\`\`\`

このディレクトリに **イベントIDと同名のファイルを作成/更新** すると、そのイベントの音が鳴ります。
ファイルの内容は読み取りません (ファイル名のみ使用)。連続発火は自動で間引かれます。
無効化する場合は設定 \`popSe.externalTriggers.enabled\` をオフにしてください。

## AIフェーズイベント一覧

| イベントID | 鳴るタイミング |
|---|---|
| \`aiPromptSend\` | チャット (プロンプト) 送信時 |
| \`aiOutput\` | 応答出力・ツール実行の進行中 ※チャットのコードブロック/エージェント編集は自動検出もあり |
| \`aiConfirm\` | 確認要求時 |
| \`aiSelect\` | 選択要求時 |
| \`aiApprove\` | 承認 (権限確認) 要求時 |
| \`aiApproveDone\` | 承認完了・ツール実行開始時 |
| \`aiComplete\` | 作業完了時 |

※ 他のイベントID (\`fileSave\` など) のファイル名でも鳴らせます。
※ 各イベントへの音の割り当ては設定画面の Event Mapping (AIアシスタント) で変更できます。

## Claude Code (hooks)

\`~/.claude/settings.json\` に以下を追加すると、送信/承認要求/進行中/完了で鳴ります:

\`\`\`json
${claudeHooks}
\`\`\`

- \`UserPromptSubmit\` → 送信音 (\`aiPromptSend\`)
- \`Notification\` → 承認・入力待ち通知音 (\`aiApprove\`)。確認/選択も通常この通知に含まれます
- \`PreToolUse\` → 承認完了・ツール実行開始音 (\`aiApproveDone\`)。
  ※承認不要 (自動許可) のツール実行でも鳴ります。承認直後だけに限定するフックはありません
- \`PostToolUse\` → ツール実行のたびの進行音 (\`aiOutput\`)。うるさい場合はこの項目を削除
- \`Stop\` → 作業完了音 (\`aiComplete\`)

## Codex CLI (notify)

\`~/.codex/config.toml\`:

\`\`\`toml
${codexNotify}
\`\`\`

## GitHub Copilot

Copilot 拡張機能にはフック機構がなく、インライン補完・チャット応答はVS Code APIからも
検出できません。対応しているのは以下のみです:

- Copilot CLI (\`copilot\` / \`gh copilot\`) の実行開始/終了 (ターミナルのShell Integration経由)
- ツール名を含むターミナルの作成/終了

## 動作テスト

ターミナルで次を実行して音が鳴れば連携は動作しています:

\`\`\`
${cmdFor('aiComplete')}
\`\`\`
`;

  const doc = await vscode.workspace.openTextDocument({ language: 'markdown', content });
  await vscode.window.showTextDocument(doc);
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

  reg('popSe.setupAiHooks', () => runShowAiHookExamples());
  reg('popSe.resetAll', () => runResetAllWithConfirmation(sound));
  reg('popSe.diagnose', () => runDiagnose(engine));
  reg('popSe.exportSettings', () => runExport());
  reg('popSe.importSettings', () => runImport(sound));
}
