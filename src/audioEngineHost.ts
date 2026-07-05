import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  AudioChannel, CustomSlot, EngineToHostMessage, HostToEngineMessage,
  SoundRef, SUPPORTED_AUDIO_EXTENSIONS,
} from './types';
import { SOUND_RECIPES } from './soundRecipes';
import { buildEngineConfig } from './config';
import { debug, info } from './log';

export const AUDIO_ENGINE_VIEW_ID = 'popSe.audioEngine';

export interface EngineStatus {
  running: boolean;
  audioContextState?: string;
  sampleRate?: number;
  baseLatency?: number;
  cachedSlots?: number[];
  activeVoices?: number;
}

/**
 * Audio Engine Webview の Extension Host 側。
 *
 * - パネル領域のWebviewView (retainContextWhenHidden) として常駐し、
 *   設定画面を閉じても音声再生は動き続ける。
 * - カスタム音ファイルは「設定時/起動時」に読み込んでWebviewへ転送し、
 *   Webview側でAudioBufferとしてキャッシュする。イベント発生時のファイルI/Oはゼロ。
 * - 生成音はレシピ(パラメータ)をinit時に転送済みなので即時合成される。
 */
export class AudioEngineHost implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;
  private engineReady = false;
  /** engine未起動時に届いたloadSlot等を捨てないための保留キュー (playは保留しない) */
  private pendingQueue: HostToEngineMessage[] = [];
  /** スロットごとに最後に転送したファイルパス (再転送抑止) */
  private loadedSlotPaths = new Map<number, string>();
  private statusWaiters: Array<(s: EngineStatus) => void> = [];
  private lastStatus: EngineStatus = { running: false };
  private startAttempted = false;

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')],
    };
    webviewView.webview.html = this.buildHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((msg: EngineToHostMessage) => {
      this.onEngineMessage(msg);
    });

    webviewView.onDidDispose(() => {
      this.view = undefined;
      this.engineReady = false;
      this.loadedSlotPaths.clear();
      this.lastStatus = { running: false };
      debug('audio engine view disposed');
    });

    debug('audio engine view resolved');
  }

  private onEngineMessage(msg: EngineToHostMessage): void {
    switch (msg.type) {
      case 'ready': {
        this.engineReady = true;
        debug('audio engine ready');
        this.sendInit();
        // initの後に保留分を流す
        const queued = this.pendingQueue.splice(0);
        for (const m of queued) { this.post(m); }
        void this.preloadAllSlots();
        break;
      }
      case 'status': {
        this.lastStatus = {
          running: true,
          audioContextState: msg.audioContextState,
          sampleRate: msg.sampleRate,
          baseLatency: msg.baseLatency,
          cachedSlots: msg.cachedSlots,
          activeVoices: msg.activeVoices,
        };
        const waiters = this.statusWaiters.splice(0);
        for (const w of waiters) { w(this.lastStatus); }
        break;
      }
      case 'decoded':
        debug(`slot ${msg.slotId} decoded (${msg.durationSec.toFixed(2)}s)`);
        break;
      case 'decodeError':
        info(`slot ${msg.slotId} decode error: ${msg.message}`);
        void vscode.window.showWarningMessage(
          `Pop SE: カスタム${msg.slotId} の音声ファイルをデコードできませんでした。対応形式: ${SUPPORTED_AUDIO_EXTENSIONS.join(', ')}`
        );
        break;
      case 'log':
        debug(`[engine] ${msg.message}`);
        break;
    }
  }

  private post(msg: HostToEngineMessage): void {
    void this.view?.webview.postMessage(msg);
  }

  private sendInit(): void {
    this.post({ type: 'init', config: buildEngineConfig(), recipes: SOUND_RECIPES });
    this.loadedSlotPaths.clear();
  }

  /** 設定変更をWebviewへ反映し、スロットのファイルを必要に応じて再プリロードする */
  refreshConfig(): void {
    if (!this.engineReady) { return; }
    this.post({ type: 'config', config: buildEngineConfig() });
    void this.preloadAllSlots();
  }

  /** file型スロットの音声ファイルをすべて読み込んでWebviewへ転送する */
  async preloadAllSlots(): Promise<void> {
    const slots = buildEngineConfig().slots;
    for (const slot of slots) {
      await this.preloadSlot(slot);
    }
  }

  async preloadSlot(slot: CustomSlot): Promise<void> {
    if (slot.type !== 'file' || !slot.filePath) {
      if (this.loadedSlotPaths.has(slot.id)) {
        this.loadedSlotPaths.delete(slot.id);
        this.post({ type: 'clearSlot', slotId: slot.id });
      }
      return;
    }
    if (this.loadedSlotPaths.get(slot.id) === slot.filePath) {
      return; // 同一ファイルは再転送しない
    }
    try {
      const data = await fs.readFile(slot.filePath);
      if (data.byteLength > 20 * 1024 * 1024) {
        void vscode.window.showWarningMessage(`Pop SE: ${slot.name} のファイルが20MBを超えているため読み込みません。`);
        return;
      }
      const ext = path.extname(slot.filePath).replace('.', '').toLowerCase();
      const msg: HostToEngineMessage = {
        type: 'loadSlot', slotId: slot.id, base64: data.toString('base64'), ext,
      };
      if (this.engineReady) {
        this.post(msg);
        this.loadedSlotPaths.set(slot.id, slot.filePath);
      } else {
        this.pendingQueue.push(msg);
      }
      debug(`slot ${slot.id} file queued for preload (${data.byteLength} bytes)`);
    } catch (e) {
      info(`slot ${slot.id} file read error: ${(e as Error).message}`);
      void vscode.window.showWarningMessage(`Pop SE: ${slot.name} の音声ファイルを読み込めませんでした: ${slot.filePath}`);
    }
  }

  /** 再生指示。エンジン未起動なら起動を試み、その回の音はスキップする (低遅延優先)。 */
  play(sound: SoundRef, channel: AudioChannel, opts?: { pitchRand?: boolean; typing?: boolean }): void {
    if (!this.engineReady) {
      void this.ensureStarted(false);
      return;
    }
    this.post({
      type: 'play', sound, channel,
      pitchRand: opts?.pitchRand, typing: opts?.typing,
    });
  }

  stopAll(): void {
    this.post({ type: 'stopAll' });
  }

  isRunning(): boolean {
    return this.engineReady;
  }

  /**
   * エンジンビューを初回解決させる。WebviewViewは一度表示されるまで
   * resolveされないため、focusコマンドで表示してからエディタへフォーカスを戻す。
   */
  async ensureStarted(force: boolean): Promise<void> {
    if (this.engineReady) { return; }
    if (this.startAttempted && !force) { return; }
    this.startAttempted = true;
    try {
      await vscode.commands.executeCommand(`${AUDIO_ENGINE_VIEW_ID}.focus`);
      await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
      debug('audio engine view start requested');
    } catch (e) {
      info(`failed to start audio engine view: ${(e as Error).message}`);
    }
  }

  /** 診断用: エンジンへpingし、現在状態を取得する */
  async queryStatus(timeoutMs = 2000): Promise<EngineStatus> {
    if (!this.engineReady) {
      return { running: false };
    }
    return new Promise<EngineStatus>((resolve) => {
      const timer = setTimeout(() => {
        this.statusWaiters = this.statusWaiters.filter((w) => w !== waiter);
        resolve({ ...this.lastStatus, running: false });
      }, timeoutMs);
      const waiter = (s: EngineStatus) => {
        clearTimeout(timer);
        resolve(s);
      };
      this.statusWaiters.push(waiter);
      this.post({ type: 'ping' });
    });
  }

  dispose(): void {
    this.stopAll();
    this.view = undefined;
    this.engineReady = false;
  }

  private buildHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'audioEngine.js')
    );
    const nonce = makeNonce();
    return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 8px 12px; }
  .row { margin: 2px 0; font-size: 12px; opacity: 0.85; }
  .state-running { color: var(--vscode-testing-iconPassed, #73c991); }
  .state-suspended { color: var(--vscode-editorWarning-foreground, #cca700); }
</style>
</head>
<body>
  <div class="row">🔊 Pop SE — Sound Engine</div>
  <div class="row">AudioContext: <span id="ctx-state">initializing...</span></div>
  <div class="row">キャッシュ済みカスタム音: <span id="cached">0</span> / 10</div>
  <div class="row" style="opacity:0.6">このビューは音声再生エンジンです。閉じると音が鳴らなくなります。</div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

export function makeNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
