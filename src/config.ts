import * as vscode from 'vscode';
import {
  ALL_EVENT_IDS, CustomSlot, EngineConfig, EventId, EventMap, EventSetting,
  MAX_SLOT_COUNT, MAX_USER_PRESETS, MIN_SLOT_COUNT, SoundRef, USER_PRESET_PREFIX,
  UserPreset,
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

function defaultSlot(id: number): CustomSlot {
  return {
    id,
    name: `カスタム${id}`,
    enabled: true,
    type: 'none',
    filePath: '',
    volume: 0.8,
    cooldownMs: 50,
    description: '',
  };
}

export function defaultSlots(count = MIN_SLOT_COUNT): CustomSlot[] {
  const slots: CustomSlot[] = [];
  for (let i = 1; i <= count; i++) {
    slots.push(defaultSlot(i));
  }
  return slots;
}

/**
 * 保存値がどんな形でもスロット配列 (連番id、10〜100枠) に正規化する。
 * 枠数は保存されている最大idを維持する (最低10、最大100)。
 */
export function normalizeSlots(raw: unknown): CustomSlot[] {
  if (!Array.isArray(raw)) {
    return defaultSlots();
  }
  let maxId = MIN_SLOT_COUNT;
  for (const item of raw) {
    if (!item || typeof item !== 'object') { continue; }
    const id = typeof (item as { id?: unknown }).id === 'number'
      ? Math.floor((item as { id: number }).id) : NaN;
    if (!Number.isNaN(id) && id > maxId && id <= MAX_SLOT_COUNT) { maxId = id; }
  }
  const slots = defaultSlots(maxId);
  for (const item of raw) {
    if (!item || typeof item !== 'object') { continue; }
    const o = item as Partial<CustomSlot>;
    const id = typeof o.id === 'number' ? Math.floor(o.id) : NaN;
    if (id < 1 || id > maxId || Number.isNaN(id)) { continue; }
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

/** スロットを1枠追加する (最大100)。追加したスロットを返す。 */
export async function addSlot(): Promise<CustomSlot | undefined> {
  const slots = getSlots();
  if (slots.length >= MAX_SLOT_COUNT) { return undefined; }
  const slot = defaultSlot(slots.length + 1);
  slots.push(slot);
  await saveSlots(slots);
  return slot;
}

/** 末尾のスロットを削除する (10枠までは削除不可)。削除したら true。 */
export async function removeLastSlot(): Promise<boolean> {
  const slots = getSlots();
  if (slots.length <= MIN_SLOT_COUNT) { return false; }
  slots.pop();
  await saveSlots(slots);
  return true;
}

// ---- プリセット (組み込み + ユーザー保存) ----

/**
 * 現在のプリセットキー。組み込みのPresetId または 'user:<id>'。
 * 保存値が不正 (存在しないユーザープリセット等) なら 'classicPc' に落とす。
 */
export function getPresetKey(): string {
  const key = cfg().get<string>('preset', 'classicPc');
  if (PRESET_MAP.has(key)) { return key; }
  if (key.startsWith(USER_PRESET_PREFIX)) {
    const id = key.slice(USER_PRESET_PREFIX.length);
    if (getUserPresets().some((p) => p.id === id)) { return key; }
  }
  return 'classicPc';
}

export function getPresetLabel(): string {
  const key = getPresetKey();
  if (key.startsWith(USER_PRESET_PREFIX)) {
    const id = key.slice(USER_PRESET_PREFIX.length);
    return getUserPresets().find((p) => p.id === id)?.label ?? key;
  }
  return PRESET_MAP.get(key)?.label ?? key;
}

function normalizeEventMap(raw: unknown): EventMap {
  const map: EventMap = {};
  if (!raw || typeof raw !== 'object') { return map; }
  for (const eventId of ALL_EVENT_IDS) {
    const entry = (raw as Record<string, unknown>)[eventId];
    if (!entry || typeof entry !== 'object') { continue; }
    const e = entry as { sound?: unknown; enabled?: unknown };
    const sound = normalizeSoundRef(e.sound);
    if (sound !== undefined) {
      map[eventId] = { sound, enabled: e.enabled !== false };
    }
  }
  return map;
}

export function normalizeUserPresets(raw: unknown): UserPreset[] {
  if (!Array.isArray(raw)) { return []; }
  const result: UserPreset[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') { continue; }
    const o = item as Partial<UserPreset>;
    if (typeof o.id !== 'string' || !o.id.trim() || seen.has(o.id)) { continue; }
    if (typeof o.label !== 'string' || !o.label.trim()) { continue; }
    seen.add(o.id);
    result.push({
      id: o.id,
      label: o.label.slice(0, 40),
      map: normalizeEventMap(o.map),
    });
    if (result.length >= MAX_USER_PRESETS) { break; }
  }
  return result;
}

export function getUserPresets(): UserPreset[] {
  return normalizeUserPresets(cfg().get('userPresets'));
}

export async function saveUserPresets(presets: UserPreset[]): Promise<void> {
  await cfg().update('userPresets', presets, vscode.ConfigurationTarget.Global);
}

/** 現在のイベント割り当てをユーザープリセットとして保存し、そのプリセットを選択状態にする */
export async function saveCurrentAsUserPreset(label: string): Promise<UserPreset> {
  const presets = getUserPresets();
  if (presets.length >= MAX_USER_PRESETS) {
    throw new Error(`ユーザープリセットは最大${MAX_USER_PRESETS}件です。`);
  }
  const preset: UserPreset = {
    id: 'u' + Date.now().toString(36),
    label: label.slice(0, 40),
    map: getEventMap(),
  };
  presets.push(preset);
  await saveUserPresets(presets);
  await cfg().update('preset', USER_PRESET_PREFIX + preset.id, vscode.ConfigurationTarget.Global);
  return preset;
}

export async function deleteUserPreset(id: string): Promise<void> {
  // 削除対象が選択中でも音が変わらないよう、先に現在の全割り当てを実体化して保存する
  const currentKey = getPresetKey();
  if (currentKey === USER_PRESET_PREFIX + id) {
    await saveEventMap(getEventMap());
    await cfg().update('preset', 'classicPc', vscode.ConfigurationTarget.Global);
  }
  await saveUserPresets(getUserPresets().filter((p) => p.id !== id));
}

function normalizeSoundRef(v: unknown): SoundRef | undefined {
  if (typeof v !== 'string') { return undefined; }
  if (v === 'none') { return v; }
  if (v.startsWith('preset:') && isValidRecipeId(v.slice(7))) { return v; }
  if (v.startsWith('slot:')) {
    const n = Number(v.slice(5));
    if (Number.isInteger(n) && n >= 1 && n <= MAX_SLOT_COUNT) { return v; }
  }
  return undefined;
}

/** 現在のプリセットキーに対応するデフォルトのイベント割り当て */
function buildBaseEventMap(): EventMap {
  const key = getPresetKey();
  if (key.startsWith(USER_PRESET_PREFIX)) {
    const id = key.slice(USER_PRESET_PREFIX.length);
    const preset = getUserPresets().find((p) => p.id === id);
    if (preset) { return preset.map; }
  }
  return buildEventMapFromPreset(key as PresetId);
}

/**
 * イベント割り当てを取得する。
 * 保存済みのeventMapを現在のプリセットのデフォルトに重ねて全イベント分を返す。
 */
export function getEventMap(): Record<EventId, EventSetting> {
  const base = buildBaseEventMap();
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

/**
 * プリセットを一括適用する (preset設定 + eventMap上書き)。
 * key は組み込みPresetId または 'user:<id>'。
 */
export async function applyPreset(key: string): Promise<void> {
  let map: EventMap | undefined;
  if (PRESET_MAP.has(key)) {
    map = buildEventMapFromPreset(key as PresetId);
  } else if (key.startsWith(USER_PRESET_PREFIX)) {
    const id = key.slice(USER_PRESET_PREFIX.length);
    map = getUserPresets().find((p) => p.id === id)?.map;
  }
  if (!map) {
    throw new Error(`不明なプリセットです: ${key}`);
  }
  await cfg().update('preset', key, vscode.ConfigurationTarget.Global);
  await saveEventMap(map);
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
    'eventMap', 'customSlots', 'userPresets',
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
    preset: getPresetKey(),
    userPresets: getUserPresets(),
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
  if (Array.isArray(o.userPresets)) {
    await saveUserPresets(normalizeUserPresets(o.userPresets));
  }
  if (typeof o.preset === 'string'
    && (PRESET_MAP.has(o.preset) || o.preset.startsWith(USER_PRESET_PREFIX))) {
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
    await saveEventMap(normalizeEventMap(o.eventMap));
  }
}
