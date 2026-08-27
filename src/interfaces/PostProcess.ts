/**
 * 后处理配置 —— 下载完成后的 Hook 行为。
 */
export interface PostProcessSettings {
  /** 是否保存 Sidecar 元数据（同名 .json） */
  saveSidecar: boolean;
  /** 是否调用外部 LLM 打标 */
  tagWithLlm: boolean;
  /** OpenAI 兼容 Chat Completions 接口地址 */
  llmEndpoint: string;
  /** 鉴权 Key（以 Bearer 注入） */
  llmApiKey: string;
  /** 模型名 */
  llmModel: string;
  /** 系统提示词（默认有内置打标文案） */
  llmPrompt: string;
}

export const DEFAULT_POST_PROCESS: PostProcessSettings = {
  saveSidecar: true,
  tagWithLlm: false,
  llmEndpoint: '',
  llmApiKey: '',
  llmModel: 'gpt-4o-mini',
  llmPrompt:
    '你是社交媒体内容打标助手。根据用户给出的推文与媒体信息，生成结构化标签。' +
    '仅输出合法 JSON 对象，格式：{"tags":["标签1","标签2"],"summary":"一句话概述"}。' +
    'tags 为 3-6 个精炼中文标签，summary 不超过 30 字，不要输出任何其他内容。',
};
