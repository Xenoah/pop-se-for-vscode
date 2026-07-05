// Pop SE — 設定画面 (Webview側UI)
(function () {
  'use strict';

  const vscode = acquireVsCodeApi();
  let state = null;

  // ---------- DOMヘルパー (innerHTML不使用でXSS安全に構築) ----------
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (k === 'class') { el.className = v; }
        else if (k === 'text') { el.textContent = v; }
        else if (k.startsWith('on')) { el.addEventListener(k.slice(2), v); }
        else if (k === 'checked') { el.checked = !!v; }
        else if (k === 'value') { el.value = v; }
        else { el.setAttribute(k, v); }
      }
    }
    for (const c of children) {
      if (c === null || c === undefined) { continue; }
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  }

  function send(msg) { vscode.postMessage(msg); }
  function setSetting(key, value) { send({ cmd: 'setSetting', key, value }); }

  // ---------- ナビゲーション ----------
  for (const btn of document.querySelectorAll('.nav-item')) {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.section').forEach((s) => s.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('section-' + btn.dataset.section).classList.add('active');
    });
  }

  // ---------- 音選択セレクト (無音 / プリセット音 / カスタムスロット) ----------
  function soundSelect(currentValue, onChange) {
    const sel = h('select');
    sel.appendChild(h('option', { value: 'none', text: '（無音）' }));

    const slotGroup = h('optgroup', { label: 'カスタム音スロット' });
    for (const slot of state.slots) {
      const suffix = slot.type === 'none' ? ' (未設定)' : '';
      slotGroup.appendChild(h('option', { value: 'slot:' + slot.id, text: `${slot.id}. ${slot.name}${suffix}` }));
    }
    sel.appendChild(slotGroup);

    const groups = new Map();
    for (const r of state.recipes) {
      const prefix = r.id.split('.')[0];
      if (!groups.has(prefix)) {
        groups.set(prefix, h('optgroup', { label: 'プリセット音: ' + prefix }));
      }
      groups.get(prefix).appendChild(h('option', { value: 'preset:' + r.id, text: r.label }));
    }
    for (const g of groups.values()) { sel.appendChild(g); }

    sel.value = currentValue;
    if (sel.value !== currentValue) { sel.value = 'none'; }
    sel.addEventListener('change', () => onChange(sel.value));
    return sel;
  }

  function testButton(getSound) {
    return h('button', {
      class: 'test', title: 'テスト再生',
      onclick: () => send({ cmd: 'testSound', sound: getSound() }),
    }, '▶');
  }

  // ---------- Preset ----------
  function presetCard(p, extraButtons) {
    const isCurrent = p.id === state.currentPreset;
    return h('div', { class: 'preset-card' + (isCurrent ? ' current' : '') },
      h('h3', {}, p.label, isCurrent ? h('span', { class: 'badge', text: '適用中' }) : null),
      h('p', { text: p.description || '' }),
      h('button', {
        class: 'action',
        onclick: () => send({ cmd: 'applyPreset', presetId: p.id }),
      }, 'このテーマを一括適用'),
      ...(extraButtons || [])
    );
  }

  function renderPreset(root) {
    const userCards = state.userPresets.map((p) =>
      presetCard(
        { id: p.id, label: p.label, description: '保存したプリセット' },
        [h('button', {
          class: 'action secondary', style: 'margin-left:6px',
          onclick: () => send({ cmd: 'deleteUserPreset', presetId: p.id }),
        }, '削除…')]
      )
    );

    root.replaceChildren(
      h('h2', { text: 'プリセットテーマ' }),
      h('div', { class: 'desc', text: 'テーマを選んで「一括適用」を押すと、全イベントの音割り当てがまとめて置き換わります。個別の割り当ては Event Mapping で調整できます。' }),
      h('div', { class: 'preset-grid' }, ...state.presets.map((p) => presetCard(p))),
      h('h2', { text: 'マイプリセット', style: 'margin-top:24px' }),
      h('div', { class: 'desc', text: `現在のイベント割り当てを名前を付けて保存できます (最大${state.maxUserPresets}件)。Event Mappingで調整した内容をそのままプリセット化できます。` }),
      h('div', { class: 'io-zone' },
        h('button', {
          class: 'action',
          onclick: () => send({ cmd: 'saveUserPreset' }),
        }, '現在の設定をプリセットとして保存…')
      ),
      userCards.length
        ? h('div', { class: 'preset-grid' }, ...userCards)
        : h('div', { class: 'hint', text: '保存済みのマイプリセットはまだありません。' })
    );
  }

  // ---------- Custom Sounds ----------
  function renderCustom(root) {
    const cards = state.slots.map((slot) => {
      const patch = (p) => send({ cmd: 'updateSlot', slotId: slot.id, patch: p });

      const nameInput = h('input', {
        type: 'text', class: 'slot-name', value: slot.name, maxlength: '60',
        onchange: () => patch({ name: nameInput.value || `カスタム${slot.id}` }),
      });

      const typeSel = h('select',
        { onchange: () => patch({ type: typeSel.value }) },
        h('option', { value: 'none', text: 'none (未設定)' }),
        h('option', { value: 'file', text: 'file (音声ファイル)' }),
        h('option', { value: 'generated', text: 'generated (生成音)' })
      );
      typeSel.value = slot.type;

      const volInput = h('input', {
        type: 'range', min: '0', max: '1', step: '0.05', value: String(slot.volume),
      });
      const volVal = h('span', { class: 'val', text: slot.volume.toFixed(2) });
      volInput.addEventListener('input', () => { volVal.textContent = Number(volInput.value).toFixed(2); });
      volInput.addEventListener('change', () => patch({ volume: Number(volInput.value) }));

      const cooldownInput = h('input', {
        type: 'number', min: '0', max: '60000', step: '10', value: String(slot.cooldownMs),
        style: 'width:80px',
        onchange: () => patch({ cooldownMs: Math.max(0, Number(cooldownInput.value) || 0) }),
      });

      const descInput = h('input', {
        type: 'text', value: slot.description, maxlength: '200', placeholder: '説明 (任意)',
        onchange: () => patch({ description: descInput.value }),
      });

      // type別のソース設定UI
      let sourceUi;
      if (slot.type === 'file') {
        sourceUi = h('span', { class: 'field' },
          h('button', { class: 'test', onclick: () => send({ cmd: 'pickFile', slotId: slot.id }) }, 'ファイル選択…'),
          h('span', { class: 'slot-file-path', title: slot.filePath, text: slot.filePath || '(未選択)' }),
          slot.filePath
            ? h('button', { class: 'test', title: 'ファイル割り当てを解除', onclick: () => send({ cmd: 'clearFile', slotId: slot.id }) }, '✕')
            : null
        );
      } else if (slot.type === 'generated') {
        const recipeSel = h('select', {
          onchange: () => patch({ filePath: recipeSel.value }),
        });
        for (const r of state.recipes) {
          recipeSel.appendChild(h('option', { value: r.id, text: r.label }));
        }
        recipeSel.value = slot.filePath;
        if (recipeSel.value !== slot.filePath) {
          recipeSel.selectedIndex = 0;
        }
        sourceUi = h('span', { class: 'field' }, '生成音:', recipeSel);
      } else {
        sourceUi = h('span', { class: 'field', style: 'opacity:0.6' },
          'typeを file または generated にすると音源を設定できます');
      }

      const enabledCheck = h('input', {
        type: 'checkbox', checked: slot.enabled,
        onchange: () => patch({ enabled: enabledCheck.checked }),
      });

      return h('div', { class: 'slot-card' },
        h('div', { class: 'slot-head' },
          h('span', { class: 'slot-no', text: '#' + slot.id }),
          nameInput,
          h('label', { class: 'check' }, enabledCheck, '有効'),
          testButton(() => 'slot:' + slot.id)
        ),
        h('div', { class: 'slot-body' },
          h('span', { class: 'field' }, 'type:', typeSel),
          sourceUi,
          h('span', { class: 'field' }, '音量:', volInput, volVal),
          h('span', { class: 'field' }, 'cooldown(ms):', cooldownInput),
          h('span', { class: 'slot-desc' }, descInput)
        )
      );
    });

    const slotButtons = () => {
      const buttons = [];
      if (state.slots.length < state.maxSlots) {
        buttons.push(h('button', {
          class: 'action',
          onclick: () => send({ cmd: 'addSlot' }),
        }, `＋ スロットを追加 (${state.slots.length} / ${state.maxSlots})`));
      }
      if (state.slots.length > state.minSlots) {
        buttons.push(h('button', {
          class: 'action secondary', style: 'margin-left:6px',
          onclick: () => send({ cmd: 'removeSlot' }),
        }, `− 末尾のスロット #${state.slots.length} を削除`));
      }
      return h('div', { class: 'io-zone' }, ...buttons);
    };

    root.replaceChildren(
      h('h2', { text: `カスタム音スロット (${state.slots.length}枠 / 最大${state.maxSlots}枠)` }),
      h('div', { class: 'desc', text: '任意の音声ファイル (wav / mp3 / ogg / m4a) または生成音を登録できます。登録した音は Event Mapping で任意のイベントに割り当てられます。ファイルは起動時と設定時にプリロードされ、イベント発生時の読み込みはありません。' }),
      slotButtons(),
      ...cards,
      slotButtons()
    );
  }

  // ---------- Event Mapping ----------
  const CATEGORY_LABEL = {
    typing: 'タイプ音', editor: 'エディタ操作', diagnostics: 'Diagnostics',
    task: 'タスク / ビルド', terminal: 'ターミナル',
    ai: 'AIアシスタント (Claude Code / Codex / Copilot)',
  };

  function renderMapping(root) {
    const groups = new Map();
    for (const ev of state.events) {
      if (!groups.has(ev.category)) { groups.set(ev.category, []); }
      groups.get(ev.category).push(ev);
    }

    const groupEls = [];
    for (const [category, events] of groups) {
      const rows = events.map((ev) => {
        const setting = state.eventMap[ev.id] || { sound: 'none', enabled: false };
        const enabledCheck = h('input', {
          type: 'checkbox', checked: setting.enabled,
          onchange: () => send({ cmd: 'setEventSetting', eventId: ev.id, patch: { enabled: enabledCheck.checked } }),
        });
        const sel = soundSelect(setting.sound, (value) =>
          send({ cmd: 'setEventSetting', eventId: ev.id, patch: { sound: value } })
        );
        return h('tr', { class: setting.enabled ? '' : 'disabled' },
          h('td', { class: 'ev-label', text: ev.label }),
          h('td', {}, h('label', { class: 'check' }, enabledCheck, '有効')),
          h('td', {}, sel),
          h('td', {}, testButton(() => sel.value))
        );
      });
      const notes = [];
      if (category === 'terminal' && !state.shellIntegration) {
        notes.push(h('div', { class: 'hint', text: '⚠ この環境ではShell Integration APIが利用できないため、「コマンド成功/失敗」は鳴りません。' }));
      }
      if (category === 'diagnostics') {
        notes.push(h('div', { class: 'hint', text: 'エラー/警告は「0件→発生」「発生→0件」の遷移時のみ鳴ります。連続発火はAdvancedのcooldownで抑制されます。' }));
      }
      if (category === 'ai') {
        notes.push(h('div', { class: 'hint', text: 'ツール名を含むターミナルの作成/終了、および claude / codex / copilot コマンドの実行開始/終了で鳴ります (Shell Integration対応シェルのみ)。Copilotのインライン補完・チャットはVS Code APIで検出できないため対象外です。' }));
      }
      groupEls.push(
        h('div', { class: 'event-group' },
          h('h3', { text: CATEGORY_LABEL[category] || category }),
          ...notes,
          h('table', { class: 'event-table' }, ...rows)
        )
      );
    }

    root.replaceChildren(
      h('h2', { text: 'イベント割り当て' }),
      h('div', { class: 'desc', text: 'イベントごとに プリセット音 / カスタム音スロット / 無音 を割り当てます。' }),
      ...groupEls
    );
  }

  // ---------- Volume ----------
  function sliderRow(label, key, value) {
    const input = h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(value) });
    const val = h('span', { class: 'val', text: Number(value).toFixed(2) });
    input.addEventListener('input', () => { val.textContent = Number(input.value).toFixed(2); });
    input.addEventListener('change', () => setSetting(key, Number(input.value)));
    return h('div', { class: 'form-row' }, h('span', { class: 'row-label', text: label }), input, val);
  }

  function checkRow(label, key, value) {
    const input = h('input', {
      type: 'checkbox', checked: value,
      onchange: () => setSetting(key, input.checked),
    });
    return h('div', { class: 'form-row' }, h('label', { class: 'check' }, input, label));
  }

  function numberRow(label, key, value, min, max) {
    const input = h('input', {
      type: 'number', min: String(min), max: String(max), value: String(value), style: 'width:90px',
      onchange: () => setSetting(key, Number(input.value)),
    });
    return h('div', { class: 'form-row' }, h('span', { class: 'row-label', text: label }), input);
  }

  function renderVolume(root) {
    const s = state.settings;
    root.replaceChildren(
      h('h2', { text: '音量' }),
      h('div', { class: 'desc', text: 'すべて0.0〜1.0。実際の音量は マスター × チャンネル × スロット音量 で決まります。' }),
      checkRow('サウンド全体を有効にする', 'enabled', s.enabled),
      sliderRow('マスター音量', 'masterVolume', s.masterVolume),
      checkRow('タイプ音を有効にする', 'typing.enabled', s.typingEnabled),
      sliderRow('タイプ音量', 'typing.volume', s.typingVolume),
      sliderRow('通知音量 (保存/エラー/タスク等)', 'notification.volume', s.notificationVolume)
    );
  }

  // ---------- Advanced ----------
  function renderAdvanced(root) {
    const s = state.settings;
    root.replaceChildren(
      h('h2', { text: '高度な設定' }),
      h('div', { class: 'desc', text: 'タイプ音エンジンと発火抑制の調整。' }),
      checkRow('低遅延モード (AudioContext: interactive)', 'lowLatencyMode', s.lowLatencyMode),
      checkRow('通常入力音のピッチランダム化', 'typing.pitchRandomization', s.typingPitchRandomization),
      numberRow('タイプ音の最小間隔 (ms)', 'typing.cooldownMs', s.typingCooldownMs, 0, 500),
      numberRow('タイプ音の同時再生数上限', 'typing.maxVoices', s.typingMaxVoices, 1, 32),
      numberRow('Diagnostics音のcooldown (ms)', 'diagnostics.cooldownMs', s.diagnosticsCooldownMs, 0, 60000),
      checkRow('起動時にSound Engineを自動初期化', 'autoStartEngine', s.autoStartEngine),
      checkRow('デバッグログ (出力パネル > Pop SE)', 'debugLog', s.debugLog),
      h('div', { class: 'hint', text: 'デバッグログにはイベント名と状態のみが記録され、入力内容やコード内容は記録されません。' }),
      h('div', { class: 'form-row' },
        h('span', { class: 'row-label', text: 'Shell Integration API' }),
        h('span', { text: state.shellIntegration ? '利用可能 ✓' : '利用不可 (コマンド成功/失敗は無音)' })
      )
    );
  }

  // ---------- Reset ----------
  function renderReset(root) {
    root.replaceChildren(
      h('h2', { text: 'リセット / 入出力' }),
      h('div', { class: 'io-zone' },
        h('button', { class: 'action secondary', onclick: () => send({ cmd: 'export' }) }, '設定をエクスポート…'),
        h('button', { class: 'action secondary', onclick: () => send({ cmd: 'import' }) }, '設定をインポート…')
      ),
      h('div', { class: 'hint', text: 'エクスポートにはプリセット・マイプリセット・イベント割り当て・カスタム音スロット・音量・高度な設定が含まれます。' }),
      h('div', { class: 'danger-zone' },
        h('h3', { text: 'オールリセット' }),
        h('p', { class: 'hint', text: 'プリセット設定 / マイプリセット / イベント割り当て / カスタム音スロット / 音量設定 / cooldown設定 / 高度な設定 をすべて初期状態に戻します。実行前に確認ダイアログが表示されます。' }),
        h('button', { class: 'action danger', onclick: () => send({ cmd: 'resetAll' }) }, 'すべて初期化…')
      )
    );
  }

  // ---------- エンジン状態表示 ----------
  function renderEngineStatus() {
    const el = document.getElementById('engine-status');
    if (state.engineRunning) {
      el.replaceChildren(h('span', { class: 'ok', text: '● Sound Engine 稼働中' }));
    } else {
      el.replaceChildren(
        h('span', { class: 'ng', text: '● Sound Engine 停止中' }),
        h('br'),
        h('button', { class: 'test', style: 'margin-top:4px', onclick: () => send({ cmd: 'startEngine' }) }, 'エンジンを起動')
      );
    }
  }

  // ---------- 全体描画 ----------
  function renderAll() {
    if (!state) { return; }
    renderPreset(document.getElementById('section-preset'));
    renderCustom(document.getElementById('section-custom'));
    renderMapping(document.getElementById('section-mapping'));
    renderVolume(document.getElementById('section-volume'));
    renderAdvanced(document.getElementById('section-advanced'));
    renderReset(document.getElementById('section-reset'));
    renderEngineStatus();
  }

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg && msg.cmd === 'state') {
      state = msg.state;
      renderAll();
    }
  });

  send({ cmd: 'ready' });
})();
