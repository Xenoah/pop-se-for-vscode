// Pop SE — Audio Engine (Webview側)
// Web Audio APIによる再生エンジン。
// - プリセット電子音: initで受け取ったレシピから即時合成 (ファイルI/Oなし)
// - カスタム音: loadSlotで受け取ったバイト列をAudioBufferにデコードしてキャッシュ
// - タイプ音: 低遅延チャンネル (同時再生数制限 / cooldown / 短音優先 / 間引き / ピッチランダム化)
(function () {
  'use strict';

  const vscode = acquireVsCodeApi();

  /** @type {AudioContext | null} */
  let ctx = null;
  let masterGain = null;
  let typingGain = null;
  let notifGain = null;
  let noiseBuffer = null;

  let config = null;
  const recipes = new Map();          // recipeId -> recipe
  const slotBuffers = new Map();      // slotId -> AudioBuffer
  const slotLastPlay = new Map();     // slotId -> ms timestamp (cooldownMs制御)
  let lastTypingPlay = 0;             // タイプ音の間引き用

  // 再生中ボイス管理
  // voice = { nodes: [source...], gain, endTime, typing }
  const activeVoices = new Set();

  const stateEl = document.getElementById('ctx-state');
  const cachedEl = document.getElementById('cached');

  function log(message) {
    vscode.postMessage({ type: 'log', message: String(message) });
  }

  function updateStatusUi() {
    if (stateEl) {
      const s = ctx ? ctx.state : 'not created';
      stateEl.textContent = s;
      stateEl.className = s === 'running' ? 'state-running' : 'state-suspended';
    }
    if (cachedEl) {
      cachedEl.textContent = String(slotBuffers.size);
    }
  }

  function ensureContext() {
    if (!ctx) {
      const lowLatency = !config || config.lowLatencyMode;
      ctx = new AudioContext({ latencyHint: lowLatency ? 'interactive' : 'balanced' });
      masterGain = ctx.createGain();
      masterGain.connect(ctx.destination);
      typingGain = ctx.createGain();
      typingGain.connect(masterGain);
      notifGain = ctx.createGain();
      notifGain.connect(masterGain);
      noiseBuffer = createNoiseBuffer(ctx);
      ctx.addEventListener('statechange', updateStatusUi);
      log('AudioContext created (' + ctx.sampleRate + 'Hz)');
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => { /* 次のメッセージ時に再試行 */ });
    }
    updateStatusUi();
  }

  function createNoiseBuffer(audioCtx) {
    const length = Math.floor(audioCtx.sampleRate * 0.5);
    const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  function applyConfig() {
    if (!ctx || !config) { return; }
    masterGain.gain.value = clamp01(config.masterVolume);
    typingGain.gain.value = clamp01(config.typingVolume);
    notifGain.gain.value = clamp01(config.notificationVolume);
    if (!config.enabled) {
      stopAll();
    }
  }

  function clamp01(v) {
    return Math.min(1, Math.max(0, typeof v === 'number' ? v : 0));
  }

  function channelNode(channel) {
    return channel === 'typing' ? typingGain : notifGain;
  }

  // ---- ボイス管理 ----

  function registerVoice(voice) {
    activeVoices.add(voice);
    // 終了後に自動解放
    const ms = Math.max(0, (voice.endTime - ctx.currentTime) * 1000) + 100;
    setTimeout(() => { activeVoices.delete(voice); }, ms);
  }

  function stopVoice(voice) {
    try {
      // クリックノイズ防止のため数msで減衰させてから停止
      const t = ctx.currentTime;
      voice.gain.gain.cancelScheduledValues(t);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, t);
      voice.gain.gain.linearRampToValueAtTime(0.0001, t + 0.005);
      for (const node of voice.nodes) {
        node.stop(t + 0.01);
      }
    } catch (e) { /* already stopped */ }
    activeVoices.delete(voice);
  }

  /**
   * タイプ音の同時再生数制限。上限到達時は「短音優先」:
   * 残り再生時間が最も長いボイスを止めて新しい音を優先する。
   */
  function enforceTypingVoiceLimit() {
    const max = config && config.typingMaxVoices ? config.typingMaxVoices : 8;
    const typingVoices = [...activeVoices].filter((v) => v.typing);
    if (typingVoices.length < max) { return; }
    typingVoices.sort((a, b) => b.endTime - a.endTime);
    const excess = typingVoices.length - max + 1;
    for (let i = 0; i < excess; i++) {
      stopVoice(typingVoices[i]);
    }
  }

  function stopAll() {
    for (const voice of [...activeVoices]) {
      stopVoice(voice);
    }
    activeVoices.clear();
  }

  // ---- 合成音 (レシピ) ----

  function playRecipe(recipe, channel, pitchMul, isTyping) {
    const t0 = ctx.currentTime;
    const out = channelNode(channel);
    const nodes = [];
    let endTime = t0;

    // レイヤー全体で1つのvoiceGainを共有し、voice単位で止められるようにする
    const voiceGain = ctx.createGain();
    voiceGain.gain.value = 1;
    voiceGain.connect(out);

    for (const layer of recipe.layers) {
      const start = t0 + (layer.delay || 0);
      const dur = layer.attack + layer.decay;
      const stopAt = start + dur + 0.05;
      endTime = Math.max(endTime, stopAt);

      let src;
      if (layer.wave === 'noise') {
        src = ctx.createBufferSource();
        src.buffer = noiseBuffer;
        src.loop = true;
      } else {
        src = ctx.createOscillator();
        src.type = layer.wave;
        const f = Math.max(20, (layer.freq || 440) * pitchMul);
        src.frequency.setValueAtTime(f, start);
        if (layer.freqEnd) {
          src.frequency.exponentialRampToValueAtTime(
            Math.max(20, layer.freqEnd * pitchMul), start + dur);
        }
      }

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(layer.gain, start + layer.attack);
      env.gain.exponentialRampToValueAtTime(0.0001, start + dur);

      let head = src;
      if (layer.filter) {
        const filter = ctx.createBiquadFilter();
        filter.type = layer.filter.type;
        filter.frequency.value = layer.filter.freq;
        if (layer.filter.q) { filter.Q.value = layer.filter.q; }
        head.connect(filter);
        head = filter;
      }
      head.connect(env);
      env.connect(voiceGain);

      src.start(start);
      src.stop(stopAt);
      nodes.push(src);
    }

    const voice = { nodes, gain: voiceGain, endTime, typing: isTyping };
    registerVoice(voice);
  }

  // ---- カスタム音 (AudioBuffer) ----

  function playSlot(slotId, channel, isTyping) {
    const buffer = slotBuffers.get(slotId);
    if (!buffer || !config) { return; }
    const slot = config.slots[slotId - 1];
    if (!slot || !slot.enabled) { return; }

    // スロット個別cooldown
    const now = performance.now();
    const last = slotLastPlay.get(slotId) || 0;
    if (now - last < (slot.cooldownMs || 0)) { return; }
    slotLastPlay.set(slotId, now);

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.value = clamp01(slot.volume);
    src.connect(g);
    g.connect(channelNode(channel));
    src.start();

    const voice = {
      nodes: [src], gain: g,
      endTime: ctx.currentTime + buffer.duration,
      typing: isTyping,
    };
    registerVoice(voice);
  }

  /** 生成音を鳴らすスロット (type='generated'): filePathにレシピIDが入っている */
  function playGeneratedSlot(slotId, channel, pitchMul, isTyping) {
    const slot = config && config.slots[slotId - 1];
    if (!slot || !slot.enabled) { return; }
    const now = performance.now();
    const last = slotLastPlay.get(slotId) || 0;
    if (now - last < (slot.cooldownMs || 0)) { return; }
    slotLastPlay.set(slotId, now);
    const recipe = recipes.get(slot.filePath);
    if (recipe) {
      playRecipe(scaleRecipeGain(recipe, clamp01(slot.volume)), channel, pitchMul, isTyping);
    }
  }

  function scaleRecipeGain(recipe, volume) {
    if (volume >= 0.999) { return recipe; }
    return {
      id: recipe.id,
      label: recipe.label,
      layers: recipe.layers.map((l) => Object.assign({}, l, { gain: l.gain * volume })),
    };
  }

  // ---- 再生入口 ----

  function handlePlay(msg) {
    if (!config || !config.enabled) { return; }
    ensureContext();
    if (ctx.state !== 'running') { return; }

    const isTyping = !!msg.typing;

    // タイプ音の間引き (webview側の最終ゲート)
    if (isTyping) {
      const now = performance.now();
      const cooldown = config.typingCooldownMs || 0;
      if (now - lastTypingPlay < cooldown) { return; }
      lastTypingPlay = now;
      enforceTypingVoiceLimit();
    }

    // 通常入力音のピッチランダム化 (±6%)
    const pitchMul = msg.pitchRand ? 1 + (Math.random() * 0.12 - 0.06) : 1;

    const sound = String(msg.sound || 'none');
    if (sound === 'none') { return; }

    if (sound.startsWith('preset:')) {
      const recipe = recipes.get(sound.slice(7));
      if (recipe) {
        playRecipe(recipe, msg.channel, pitchMul, isTyping);
      }
      return;
    }

    if (sound.startsWith('slot:')) {
      const slotId = Number(sound.slice(5));
      const slot = config.slots[slotId - 1];
      if (!slot) { return; }
      if (slot.type === 'file') {
        playSlot(slotId, msg.channel, isTyping);
      } else if (slot.type === 'generated') {
        playGeneratedSlot(slotId, msg.channel, pitchMul, isTyping);
      }
    }
  }

  // ---- メッセージ処理 ----

  function base64ToArrayBuffer(base64) {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return bytes.buffer;
  }

  async function handleLoadSlot(msg) {
    ensureContext();
    try {
      const arrayBuffer = base64ToArrayBuffer(msg.base64);
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      slotBuffers.set(msg.slotId, audioBuffer);
      vscode.postMessage({ type: 'decoded', slotId: msg.slotId, durationSec: audioBuffer.duration });
    } catch (e) {
      slotBuffers.delete(msg.slotId);
      vscode.postMessage({
        type: 'decodeError', slotId: msg.slotId,
        message: (e && e.message) ? e.message : 'decodeAudioData failed',
      });
    }
    updateStatusUi();
  }

  function sendStatus() {
    vscode.postMessage({
      type: 'status',
      audioContextState: ctx ? ctx.state : 'not created',
      sampleRate: ctx ? ctx.sampleRate : 0,
      baseLatency: ctx && typeof ctx.baseLatency === 'number' ? ctx.baseLatency : -1,
      cachedSlots: [...slotBuffers.keys()],
      activeVoices: activeVoices.size,
    });
  }

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || typeof msg.type !== 'string') { return; }
    switch (msg.type) {
      case 'init':
        config = msg.config;
        recipes.clear();
        for (const r of msg.recipes) {
          recipes.set(r.id, r);
        }
        slotBuffers.clear();
        ensureContext();
        applyConfig();
        log('engine initialized: ' + recipes.size + ' recipes');
        break;
      case 'config':
        config = msg.config;
        ensureContext();
        applyConfig();
        break;
      case 'loadSlot':
        void handleLoadSlot(msg);
        break;
      case 'clearSlot':
        slotBuffers.delete(msg.slotId);
        updateStatusUi();
        break;
      case 'play':
        handlePlay(msg);
        break;
      case 'stopAll':
        stopAll();
        break;
      case 'ping':
        ensureContext();
        sendStatus();
        break;
    }
  });

  // アンロード時にリソース解放
  window.addEventListener('unload', () => {
    stopAll();
    if (ctx) {
      ctx.close().catch(() => {});
    }
  });

  vscode.postMessage({ type: 'ready' });
})();
