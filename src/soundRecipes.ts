import { SoundRecipe } from './types';

/**
 * 生成音レシピ集。
 * mp3/wavは同梱せず、Web Audio API (Oscillator/Gain/Filter/Envelope) で
 * 実行時に合成するためのパラメータ定義。権利面の問題が出ない完全オリジナル音。
 *
 * レシピはAudio Engine Webviewへinitメッセージで転送され、
 * イベント発生時は事前定義済みパラメータから即時合成される (ファイルI/Oなし)。
 */
export const SOUND_RECIPES: SoundRecipe[] = [
  // ================= Classic PC (PCスピーカー風ビープ) =================
  { id: 'classic.key', label: 'Classic: キー', layers: [
    { wave: 'square', freq: 740, gain: 0.22, attack: 0.001, decay: 0.03 },
  ]},
  { id: 'classic.enter', label: 'Classic: Enter', layers: [
    { wave: 'square', freq: 520, freqEnd: 390, gain: 0.26, attack: 0.001, decay: 0.09 },
  ]},
  { id: 'classic.back', label: 'Classic: Backspace', layers: [
    { wave: 'square', freq: 300, gain: 0.2, attack: 0.001, decay: 0.04 },
  ]},
  { id: 'classic.space', label: 'Classic: Space', layers: [
    { wave: 'square', freq: 620, gain: 0.18, attack: 0.001, decay: 0.03 },
  ]},
  { id: 'classic.tab', label: 'Classic: Tab', layers: [
    { wave: 'square', freq: 840, gain: 0.18, attack: 0.001, decay: 0.035 },
  ]},
  { id: 'classic.paste', label: 'Classic: 2連ビープ↑', layers: [
    { wave: 'square', freq: 660, gain: 0.2, attack: 0.001, decay: 0.05 },
    { wave: 'square', freq: 880, gain: 0.2, attack: 0.001, decay: 0.06, delay: 0.07 },
  ]},
  { id: 'classic.undo', label: 'Classic: スイープ↓', layers: [
    { wave: 'square', freq: 700, freqEnd: 400, gain: 0.2, attack: 0.001, decay: 0.08 },
  ]},
  { id: 'classic.redo', label: 'Classic: スイープ↑', layers: [
    { wave: 'square', freq: 400, freqEnd: 700, gain: 0.2, attack: 0.001, decay: 0.08 },
  ]},
  { id: 'classic.save', label: 'Classic: 保存', layers: [
    { wave: 'square', freq: 660, gain: 0.24, attack: 0.001, decay: 0.06 },
    { wave: 'square', freq: 990, gain: 0.24, attack: 0.001, decay: 0.1, delay: 0.08 },
  ]},
  { id: 'classic.open', label: 'Classic: 開く', layers: [
    { wave: 'square', freq: 520, gain: 0.16, attack: 0.001, decay: 0.05 },
  ]},
  { id: 'classic.switch', label: 'Classic: 切替', layers: [
    { wave: 'square', freq: 470, gain: 0.13, attack: 0.001, decay: 0.04 },
  ]},
  { id: 'classic.close', label: 'Classic: 閉じる', layers: [
    { wave: 'square', freq: 390, gain: 0.16, attack: 0.001, decay: 0.05 },
  ]},
  { id: 'classic.error', label: 'Classic: エラーブザー', layers: [
    { wave: 'square', freq: 165, gain: 0.32, attack: 0.002, decay: 0.22 },
    { wave: 'square', freq: 110, gain: 0.26, attack: 0.002, decay: 0.2, delay: 0.06 },
  ]},
  { id: 'classic.warn', label: 'Classic: 警告', layers: [
    { wave: 'square', freq: 330, gain: 0.24, attack: 0.001, decay: 0.1 },
    { wave: 'square', freq: 330, gain: 0.24, attack: 0.001, decay: 0.1, delay: 0.16 },
  ]},
  { id: 'classic.errfix', label: 'Classic: エラー解消', layers: [
    { wave: 'sine', freq: 520, freqEnd: 780, gain: 0.24, attack: 0.002, decay: 0.12 },
  ]},
  { id: 'classic.warnfix', label: 'Classic: 警告解消', layers: [
    { wave: 'sine', freq: 460, freqEnd: 640, gain: 0.2, attack: 0.002, decay: 0.1 },
  ]},
  { id: 'classic.taskstart', label: 'Classic: タスク開始', layers: [
    { wave: 'square', freq: 440, gain: 0.2, attack: 0.001, decay: 0.05 },
    { wave: 'square', freq: 550, gain: 0.2, attack: 0.001, decay: 0.06, delay: 0.07 },
  ]},
  { id: 'classic.success', label: 'Classic: 成功', layers: [
    { wave: 'square', freq: 523, gain: 0.22, attack: 0.001, decay: 0.07 },
    { wave: 'square', freq: 659, gain: 0.22, attack: 0.001, decay: 0.07, delay: 0.08 },
    { wave: 'square', freq: 784, gain: 0.22, attack: 0.001, decay: 0.14, delay: 0.16 },
  ]},
  { id: 'classic.fail', label: 'Classic: 失敗', layers: [
    { wave: 'square', freq: 392, gain: 0.24, attack: 0.001, decay: 0.08 },
    { wave: 'square', freq: 311, gain: 0.24, attack: 0.001, decay: 0.08, delay: 0.1 },
    { wave: 'square', freq: 247, gain: 0.24, attack: 0.001, decay: 0.16, delay: 0.2 },
  ]},
  { id: 'classic.termopen', label: 'Classic: 端末開', layers: [
    { wave: 'square', freq: 600, gain: 0.16, attack: 0.001, decay: 0.05 },
  ]},
  { id: 'classic.termclose', label: 'Classic: 端末閉', layers: [
    { wave: 'square', freq: 480, gain: 0.16, attack: 0.001, decay: 0.05 },
  ]},

  // ================= Retro Game (8bit風) =================
  { id: 'retro.blip', label: 'Retro: ブリップ', layers: [
    { wave: 'square', freq: 980, gain: 0.2, attack: 0.001, decay: 0.025 },
  ]},
  { id: 'retro.jump', label: 'Retro: ジャンプ', layers: [
    { wave: 'square', freq: 250, freqEnd: 900, gain: 0.24, attack: 0.001, decay: 0.09 },
  ]},
  { id: 'retro.hit', label: 'Retro: ヒット', layers: [
    { wave: 'noise', gain: 0.3, attack: 0.001, decay: 0.05, filter: { type: 'bandpass', freq: 400, q: 1.2 } },
    { wave: 'square', freq: 140, gain: 0.22, attack: 0.001, decay: 0.05 },
  ]},
  { id: 'retro.space', label: 'Retro: Space', layers: [
    { wave: 'square', freq: 660, gain: 0.18, attack: 0.001, decay: 0.03 },
  ]},
  { id: 'retro.tab', label: 'Retro: Tab', layers: [
    { wave: 'square', freq: 1240, gain: 0.16, attack: 0.001, decay: 0.03 },
  ]},
  { id: 'retro.paste', label: 'Retro: アイテム', layers: [
    { wave: 'square', freq: 523, gain: 0.2, attack: 0.001, decay: 0.05 },
    { wave: 'square', freq: 784, gain: 0.2, attack: 0.001, decay: 0.07, delay: 0.06 },
  ]},
  { id: 'retro.undo', label: 'Retro: スイープ↓', layers: [
    { wave: 'square', freq: 800, freqEnd: 300, gain: 0.18, attack: 0.001, decay: 0.09 },
  ]},
  { id: 'retro.redo', label: 'Retro: スイープ↑', layers: [
    { wave: 'square', freq: 300, freqEnd: 800, gain: 0.18, attack: 0.001, decay: 0.09 },
  ]},
  { id: 'retro.coin', label: 'Retro: コイン', layers: [
    { wave: 'square', freq: 988, gain: 0.22, attack: 0.001, decay: 0.07 },
    { wave: 'square', freq: 1319, gain: 0.22, attack: 0.001, decay: 0.2, delay: 0.08 },
  ]},
  { id: 'retro.select', label: 'Retro: セレクト', layers: [
    { wave: 'square', freq: 1046, gain: 0.16, attack: 0.001, decay: 0.04 },
  ]},
  { id: 'retro.close', label: 'Retro: キャンセル', layers: [
    { wave: 'square', freq: 494, gain: 0.16, attack: 0.001, decay: 0.05 },
  ]},
  { id: 'retro.error', label: 'Retro: ダメージ', layers: [
    { wave: 'square', freq: 98, gain: 0.3, attack: 0.002, decay: 0.28 },
    { wave: 'square', freq: 104, gain: 0.24, attack: 0.002, decay: 0.26 },
  ]},
  { id: 'retro.warn', label: 'Retro: 注意', layers: [
    { wave: 'square', freq: 220, gain: 0.22, attack: 0.001, decay: 0.08 },
    { wave: 'square', freq: 220, gain: 0.22, attack: 0.001, decay: 0.08, delay: 0.13 },
  ]},
  { id: 'retro.powerup', label: 'Retro: パワーアップ', layers: [
    { wave: 'square', freq: 523, gain: 0.2, attack: 0.001, decay: 0.05 },
    { wave: 'square', freq: 659, gain: 0.2, attack: 0.001, decay: 0.05, delay: 0.05 },
    { wave: 'square', freq: 784, gain: 0.2, attack: 0.001, decay: 0.05, delay: 0.1 },
    { wave: 'square', freq: 1046, gain: 0.22, attack: 0.001, decay: 0.16, delay: 0.15 },
  ]},
  { id: 'retro.gameover', label: 'Retro: ゲームオーバー', layers: [
    { wave: 'square', freq: 494, gain: 0.22, attack: 0.001, decay: 0.1 },
    { wave: 'square', freq: 466, gain: 0.22, attack: 0.001, decay: 0.1, delay: 0.12 },
    { wave: 'square', freq: 440, gain: 0.22, attack: 0.001, decay: 0.1, delay: 0.24 },
    { wave: 'square', freq: 415, gain: 0.24, attack: 0.001, decay: 0.24, delay: 0.36 },
  ]},
  { id: 'retro.fanfare', label: 'Retro: ファンファーレ', layers: [
    { wave: 'square', freq: 784, gain: 0.2, attack: 0.001, decay: 0.06 },
    { wave: 'square', freq: 784, gain: 0.2, attack: 0.001, decay: 0.06, delay: 0.09 },
    { wave: 'square', freq: 784, gain: 0.2, attack: 0.001, decay: 0.06, delay: 0.18 },
    { wave: 'square', freq: 1046, gain: 0.24, attack: 0.001, decay: 0.22, delay: 0.27 },
  ]},
  { id: 'retro.start', label: 'Retro: スタート', layers: [
    { wave: 'square', freq: 659, gain: 0.2, attack: 0.001, decay: 0.05 },
    { wave: 'square', freq: 784, gain: 0.2, attack: 0.001, decay: 0.08, delay: 0.06 },
  ]},

  // ================= Mechanical Keyboard (打鍵音) =================
  { id: 'mech.thock', label: 'Mech: タクタイル', layers: [
    { wave: 'noise', gain: 0.45, attack: 0.001, decay: 0.035, filter: { type: 'lowpass', freq: 900, q: 0.8 } },
    { wave: 'sine', freq: 190, gain: 0.14, attack: 0.001, decay: 0.025 },
  ]},
  { id: 'mech.clack', label: 'Mech: クリッキー', layers: [
    { wave: 'noise', gain: 0.45, attack: 0.001, decay: 0.045, filter: { type: 'bandpass', freq: 1800, q: 1.0 } },
    { wave: 'sine', freq: 150, gain: 0.18, attack: 0.001, decay: 0.03 },
  ]},
  { id: 'mech.space', label: 'Mech: スペースバー', layers: [
    { wave: 'noise', gain: 0.5, attack: 0.001, decay: 0.05, filter: { type: 'lowpass', freq: 500, q: 0.7 } },
    { wave: 'sine', freq: 120, gain: 0.2, attack: 0.001, decay: 0.04 },
  ]},
  { id: 'mech.back', label: 'Mech: 軽打鍵', layers: [
    { wave: 'noise', gain: 0.38, attack: 0.001, decay: 0.03, filter: { type: 'bandpass', freq: 1200, q: 1.0 } },
  ]},
  { id: 'mech.tab', label: 'Mech: 高音打鍵', layers: [
    { wave: 'noise', gain: 0.34, attack: 0.001, decay: 0.03, filter: { type: 'bandpass', freq: 2400, q: 1.2 } },
  ]},
  { id: 'mech.ding', label: 'Mech: ベル', layers: [
    { wave: 'sine', freq: 1318, gain: 0.18, attack: 0.002, decay: 0.4 },
    { wave: 'sine', freq: 2637, gain: 0.06, attack: 0.002, decay: 0.25 },
  ]},
  { id: 'mech.err', label: 'Mech: 低音2連', layers: [
    { wave: 'sine', freq: 220, gain: 0.28, attack: 0.002, decay: 0.12 },
    { wave: 'sine', freq: 196, gain: 0.28, attack: 0.002, decay: 0.16, delay: 0.15 },
  ]},
  { id: 'mech.warn2', label: 'Mech: 中音1打', layers: [
    { wave: 'sine', freq: 392, gain: 0.24, attack: 0.002, decay: 0.14 },
  ]},
  { id: 'mech.ok', label: 'Mech: 上昇2音', layers: [
    { wave: 'sine', freq: 880, gain: 0.2, attack: 0.002, decay: 0.09 },
    { wave: 'sine', freq: 1108, gain: 0.2, attack: 0.002, decay: 0.16, delay: 0.1 },
  ]},
  { id: 'mech.ng', label: 'Mech: 下降2音', layers: [
    { wave: 'sine', freq: 494, gain: 0.24, attack: 0.002, decay: 0.09 },
    { wave: 'sine', freq: 370, gain: 0.24, attack: 0.002, decay: 0.16, delay: 0.1 },
  ]},
  { id: 'mech.tap', label: 'Mech: ソフトタップ', layers: [
    { wave: 'sine', freq: 780, gain: 0.12, attack: 0.001, decay: 0.05 },
  ]},

  // ================= Sci-Fi Console =================
  { id: 'scifi.tick', label: 'SciFi: ティック', layers: [
    { wave: 'sine', freq: 1800, gain: 0.13, attack: 0.001, decay: 0.02 },
    { wave: 'noise', gain: 0.08, attack: 0.001, decay: 0.012, filter: { type: 'highpass', freq: 6000 } },
  ]},
  { id: 'scifi.confirm', label: 'SciFi: 確定', layers: [
    { wave: 'sine', freq: 700, freqEnd: 1400, gain: 0.2, attack: 0.002, decay: 0.08 },
  ]},
  { id: 'scifi.back2', label: 'SciFi: 消去', layers: [
    { wave: 'sine', freq: 1200, freqEnd: 600, gain: 0.16, attack: 0.001, decay: 0.06 },
  ]},
  { id: 'scifi.spacetick', label: 'SciFi: 低ティック', layers: [
    { wave: 'sine', freq: 900, gain: 0.13, attack: 0.001, decay: 0.025 },
  ]},
  { id: 'scifi.datain', label: 'SciFi: データ入力', layers: [
    { wave: 'sine', freq: 1100, gain: 0.14, attack: 0.001, decay: 0.04 },
    { wave: 'sine', freq: 1650, gain: 0.14, attack: 0.001, decay: 0.05, delay: 0.05 },
  ]},
  { id: 'scifi.save', label: 'SciFi: 記録', layers: [
    { wave: 'sine', freq: 880, gain: 0.18, attack: 0.002, decay: 0.12 },
    { wave: 'sine', freq: 1320, gain: 0.14, attack: 0.002, decay: 0.18, delay: 0.02 },
  ]},
  { id: 'scifi.deny', label: 'SciFi: 拒否', layers: [
    { wave: 'sawtooth', freq: 200, freqEnd: 90, gain: 0.26, attack: 0.003, decay: 0.25, filter: { type: 'lowpass', freq: 800, q: 1 } },
  ]},
  { id: 'scifi.alert', label: 'SciFi: アラート', layers: [
    { wave: 'triangle', freq: 620, gain: 0.24, attack: 0.002, decay: 0.09 },
    { wave: 'triangle', freq: 780, gain: 0.24, attack: 0.002, decay: 0.12, delay: 0.11 },
  ]},
  { id: 'scifi.resolve', label: 'SciFi: 解消', layers: [
    { wave: 'sine', freq: 660, freqEnd: 990, gain: 0.18, attack: 0.002, decay: 0.14 },
    { wave: 'sine', freq: 990, freqEnd: 1485, gain: 0.1, attack: 0.002, decay: 0.14, delay: 0.06 },
  ]},
  { id: 'scifi.scan', label: 'SciFi: スキャン', layers: [
    { wave: 'sine', freq: 300, freqEnd: 2400, gain: 0.13, attack: 0.005, decay: 0.2 },
  ]},
  { id: 'scifi.success', label: 'SciFi: 完了', layers: [
    { wave: 'sine', freq: 660, gain: 0.16, attack: 0.002, decay: 0.3 },
    { wave: 'sine', freq: 830, gain: 0.14, attack: 0.002, decay: 0.3, delay: 0.05 },
    { wave: 'sine', freq: 990, gain: 0.14, attack: 0.002, decay: 0.35, delay: 0.1 },
  ]},
  { id: 'scifi.failure', label: 'SciFi: 失敗', layers: [
    { wave: 'triangle', freq: 500, freqEnd: 180, gain: 0.24, attack: 0.002, decay: 0.3 },
    { wave: 'sine', freq: 90, gain: 0.2, attack: 0.01, decay: 0.3, delay: 0.05 },
  ]},
  { id: 'scifi.open', label: 'SciFi: 起動', layers: [
    { wave: 'sine', freq: 500, freqEnd: 1100, gain: 0.15, attack: 0.002, decay: 0.1 },
  ]},
  { id: 'scifi.close2', label: 'SciFi: 停止', layers: [
    { wave: 'sine', freq: 1100, freqEnd: 500, gain: 0.15, attack: 0.002, decay: 0.1 },
  ]},

  // ================= Robot Terminal (ローファイ端末風) =================
  { id: 'robot.key', label: 'Robot: キー', layers: [
    { wave: 'sawtooth', freq: 210, gain: 0.2, attack: 0.001, decay: 0.02, filter: { type: 'lowpass', freq: 1200, q: 0.8 } },
  ]},
  { id: 'robot.enter', label: 'Robot: 実行', layers: [
    { wave: 'sawtooth', freq: 160, gain: 0.22, attack: 0.001, decay: 0.06, filter: { type: 'lowpass', freq: 900 } },
    { wave: 'sawtooth', freq: 320, gain: 0.18, attack: 0.001, decay: 0.05, delay: 0.06, filter: { type: 'lowpass', freq: 1400 } },
  ]},
  { id: 'robot.back', label: 'Robot: 削除', layers: [
    { wave: 'square', freq: 190, gain: 0.18, attack: 0.001, decay: 0.03, filter: { type: 'lowpass', freq: 1000 } },
  ]},
  { id: 'robot.ack', label: 'Robot: ACK', layers: [
    { wave: 'square', freq: 440, gain: 0.2, attack: 0.001, decay: 0.03 },
    { wave: 'square', freq: 440, gain: 0.2, attack: 0.001, decay: 0.03, delay: 0.06 },
  ]},
  { id: 'robot.err', label: 'Robot: ERR', layers: [
    { wave: 'sawtooth', freq: 82, gain: 0.32, attack: 0.003, decay: 0.18, filter: { type: 'lowpass', freq: 400, q: 1.2 } },
    { wave: 'sawtooth', freq: 82, gain: 0.28, attack: 0.003, decay: 0.2, delay: 0.14, filter: { type: 'lowpass', freq: 400, q: 1.2 } },
  ]},
  { id: 'robot.warn', label: 'Robot: WARN', layers: [
    { wave: 'square', freq: 262, gain: 0.22, attack: 0.002, decay: 0.08 },
    { wave: 'square', freq: 262, gain: 0.22, attack: 0.002, decay: 0.08, delay: 0.12 },
  ]},
  { id: 'robot.ok', label: 'Robot: OK', layers: [
    { wave: 'square', freq: 392, gain: 0.2, attack: 0.001, decay: 0.06 },
    { wave: 'square', freq: 523, gain: 0.2, attack: 0.001, decay: 0.1, delay: 0.08 },
  ]},
  { id: 'robot.fail', label: 'Robot: FAIL', layers: [
    { wave: 'sawtooth', freq: 300, freqEnd: 100, gain: 0.26, attack: 0.002, decay: 0.2, filter: { type: 'lowpass', freq: 1000 } },
  ]},
  { id: 'robot.boot', label: 'Robot: 起動', layers: [
    { wave: 'sawtooth', freq: 100, freqEnd: 400, gain: 0.2, attack: 0.005, decay: 0.15, filter: { type: 'lowpass', freq: 1200 } },
  ]},
  { id: 'robot.off', label: 'Robot: 停止', layers: [
    { wave: 'sawtooth', freq: 400, freqEnd: 100, gain: 0.2, attack: 0.005, decay: 0.15, filter: { type: 'lowpass', freq: 1200 } },
  ]},

  // ================= Minimal UI (ごく控えめ) =================
  { id: 'min.tap', label: 'Minimal: タップ', layers: [
    { wave: 'sine', freq: 1000, gain: 0.07, attack: 0.001, decay: 0.015 },
  ]},
  { id: 'min.save', label: 'Minimal: 保存', layers: [
    { wave: 'sine', freq: 1200, gain: 0.11, attack: 0.002, decay: 0.08 },
  ]},
  { id: 'min.error', label: 'Minimal: エラー', layers: [
    { wave: 'sine', freq: 320, gain: 0.16, attack: 0.002, decay: 0.1 },
    { wave: 'sine', freq: 320, gain: 0.16, attack: 0.002, decay: 0.1, delay: 0.13 },
  ]},
  { id: 'min.warn', label: 'Minimal: 警告', layers: [
    { wave: 'sine', freq: 480, gain: 0.11, attack: 0.002, decay: 0.08 },
  ]},
  { id: 'min.ok', label: 'Minimal: 成功', layers: [
    { wave: 'sine', freq: 900, freqEnd: 1200, gain: 0.1, attack: 0.002, decay: 0.1 },
  ]},
  { id: 'min.fail', label: 'Minimal: 失敗', layers: [
    { wave: 'sine', freq: 400, freqEnd: 300, gain: 0.13, attack: 0.002, decay: 0.12 },
  ]},

  // ================= Alert Heavy (通知強め) =================
  { id: 'alert.error', label: 'Alert: エラー', layers: [
    { wave: 'square', freq: 440, gain: 0.4, attack: 0.002, decay: 0.1 },
    { wave: 'square', freq: 330, gain: 0.4, attack: 0.002, decay: 0.1, delay: 0.12 },
    { wave: 'square', freq: 440, gain: 0.4, attack: 0.002, decay: 0.16, delay: 0.24 },
    { wave: 'sine', freq: 110, gain: 0.3, attack: 0.002, decay: 0.35 },
  ]},
  { id: 'alert.warn', label: 'Alert: 警告', layers: [
    { wave: 'triangle', freq: 520, gain: 0.36, attack: 0.002, decay: 0.16 },
    { wave: 'triangle', freq: 520, gain: 0.36, attack: 0.002, decay: 0.2, delay: 0.22 },
  ]},
  { id: 'alert.success', label: 'Alert: 成功', layers: [
    { wave: 'square', freq: 523, gain: 0.32, attack: 0.001, decay: 0.08 },
    { wave: 'square', freq: 659, gain: 0.32, attack: 0.001, decay: 0.08, delay: 0.09 },
    { wave: 'square', freq: 784, gain: 0.32, attack: 0.001, decay: 0.08, delay: 0.18 },
    { wave: 'square', freq: 1046, gain: 0.34, attack: 0.001, decay: 0.22, delay: 0.27 },
  ]},
  { id: 'alert.fail', label: 'Alert: 失敗', layers: [
    { wave: 'square', freq: 415, gain: 0.36, attack: 0.001, decay: 0.1 },
    { wave: 'square', freq: 349, gain: 0.36, attack: 0.001, decay: 0.1, delay: 0.12 },
    { wave: 'square', freq: 277, gain: 0.38, attack: 0.001, decay: 0.22, delay: 0.24 },
    { wave: 'noise', gain: 0.2, attack: 0.001, decay: 0.08, filter: { type: 'bandpass', freq: 600, q: 1 } },
  ]},
  { id: 'alert.notice', label: 'Alert: 通知', layers: [
    { wave: 'triangle', freq: 600, gain: 0.28, attack: 0.002, decay: 0.1 },
  ]},
  { id: 'alert.resolve', label: 'Alert: 解消', layers: [
    { wave: 'sine', freq: 620, freqEnd: 930, gain: 0.26, attack: 0.002, decay: 0.16 },
  ]},
];

export const RECIPE_MAP: Map<string, SoundRecipe> = new Map(
  SOUND_RECIPES.map((r) => [r.id, r])
);

export function isValidRecipeId(id: string): boolean {
  return RECIPE_MAP.has(id);
}
