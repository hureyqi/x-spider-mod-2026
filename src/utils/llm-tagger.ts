import { invoke } from '@tauri-apps/api';
import { PostProcessSettings } from '../interfaces/PostProcess';
import { Response } from '../interfaces/Response';
import { DownloadTask } from '../interfaces/DownloadTask';

let _log: ICategoriedLogger;

export function log() {
  if (!_log) _log = window.log.category('LLM');
  return _log;
}

export interface LlmTagResult {
  tags: string[];
  summary: string;
  model?: string;
}

/** 使用原生 HTTP 调用（不经 CookieManager / 代理），避免污染抓取会话 */
async function postJson(
  url: string,
  headers: Record<string, string>,
  body: string,
): Promise<Response | null> {
  try {
    return await invoke<Response>('network_fetch', {
      method: 'POST',
      url,
      body,
      enableProxy: false,
      proxyUrl: '',
      headers,
      responseType: 'json',
    });
  } catch (err) {
    log().error('postJson failed', err);
    return null;
  }
}

/** 组装传给 LLM 的上下文 JSON 文本 */
export function buildLlmContext(task: DownloadTask): string {
  const { post } = task;
  const user = post.user;
  const media = task.media;
  return JSON.stringify(
    {
      user: {
        name: user.name,
        screenName: user.screenName,
        id: user.id,
      },
      post: {
        id: post.id,
        text: post.fullText,
        createdAt: post.createdAt?.toISOString(),
        lang: post.lang,
        likeCount: post.favoriteCount,
        retweetCount: post.retweetCount,
      },
      media: {
        type: media.type,
        url: media.url,
        duration:
          media.type === 'video' ? media.videoInfo?.duration : undefined,
      },
    },
    null,
    2,
  );
}

/**
 * 调用 OpenAI 兼容 Chat Completions 接口打标。
 * 配置不完整或调用失败时返回 null（不阻塞下载流程）。
 */
export async function tagWithLlm(
  cfg: PostProcessSettings,
  context: string,
): Promise<LlmTagResult | null> {
  if (!cfg.llmEndpoint || !cfg.llmApiKey) {
    log().warn('LLM 配置不完整，跳过打标');
    return null;
  }

  const body = JSON.stringify({
    model: cfg.llmModel,
    temperature: 0.4,
    messages: [
      { role: 'system', content: cfg.llmPrompt },
      { role: 'user', content: `待打标内容：\n${context}` },
    ],
  });

  const res = await postJson(
    cfg.llmEndpoint,
    {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.llmApiKey}`,
    },
    body,
  );

  if (!res || res.status < 200 || res.status >= 300) {
    log().warn('LLM 接口非 2xx', res?.status);
    return null;
  }

  const content = res.body?.choices?.[0]?.message?.content;
  if (!content) {
    log().warn('LLM 返回无 content', res.body);
    return null;
  }

  try {
    const parsed = JSON.parse(content);
    return {
      tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      model: cfg.llmModel,
    };
  } catch (err) {
    log().error('LLM 返回非法 JSON', content, err);
    return null;
  }
}
