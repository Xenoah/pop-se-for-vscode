/**
 * 共有型定義。Extension Host / Webview 間のメッセージ契約もここに集約する。
 */

/** すべての対象イベントID */
export type EventId =
  // タイプ音
  | 'keyClick'
  | 'enter'
  | 'backspace'
  | 'delete'
  | 'space'
  | 'tab'
  | 'paste'
  | 'undo'
  | 'redo'
  // エディタ操作
  | 'fileSave'
  | 'fileOpen'
  | 'activeEditorChange'
  | 'tabClose'
  // Diagnostics
  | 'errorAppear'
  | 'warningAppear'
  | 'errorResolve'
  | 'warningResolve'
  // タスク / ビルド
  | 'taskStart'
  | 'taskSuccess'
  | 'taskFailure'
  // ターミナル
  | 'terminalOpen'
  | 'terminalClose'
  | 'commandSuccess'
  | 'commandFailure'
  // AIアシスタント (Claude Code / Codex / GitHub Copilot)
  | 'aiClaudeStart'
  | 'aiClaudeEnd'
  | 'aiCodexStart'
  | 'aiCodexEnd'
  | 'aiCopilotStart'
  | 'aiCopilotEnd'
  // AIアシスタント フェーズ (外部トリガー: Claude Code hooks / Codex notify 等から発火)
  | 'aiPromptSend'
  | 'aiOutput'
  | 'aiConfirm'
  | 'aiSelect'
  | 'aiApprove'
  | 'aiApproveDone'
  | 'aiComplete';

export const ALL_EVENT_IDS: EventId[] = [
  'keyClick', 'enter', 'backspace', 'delete', 'space', 'tab', 'paste', 'undo', 'redo',
  'fileSave', 'fileOpen', 'activeEditorChange', 'tabClose',
  'errorAppear', 'warningAppear', 'errorResolve', 'warningResolve',
  'taskStart', 'taskSuccess', 'taskFailure',
  'terminalOpen', 'terminalClose', 'commandSuccess', 'commandFailure',
  'aiClaudeStart', 'aiClaudeEnd', 'aiCodexStart', 'aiCodexEnd',
  'aiCopilotStart', 'aiCopilotEnd',
  'aiPromptSend', 'aiOutput', 'aiConfirm', 'aiSelect', 'aiApprove',
  'aiApproveDone', 'aiComplete',
];

export type EventCategory = 'typing' | 'editor' | 'diagnostics' | 'task' | 'terminal' | 'ai';

export const EVENT_CATEGORY: Record<EventId, EventCategory> = {
  keyClick: 'typing', enter: 'typing', backspace: 'typing', delete: 'typing',
  space: 'typing', tab: 'typing', paste: 'typing', undo: 'typing', redo: 'typing',
  fileSave: 'editor', fileOpen: 'editor', activeEditorChange: 'editor', tabClose: 'editor',
  errorAppear: 'diagnostics', warningAppear: 'diagnostics',
  errorResolve: 'diagnostics', warningResolve: 'diagnostics',
  taskStart: 'task', taskSuccess: 'task', taskFailure: 'task',
  terminalOpen: 'terminal', terminalClose: 'terminal',
  commandSuccess: 'terminal', commandFailure: 'terminal',
  aiClaudeStart: 'ai', aiClaudeEnd: 'ai',
  aiCodexStart: 'ai', aiCodexEnd: 'ai',
  aiCopilotStart: 'ai', aiCopilotEnd: 'ai',
  aiPromptSend: 'ai', aiOutput: 'ai', aiConfirm: 'ai',
  aiSelect: 'ai', aiApprove: 'ai', aiApproveDone: 'ai', aiComplete: 'ai',
};

export const EVENT_LABEL_JA: Record<EventId, string> = {
  keyClick: '通常入力', enter: 'Enter', backspace: 'Backspace', delete: 'Delete',
  space: 'Space', tab: 'Tab', paste: 'Paste', undo: 'Undo', redo: 'Redo',
  fileSave: 'ファイル保存', fileOpen: 'ファイルを開く',
  activeEditorChange: 'アクティブエディタ変更', tabClose: 'タブを閉じる',
  errorAppear: 'Error発生', warningAppear: 'Warning発生',
  errorResolve: 'Error解消', warningResolve: 'Warning解消',
  taskStart: 'タスク開始', taskSuccess: 'タスク終了成功', taskFailure: 'タスク終了失敗',
  terminalOpen: 'ターミナル作成', terminalClose: 'ターミナル終了',
  commandSuccess: 'コマンド成功', commandFailure: 'コマンド失敗',
  aiClaudeStart: 'Claude Code 開始', aiClaudeEnd: 'Claude Code 終了',
  aiCodexStart: 'Codex 開始', aiCodexEnd: 'Codex 終了',
  aiCopilotStart: 'GitHub Copilot 開始', aiCopilotEnd: 'GitHub Copilot 終了',
  aiPromptSend: 'AI: プロンプト送信', aiOutput: 'AI: 応答出力中',
  aiConfirm: 'AI: 確認要求', aiSelect: 'AI: 選択要求',
  aiApprove: 'AI: 承認要求', aiApproveDone: 'AI: 承認完了 (ツール実行開始)',
  aiComplete: 'AI: 作業完了',
};

/**
 * 音の参照。
 *  - 'none'              : 無音
 *  - 'preset:<recipeId>' : 生成音レシピ
 *  - 'slot:<1-10>'       : カスタム音スロット
 */
export type SoundRef = string;

export interface EventSetting {
  sound: SoundRef;
  enabled: boolean;
}

export type EventMap = Partial<Record<EventId, EventSetting>>;

export type SlotType = 'none' | 'file' | 'generated';

/** カスタム音スロット (初期10枠、最大100枠まで追加可能) */
export interface CustomSlot {
  id: number;            // 1..MAX_SLOT_COUNT (連番)
  name: string;
  enabled: boolean;
  type: SlotType;
  /** type='file' のとき音声ファイルの絶対パス。type='generated' のときレシピID。 */
  filePath: string;
  volume: number;        // 0.0..1.0
  cooldownMs: number;
  description: string;
}

export const MIN_SLOT_COUNT = 10;
export const MAX_SLOT_COUNT = 100;

/** ユーザーが保存したプリセット (現在のイベント割り当てのスナップショット) */
export interface UserPreset {
  id: string;            // 'u' + タイムスタンプ36進
  label: string;
  map: EventMap;
}

export const MAX_USER_PRESETS = 30;
/** popSe.preset に保存するユーザープリセット参照のプレフィックス */
export const USER_PRESET_PREFIX = 'user:';
export const SUPPORTED_AUDIO_EXTENSIONS = ['wav', 'mp3', 'ogg', 'm4a'];

/** 生成音レシピの1レイヤー (オシレータまたはノイズ) */
export interface RecipeLayer {
  wave: 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise';
  freq?: number;      // Hz (noiseでは無視)
  freqEnd?: number;   // 指定時は freq→freqEnd へ指数スイープ
  gain: number;       // ピークゲイン 0..1
  attack: number;     // 秒
  decay: number;      // 秒
  delay?: number;     // 発音開始オフセット (秒)
  filter?: {
    type: 'lowpass' | 'highpass' | 'bandpass';
    freq: number;
    q?: number;
  };
}

export interface SoundRecipe {
  id: string;
  label: string;
  layers: RecipeLayer[];
}

/** Webviewに送るエンジン設定スナップショット */
export interface EngineConfig {
  enabled: boolean;
  masterVolume: number;
  typingEnabled: boolean;
  typingVolume: number;
  notificationVolume: number;
  typingPitchRandomization: boolean;
  typingCooldownMs: number;
  typingMaxVoices: number;
  lowLatencyMode: boolean;
  debugLog: boolean;
  slots: CustomSlot[];
}

/** 再生チャンネル。typingは低遅延エンジン、notificationは通常エンジン。 */
export type AudioChannel = 'typing' | 'notification';

// ---- Extension Host -> Audio Engine Webview ----
export type HostToEngineMessage =
  | { type: 'init'; config: EngineConfig; recipes: SoundRecipe[] }
  | { type: 'config'; config: EngineConfig }
  | { type: 'loadSlot'; slotId: number; base64: string; ext: string }
  | { type: 'clearSlot'; slotId: number }
  | {
      type: 'play';
      sound: SoundRef;
      channel: AudioChannel;
      /** 通常入力音のみtrue: ピッチランダム化対象 */
      pitchRand?: boolean;
      /** 短音優先制御用: タイプ音はtrue */
      typing?: boolean;
    }
  | { type: 'stopAll' }
  /** 診断用テスト音。設定・イベント割り当てを介さず直接ビープを鳴らす */
  | { type: 'testTone' }
  | { type: 'ping' };

// ---- Audio Engine Webview -> Extension Host ----
export type EngineToHostMessage =
  | { type: 'ready' }
  | {
      type: 'status';
      audioContextState: string;
      sampleRate: number;
      baseLatency: number;
      cachedSlots: number[];
      activeVoices: number;
    }
  | { type: 'decoded'; slotId: number; durationSec: number }
  | { type: 'decodeError'; slotId: number; message: string }
  /** 自動再生制限でAudioContextを開始できないとき (要ユーザー操作) */
  | { type: 'audioBlocked' }
  | { type: 'log'; message: string };
