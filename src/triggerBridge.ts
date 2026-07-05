import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ALL_EVENT_IDS, EventId } from './types';
import { SoundService } from './soundService';
import { debug, info } from './log';

/** 外部トリガーの監視ディレクトリ (Claude Code hooks / Codex notify 等が書き込む) */
export const TRIGGER_DIR = path.join(os.homedir(), '.pop-se', 'events');

/**
 * 外部トリガーブリッジ。
 *
 * `~/.pop-se/events/<eventId>` というファイルの作成/更新を監視し、
 * ファイル名が有効なイベントIDなら対応する音を鳴らす。
 * Claude Code の hooks や Codex の notify のように「任意コマンドを実行できるが
 * VS Code内には手が届かない」外部ツールから音を鳴らすための入口。
 *
 * プライバシー: 使用するのはファイル名のみで、ファイルの内容は一切読まない。
 * 連続発火はSoundService側のイベント別cooldownで抑制される。
 */
export class TriggerBridge implements vscode.Disposable {
  private watcher: fs.FSWatcher | undefined;

  constructor(private readonly sound: SoundService) {}

  start(): void {
    if (this.watcher) { return; }
    try {
      fs.mkdirSync(TRIGGER_DIR, { recursive: true });
      this.watcher = fs.watch(TRIGGER_DIR, (_eventType, filename) => {
        if (!filename) { return; }
        // 拡張子付き (aiComplete.txt 等) でも動くように除去。イベントIDは'.'を含まない
        const id = path.basename(String(filename)).replace(/\.[^.]*$/, '');
        if ((ALL_EVENT_IDS as string[]).includes(id)) {
          this.sound.playEvent(id as EventId);
          debug(`external trigger: ${id}`);
        }
      });
      this.watcher.on('error', (e) => {
        info(`trigger bridge watch error: ${(e as Error).message}`);
        this.stop();
      });
      debug(`trigger bridge watching: ${TRIGGER_DIR}`);
    } catch (e) {
      info(`trigger bridge start failed: ${(e as Error).message}`);
      this.watcher = undefined;
    }
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = undefined;
  }

  isRunning(): boolean {
    return this.watcher !== undefined;
  }

  dispose(): void {
    this.stop();
  }
}
