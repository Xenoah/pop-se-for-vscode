import { EventId, EventMap, SoundRef } from './types';

export type PresetId =
  | 'classicPc'
  | 'retroGame'
  | 'mechanicalKeyboard'
  | 'sciFiConsole'
  | 'robotTerminal'
  | 'minimalUi'
  | 'alertHeavy'
  | 'silentAssistant';

export interface PresetTheme {
  id: PresetId;
  label: string;
  description: string;
  map: Record<EventId, SoundRef>;
}

const p = (id: string): SoundRef => `preset:${id}`;
const NONE: SoundRef = 'none';

export const PRESET_THEMES: PresetTheme[] = [
  {
    id: 'classicPc',
    label: 'Classic PC',
    description: '昔のPCスピーカー風のビープ音。懐かしい矩形波サウンド。',
    map: {
      keyClick: p('classic.key'), enter: p('classic.enter'), backspace: p('classic.back'),
      delete: p('classic.back'), space: p('classic.space'), tab: p('classic.tab'),
      paste: p('classic.paste'), undo: p('classic.undo'), redo: p('classic.redo'),
      fileSave: p('classic.save'), fileOpen: p('classic.open'),
      activeEditorChange: p('classic.switch'), tabClose: p('classic.close'),
      errorAppear: p('classic.error'), warningAppear: p('classic.warn'),
      errorResolve: p('classic.errfix'), warningResolve: p('classic.warnfix'),
      taskStart: p('classic.taskstart'), taskSuccess: p('classic.success'), taskFailure: p('classic.fail'),
      terminalOpen: p('classic.termopen'), terminalClose: p('classic.termclose'),
      commandSuccess: p('classic.success'), commandFailure: p('classic.fail'),
      aiClaudeStart: p('classic.taskstart'), aiClaudeEnd: p('classic.success'),
      aiCodexStart: p('classic.taskstart'), aiCodexEnd: p('classic.success'),
      aiCopilotStart: p('classic.taskstart'), aiCopilotEnd: p('classic.success'),
      aiPromptSend: p('classic.open'), aiOutput: p('classic.key'),
      aiConfirm: p('classic.warn'), aiSelect: p('classic.tab'),
      aiApprove: p('classic.warn'), aiApproveDone: p('classic.errfix'),
      aiComplete: p('classic.success'),
    },
  },
  {
    id: 'retroGame',
    label: 'Retro Game',
    description: '8bitゲーム機風。コイン・ジャンプ・ファンファーレ。',
    map: {
      keyClick: p('retro.blip'), enter: p('retro.jump'), backspace: p('retro.hit'),
      delete: p('retro.hit'), space: p('retro.space'), tab: p('retro.tab'),
      paste: p('retro.paste'), undo: p('retro.undo'), redo: p('retro.redo'),
      fileSave: p('retro.coin'), fileOpen: p('retro.select'),
      activeEditorChange: p('retro.select'), tabClose: p('retro.close'),
      errorAppear: p('retro.error'), warningAppear: p('retro.warn'),
      errorResolve: p('retro.coin'), warningResolve: p('retro.select'),
      taskStart: p('retro.start'), taskSuccess: p('retro.fanfare'), taskFailure: p('retro.gameover'),
      terminalOpen: p('retro.start'), terminalClose: p('retro.close'),
      commandSuccess: p('retro.powerup'), commandFailure: p('retro.gameover'),
      aiClaudeStart: p('retro.start'), aiClaudeEnd: p('retro.fanfare'),
      aiCodexStart: p('retro.start'), aiCodexEnd: p('retro.powerup'),
      aiCopilotStart: p('retro.select'), aiCopilotEnd: p('retro.coin'),
      aiPromptSend: p('retro.select'), aiOutput: p('retro.blip'),
      aiConfirm: p('retro.warn'), aiSelect: p('retro.blip'),
      aiApprove: p('retro.warn'), aiApproveDone: p('retro.powerup'),
      aiComplete: p('retro.fanfare'),
    },
  },
  {
    id: 'mechanicalKeyboard',
    label: 'Mechanical Keyboard',
    description: 'メカニカルキーボードの打鍵音。通知は控えめなベル。',
    map: {
      keyClick: p('mech.thock'), enter: p('mech.clack'), backspace: p('mech.back'),
      delete: p('mech.back'), space: p('mech.space'), tab: p('mech.tab'),
      paste: p('mech.clack'), undo: p('mech.tap'), redo: p('mech.tap'),
      fileSave: p('mech.ding'), fileOpen: p('mech.tap'),
      activeEditorChange: NONE, tabClose: p('mech.tap'),
      errorAppear: p('mech.err'), warningAppear: p('mech.warn2'),
      errorResolve: p('mech.ok'), warningResolve: p('mech.tap'),
      taskStart: p('mech.tap'), taskSuccess: p('mech.ok'), taskFailure: p('mech.ng'),
      terminalOpen: p('mech.tap'), terminalClose: p('mech.tap'),
      commandSuccess: p('mech.ok'), commandFailure: p('mech.ng'),
      aiClaudeStart: p('mech.tap'), aiClaudeEnd: p('mech.ding'),
      aiCodexStart: p('mech.tap'), aiCodexEnd: p('mech.ding'),
      aiCopilotStart: p('mech.tap'), aiCopilotEnd: p('mech.ok'),
      aiPromptSend: p('mech.tap'), aiOutput: p('mech.tap'),
      aiConfirm: p('mech.warn2'), aiSelect: p('mech.tap'),
      aiApprove: p('mech.warn2'), aiApproveDone: p('mech.ok'),
      aiComplete: p('mech.ding'),
    },
  },
  {
    id: 'sciFiConsole',
    label: 'Sci-Fi Console',
    description: 'SF映画のコンソール風。サイン波のスイープときらめき。',
    map: {
      keyClick: p('scifi.tick'), enter: p('scifi.confirm'), backspace: p('scifi.back2'),
      delete: p('scifi.back2'), space: p('scifi.spacetick'), tab: p('scifi.tick'),
      paste: p('scifi.datain'), undo: p('scifi.back2'), redo: p('scifi.confirm'),
      fileSave: p('scifi.save'), fileOpen: p('scifi.open'),
      activeEditorChange: p('scifi.spacetick'), tabClose: p('scifi.close2'),
      errorAppear: p('scifi.deny'), warningAppear: p('scifi.alert'),
      errorResolve: p('scifi.resolve'), warningResolve: p('scifi.resolve'),
      taskStart: p('scifi.scan'), taskSuccess: p('scifi.success'), taskFailure: p('scifi.failure'),
      terminalOpen: p('scifi.open'), terminalClose: p('scifi.close2'),
      commandSuccess: p('scifi.success'), commandFailure: p('scifi.failure'),
      aiClaudeStart: p('scifi.scan'), aiClaudeEnd: p('scifi.success'),
      aiCodexStart: p('scifi.scan'), aiCodexEnd: p('scifi.success'),
      aiCopilotStart: p('scifi.datain'), aiCopilotEnd: p('scifi.confirm'),
      aiPromptSend: p('scifi.datain'), aiOutput: p('scifi.tick'),
      aiConfirm: p('scifi.alert'), aiSelect: p('scifi.tick'),
      aiApprove: p('scifi.alert'), aiApproveDone: p('scifi.confirm'),
      aiComplete: p('scifi.success'),
    },
  },
  {
    id: 'robotTerminal',
    label: 'Robot Terminal',
    description: 'ロボット/ローファイ端末風。ノコギリ波の無骨な音。',
    map: {
      keyClick: p('robot.key'), enter: p('robot.enter'), backspace: p('robot.back'),
      delete: p('robot.back'), space: p('robot.key'), tab: p('robot.key'),
      paste: p('robot.ack'), undo: p('robot.off'), redo: p('robot.boot'),
      fileSave: p('robot.ack'), fileOpen: p('robot.boot'),
      activeEditorChange: NONE, tabClose: p('robot.off'),
      errorAppear: p('robot.err'), warningAppear: p('robot.warn'),
      errorResolve: p('robot.ok'), warningResolve: p('robot.ack'),
      taskStart: p('robot.boot'), taskSuccess: p('robot.ok'), taskFailure: p('robot.fail'),
      terminalOpen: p('robot.boot'), terminalClose: p('robot.off'),
      commandSuccess: p('robot.ok'), commandFailure: p('robot.fail'),
      aiClaudeStart: p('robot.boot'), aiClaudeEnd: p('robot.ok'),
      aiCodexStart: p('robot.boot'), aiCodexEnd: p('robot.ok'),
      aiCopilotStart: p('robot.ack'), aiCopilotEnd: p('robot.ok'),
      aiPromptSend: p('robot.ack'), aiOutput: p('robot.key'),
      aiConfirm: p('robot.warn'), aiSelect: p('robot.key'),
      aiApprove: p('robot.warn'), aiApproveDone: p('robot.ack'),
      aiComplete: p('robot.ok'),
    },
  },
  {
    id: 'minimalUi',
    label: 'Minimal UI',
    description: 'タイプ音なし。保存・エラーなどの要所だけ、ごく控えめに。',
    map: {
      keyClick: NONE, enter: NONE, backspace: NONE, delete: NONE,
      space: NONE, tab: NONE, paste: NONE, undo: NONE, redo: NONE,
      fileSave: p('min.save'), fileOpen: NONE,
      activeEditorChange: NONE, tabClose: NONE,
      errorAppear: p('min.error'), warningAppear: p('min.warn'),
      errorResolve: p('min.ok'), warningResolve: NONE,
      taskStart: NONE, taskSuccess: p('min.ok'), taskFailure: p('min.fail'),
      terminalOpen: NONE, terminalClose: NONE,
      commandSuccess: p('min.tap'), commandFailure: p('min.fail'),
      aiClaudeStart: NONE, aiClaudeEnd: p('min.ok'),
      aiCodexStart: NONE, aiCodexEnd: p('min.ok'),
      aiCopilotStart: NONE, aiCopilotEnd: p('min.tap'),
      aiPromptSend: NONE, aiOutput: NONE,
      aiConfirm: p('min.warn'), aiSelect: NONE,
      aiApprove: p('min.warn'), aiApproveDone: p('min.tap'),
      aiComplete: p('min.ok'),
    },
  },
  {
    id: 'alertHeavy',
    label: 'Alert Heavy',
    description: 'タイプ音なし。エラー・タスク・ビルド結果をはっきり通知。',
    map: {
      keyClick: NONE, enter: NONE, backspace: NONE, delete: NONE,
      space: NONE, tab: NONE, paste: NONE, undo: NONE, redo: NONE,
      fileSave: p('alert.notice'), fileOpen: NONE,
      activeEditorChange: NONE, tabClose: NONE,
      errorAppear: p('alert.error'), warningAppear: p('alert.warn'),
      errorResolve: p('alert.resolve'), warningResolve: p('alert.resolve'),
      taskStart: p('alert.notice'), taskSuccess: p('alert.success'), taskFailure: p('alert.fail'),
      terminalOpen: NONE, terminalClose: NONE,
      commandSuccess: p('alert.success'), commandFailure: p('alert.fail'),
      aiClaudeStart: p('alert.notice'), aiClaudeEnd: p('alert.success'),
      aiCodexStart: p('alert.notice'), aiCodexEnd: p('alert.success'),
      aiCopilotStart: p('alert.notice'), aiCopilotEnd: p('alert.success'),
      aiPromptSend: p('alert.notice'), aiOutput: NONE,
      aiConfirm: p('alert.warn'), aiSelect: NONE,
      aiApprove: p('alert.warn'), aiApproveDone: p('alert.notice'),
      aiComplete: p('alert.success'),
    },
  },
  {
    id: 'silentAssistant',
    label: 'Silent Assistant',
    description: 'すべて無音。一時的に静かにしたいときのプリセット。',
    map: {
      keyClick: NONE, enter: NONE, backspace: NONE, delete: NONE,
      space: NONE, tab: NONE, paste: NONE, undo: NONE, redo: NONE,
      fileSave: NONE, fileOpen: NONE, activeEditorChange: NONE, tabClose: NONE,
      errorAppear: NONE, warningAppear: NONE, errorResolve: NONE, warningResolve: NONE,
      taskStart: NONE, taskSuccess: NONE, taskFailure: NONE,
      terminalOpen: NONE, terminalClose: NONE, commandSuccess: NONE, commandFailure: NONE,
      aiClaudeStart: NONE, aiClaudeEnd: NONE, aiCodexStart: NONE, aiCodexEnd: NONE,
      aiCopilotStart: NONE, aiCopilotEnd: NONE,
      aiPromptSend: NONE, aiOutput: NONE, aiConfirm: NONE,
      aiSelect: NONE, aiApprove: NONE, aiApproveDone: NONE, aiComplete: NONE,
    },
  },
];

export const PRESET_MAP: Map<string, PresetTheme> = new Map(
  PRESET_THEMES.map((t) => [t.id, t])
);

/** プリセットからEventMap (全イベント分) を生成する */
export function buildEventMapFromPreset(presetId: PresetId): EventMap {
  const theme = PRESET_MAP.get(presetId) ?? PRESET_THEMES[0];
  const map: EventMap = {};
  for (const [eventId, sound] of Object.entries(theme.map) as [EventId, SoundRef][]) {
    map[eventId] = { sound, enabled: sound !== 'none' };
  }
  return map;
}
