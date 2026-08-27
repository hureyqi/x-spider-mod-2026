import { fs, path } from '@tauri-apps/api';
import { DownloadTask } from '../interfaces/DownloadTask';
import { LlmTagResult } from './llm-tagger';

let _log: ICategoriedLogger;

export function log() {
  if (!_log) _log = window.log.category('SIDE');
  return _log;
}

/** 去除扩展名 */
function stripExt(fileName: string): string {
  return fileName.replace(/(\.[^.]+)$/, '');
}

/** 计算 Sidecar 元数据文件路径：与媒体同目录同名 .json */
export async function sidecarPathFor(task: DownloadTask): Promise<string> {
  return path.join(task.dir, `${stripExt(task.fileName)}.json`);
}

/**
 * 构建 Sidecar JSON 内容。
 * 序列化 Dayjs 字段为 ISO 字符串，user/post/media 元数据齐全，LLM 结果可选并入。
 */
export function buildSidecarPayload(
  task: DownloadTask,
  llm?: LlmTagResult | null,
): Record<string, unknown> {
  const { post } = task;
  const media = task.media;
  const user = post.user;

  return {
    schemaVersion: 1,
    savedAt: new Date().toISOString(),
    source: {
      dir: task.dir,
      fileName: task.fileName,
      downloadUrl: task.downloadUrl,
    },
    user: {
      id: user.id,
      name: user.name,
      screenName: user.screenName,
      avatar: user.avatar,
      registerTime: user.registerTime?.toISOString(),
    },
    post: {
      id: post.id,
      text: post.fullText,
      createdAt: post.createdAt?.toISOString(),
      lang: post.lang,
      views: post.views,
      likeCount: post.favoriteCount,
      retweetCount: post.retweetCount,
      replyCount: post.replyCount,
      bookmarkCount: post.bookmarkCount,
      tags: post.tags,
      possiblySensitive: post.possiblySensitive,
    },
    media: {
      type: media.type,
      id: media.id,
      url: media.url,
      width: media.width,
      height: media.height,
      duration: media.type === 'video' ? media.videoInfo?.duration : undefined,
      videoInfo: media.type !== 'photo' ? media.videoInfo : undefined,
    },
    llm: llm ?? null,
  };
}

/**
 * 写入 Sidecar 元数据文件。
 * 幂等：目标文件已存在则直接返回路径，不覆盖（用于断点/重启去重）。
 */
export async function writeSidecar(
  task: DownloadTask,
  llm?: LlmTagResult | null,
): Promise<string> {
  const scPath = await sidecarPathFor(task);
  if (await fs.exists(scPath)) {
    log().info('sidecar already exists, skip', scPath);
    return scPath;
  }
  const payload = JSON.stringify(buildSidecarPayload(task, llm), null, 2);
  await fs.writeTextFile(scPath, payload);
  log().info('sidecar written', scPath);
  return scPath;
}
