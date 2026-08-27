import { fs } from '@tauri-apps/api';
import { DownloadTask } from '../interfaces/DownloadTask';
import { useSettingsStore } from '../stores/settings';
import { writeSidecar, sidecarPathFor } from '../utils/sidecar';
import { tagWithLlm, buildLlmContext } from '../utils/llm-tagger';

let _log: ICategoriedLogger;

export function log() {
  if (!_log) _log = window.log.category('PP');
  return _log;
}

/**
 * 记录本会话已处理过的任务，配合 Sidecar 文件存在性实现双重幂等，
 * 避免下载重试 / 多次同步触发重复后处理。
 */
const processedGids = new Set<string>();

/**
 * 下载完成后的处理流程：
 *  1. 可选调用外部 LLM 打标（tagWithLlm）
 *  2. 写入 Sidecar 元数据文件（同名 .json），LLM 结果并入其中
 * 任何一步失败均不抛出，避免影响下载主流程。
 */
export async function runPostProcess(task: DownloadTask): Promise<void> {
  if (task.status !== 'complete') return;
  if (processedGids.has(task.gid)) return;

  // Sidecar 已存在（此前会话已生成 / 用户手动创建）则视为已处理
  const scPath = await sidecarPathFor(task);
  if (await fs.exists(scPath)) {
    processedGids.add(task.gid);
    return;
  }

  const cfg = useSettingsStore.getState().postProcess;

  let llm = null;
  if (cfg.tagWithLlm) {
    try {
      llm = await tagWithLlm(cfg, buildLlmContext(task));
    } catch (err) {
      log().error('LLM 打标失败', err);
    }
  }

  if (cfg.saveSidecar) {
    try {
      await writeSidecar(task, llm);
    } catch (err) {
      log().error('Sidecar 写入失败', err);
    }
  }

  processedGids.add(task.gid);
}
