import * as vscode from 'vscode';
import {
  ALL_EVENT_IDS, CustomSlot, EngineConfig, EventId, EventMap, EventSetting,
  SLOT_COUNT, SoundRef,
} from './types';
import { buildEventMapFromPreset, PRESET_MAP, PresetId } from './presets';
import { isValidRecipeId } from './soundRecipes';

const SECTION = 'popSe';

function cfg(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration(SECTION);
}

function clamp01(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : fallback;
  return Math.min(1, Math.max(0, n));
}

export function defaultSlots(): CustomSlot[] {
  const slots: CustomSlot[] = [];
  for (let i = 1; i <= SLOT_COUNT; i++) {
    slots.push({
      id: i,
      name: `カスタム${i}`,
      enabled: true,
      type: 'none',
      filePath: '',
      volume: 0.8,
      cooldownMs: 50,
      description: '',
    });
  }
  return slots;
}

/** 保存値がどんな形でも固定10枠のスロット配列に正規化する */
export function normalizeSlots(raw: unknown): CustomSlot[] {
  const slots = defaultSlots();
  if (!Array.isArray(raw)) {
    return slots;
  }
  for (const item of raw) {
    if (!item || typeof item !== 'object') { continue; }
    const o = item as Partial<CustomSlot>;
    const id = typeof o.id === 'number' ? Math.floor(o.id) : NaN;
    if (id < 1 || id > SLOT_COUNT || Number.isNaN(id)) { continue; }
    const slot = slots[id - 1];
    if (typeof o.name === 'string' && o.name.trim()) { slot.name = o.name.slice(0, 60); }
    if (typeof o.enabled === 'boolean') { slot.enabled = o.enabled; }
    if (o.type === 'none' || o.type === 'file' || o.type === 'generated') { slot.type = o.type; }
    if (typeof o.filePath === 'string') { slot.filePath = o.filePath; }
    slot.volume = clamp01(o.volume, slot.volume);
    if (typeof o.cooldownMs === 'number' && o.cooldownMs >= 0) {
      slot.cooldownMs = Math.min(60000, Math.floor(o.cooldownMs));
    }
    if (typeof o.description === 'string') { slot.description = o.description.slice(0, 200); }
    // generated型なのにレシピIDが不正なら無効扱いに落とす
    if (slot.type === 'generated' && !isValidRecipeId(slot.filePath)) { slot.type = 'none'; }
  }
  return slots;
}

export function getSlots(): CustomSlot[] {
  return normalizeSlots(cfg().get('customSlots'));
}

export async function saveSlots(slots: CustomSlot[]): Promise<void> {
  await cfg().update('customSlots', slots, vscode.ConfigurationTarget.Global);
}

export function getPresetId(): PresetId {
  const id = cfg().get<string>('preset', 'classicPc');
  return (PRESET_MAP.has(id) ? id : 'classicPc') as PresetId;
}

function normalizeSoundRef(v: unknown): SoundRef | undefined {
  if (typeof v !== 'string') { return undefined; }
  if (v === 'none') { return v; }
  if (v.startsWith('preset:') && isValidRecipeId(v.slice(7))) { return v; }
  if (v.startsWith('slot:')) {
    const n = Number(v.slice(5));
    if (Number.isInteger(n) && n >= 1 && n <= SLOT_COUNT) { return v; }
  }
  return undefined;
}

/**
 * イベント割り当てを取得する。
 * 保存済みのeventMapを現在のプリセットのデフォルトに重ねて全イベント分を返す。
 */
export function getEventMap(): Record<EventId, EventSetting> {
  const base = buildEventMapFromPreset(getPresetId());
  const stored = cfg().get<Record<string, unknown>>('eventMap', {});
  const result = {} as Record<EventId, EventSetting>;
  for (const eventId of ALL_EVENT_IDS) {
    const def = base[eventId] ?? { sound: 'none', enabled: false };
    const raw = stored?.[eventId];
    if (raw && typeof raw === 'object') {
      const o = raw as { sound?: unknown; enabled?: unknown };
      const sound = normalizeSoundRef(o.sound) ?? def.sound;
      const enabled = typeof o.enabled === 'boolean' ? o.enabled : def.enabled;
      result[eventId] = { sound, enabled };
    } else {
      result[eventId] = { ...def };
    }
  }
  return result;
}

export async function saveEventMap(map: EventMap): Promise<void> {
  await cfg().update('eventMap', map, vscode.ConfigurationTarget.Global);
}

/** プリセットを一括適用する (preset設定 + eventMap上書き) */
export async function applyPreset(presetId: PresetId): Promise<void> {
  await cfg().update('preset', presetId, vscode.ConfigurationTarget.Global);
  await saveEventMap(buildEventMapFromPreset(presetId));
}

export interface HostSettings {
  enabled: boolean;
  masterVolume: number;
  typingEnabled: boolean;
  typingVolume: number;
  notificationVolume: number;
  typingPitchRandomization: boolean;
  typingCooldownMs: number;
  typingMaxVoices: number;
  notificationCooldownMs: number;
  diagnosticsCooldownMs: number;
  lowLatencyMode: boolean;
  autoStartEngine: boolean;
  debugLog: boolean;
}

export function getSettings(): HostSettings {
  const c = cfg();
  return {
    enabled: c.get('enabled', true),
    masterVolume: clamp01(c.get('masterVolume'), 0.6),
    typingEnabled: c.get('typing.enabled', true),
    typingVolume: clamp01(c.get('typing.volume'), 0.5),
    notificationVolume: clamp01(c.get('notification.volume'), 0.7),
    typingPitchRandomization: c.get('typing.pitchRandomization', true),
    typingCooldownMs: Math.max(0, c.get('typing.cooldownMs', 25)),
    typingMaxVoices: Math.max(1, c.get('typing.maxVoices', 8)),
    notificationCooldownMs: 150,
    diagnosticsCooldownMs: Math.max(0, c.get('diagnostics.cooldownMs', 1500)),
    lowLatencyMode: c.get('lowLatencyMode', true),
    autoStartEngine: c.get('autoStartEngine', true),
    debugLog: c.get('debugLog', false),
  };
}

/** Audio Engine Webviewに渡す設定スナップショット */
export function buildEngineConfig(): EngineConfig {
  const s = getSettings();
  return {
    enabled: s.enabled,
    masterVolume: s.masterVolume,
    typingEnabled: s.typingEnabled,
    typingVolume: s.typingVolume,
    notificationVolume: s.notificationVolume,
    typingPitchRandomization: s.typingPitchRandomization,
    typingCooldownMs: s.typingCooldownMs,
    typingMaxVoices: s.typingMaxVoices,
    lowLatencyMode: s.lowLatencyMode,
    debugLog: s.debugLog,
    slots: getSlots(),
  };
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await cfg().update(key, value, vscode.ConfigurationTarget.Global);
}

/** オールリセット: 拡張のすべての設定をデフォルトに戻す (確認は呼び出し側で取る) */
export async function resetAllSettings(): Promise<void> {
  const keys = [
    'enabled', 'masterVolume', 'preset',
    'typing.enabled', 'typing.volume', 'typing.pitchRandomization',
    'typing.cooldownMs', 'typing.maxVoices',
    'notification.volume', 'diagnostics.cooldownMs',
    'lowLatencyMode', 'autoStartEngine', 'debugLog',
    'eventMap', 'customSlots',
  ];
  const c = cfg();
  for (const key of keys) {
    await c.update(key, undefined, vscode.ConfigurationTarget.Global);
  }
}

/** エクスポート用の全設定スナップショット */
export function exportSnapshot(): Record<string, unknown> {
  const s = getSettings();
  return {
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    preset: getPresetId(),
    settings: {
      enabled: s.enabled,
      masterVolume: s.masterVolume,
      'typing.enabled': s.typingEnabled,
      'typing.volume': s.typingVolume,
      'typing.pitchRandomization': s.typingPitchRandomization,
      'typing.cooldownMs': s.typingCooldownMs,
      'typing.maxVoices': s.typingMaxVoices,
      'notification.volume': s.notificationVolume,
      'diagnostics.cooldownMs': s.diagnosticsCooldownMs,
      lowLatencyMode: s.lowLatencyMode,
      autoStartEngine: s.autoStartEngine,
      debugLog: s.debugLog,
    },
    eventMap: getEventMap(),
    customSlots: getSlots(),
  };
}

/** インポート: スナップショットを検証して適用する。不正値は握りつぶさずエラーにする。 */
export async function importSnapshot(data: unknown): Promise<void> {
  if (!data || typeof data !== 'object') {
    throw new Error('JSONの形式が不正です。');
  }
  const o = data as Record<string, unknown>;
  if (o.formatVersion !== 1) {
    throw new Error('未対応のformatVersionです (対応: 1)。');
  }
  const c = cfg();
  if (typeof o.preset === 'string' && PRESET_MAP.has(o.preset)) {
    await c.update('preset', o.preset, vscode.ConfigurationTarget.Global);
  }
  const settings = (o.settings ?? {}) as Record<string, unknown>;
  const boolKeys = ['enabled', 'typing.enabled', 'typing.pitchRandomization', 'lowLatencyMode', 'autoStartEngine', 'debugLog'];
  const numKeys = ['masterVolume', 'typing.volume', 'typing.cooldownMs', 'typing.maxVoices', 'notification.volume', 'diagnostics.cooldownMs'];
  for (const key of boolKeys) {
    if (typeof settings[key] === 'boolean') {
      await c.update(key, settings[key], vscode.ConfigurationTarget.Global);
    }
  }
  for (const key of numKeys) {
    if (typeof settings[key] === 'number') {
      await c.update(key, settings[key], vscode.ConfigurationTarget.Global);
    }
  }
  await saveSlots(normalizeSlots(o.customSlots));
  if (o.eventMap && typeof o.eventMap === 'object') {
    const map: EventMap = {};
    for (const eventId of ALL_EVENT_IDS) {
      const raw = (o.eventMap as Record<string, unknown>)[eventId];
      if (raw && typeof raw === 'object') {
        const e = raw as { sound?: unknown; enabled?: unknown };
        const sound = normalizeSoundRef(e.sound);
        if (sound !== undefined) {
          map[eventId] = { sound, enabled: e.enabled !== false };
        }
      }
    }
    await saveEventMap(map);
  }
}
