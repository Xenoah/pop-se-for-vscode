import { AudioChannel, EVENT_CATEGORY, EventId, EventSetting, CustomSlot } from './types';
import { getEventMap, getSettings, getSlots, HostSettings } from './config';
import { AudioEngineHost } from './audioEngineHost';
import { debug } from './log';

/**
 * イベントID → soundId 変換と再生ゲート。
 * 設定はキャッシュし、イベント発生ごとの設定読み込みを避ける (低遅延設計)。
 * ログにはイベント名と状態のみを出し、入力内容は一切含めない。
 */
export class SoundService {
  private settings: HostSettings;
  private eventMap: Record<EventId, EventSetting>;
  private slots: CustomSlot[];
  private lastPlayed = new Map<EventId, number>();

  constructor(private readonly engine: AudioEngineHost) {
    this.settings = getSettings();
    this.eventMap = getEventMap();
    this.slots = getSlots();
  }

  /** 設定変更時に呼ぶ。キャッシュを更新しエンジンへも反映する。 */
  refresh(): void {
    this.settings = getSettings();
    this.eventMap = getEventMap();
    this.slots = getSlots();
    this.engine.refreshConfig();
    if (!this.settings.enabled) {
      this.engine.stopAll();
    }
    debug('config cache refreshed');
  }

  getCachedSettings(): HostSettings {
    return this.settings;
  }

  /** イベント発生 → 音再生。すべてのゲートを通過したときのみWebviewへ送る。 */
  playEvent(eventId: EventId): void {
    const s = this.settings;
    if (!s.enabled) { return; }

    const category = EVENT_CATEGORY[eventId];
    const isTyping = category === 'typing';
    if (isTyping && !s.typingEnabled) { return; }

    const setting = this.eventMap[eventId];
    if (!setting || !setting.enabled || setting.sound === 'none') { return; }

    // ホスト側cooldown: Webviewへのメッセージ送出自体を間引く
    const now = Date.now();
    const cooldown = isTyping
      ? s.typingCooldownMs
      : category === 'diagnostics'
        ? s.diagnosticsCooldownMs
        : s.notificationCooldownMs;
    const last = this.lastPlayed.get(eventId) ?? 0;
    if (now - last < cooldown) { return; }
    this.lastPlayed.set(eventId, now);

    // スロット参照は無効スロット/type:noneを弾く
    if (setting.sound.startsWith('slot:')) {
      const slotId = Number(setting.sound.slice(5));
      const slot = this.slots[slotId - 1];
      if (!slot || !slot.enabled || slot.type === 'none') { return; }
    }

    const channel: AudioChannel = isTyping ? 'typing' : 'notification';
    debug(`event: ${eventId} -> ${setting.sound}`);
    this.engine.play(setting.sound, channel, {
      typing: isTyping,
      pitchRand: eventId === 'keyClick' && s.typingPitchRandomization,
    });
  }
}
