/**
 * Agent 检测工具
 * 用于检测请求是否来自 AI Agent，支持双模渲染
 */

/**
 * 已知的 Agent User-Agent 标识
 */
const AGENT_UA_PATTERNS = [
  /bot/i,
  /crawler/i,
  /spider/i,
  /scraper/i,
  /curl/i,
  /wget/i,
  /python-requests/i,
  /http\.rb/i,
  /node-fetch/i,
  /axios/i,
  /got/i,
  /superagent/i,
  /puppeteer/i,
  /playwright/i,
  /selenium/i,
  /headless/i,
  /GPT/i,
  /Claude/i,
  /Anthropic/i,
  /OpenAI/i,
  /Google.*AI/i,
  /Perplexity/i,
  /LangChain/i,
  /LlamaIndex/i,
  /AutoGPT/i,
  /BabyAGI/i,
  /Agent/i,
]

/**
 * Agent 请求的 Accept 头标识
 */
const AGENT_ACCEPT_PATTERNS = [
  /text\/markdown/i,
  /application\/json/i,
  /text\/plain/i,
]

/**
 * 检测请求是否来自 AI Agent
 * @param request - Request 对象
 * @returns 是否为 Agent 请求
 */
export function isAgentRequest(request: Request): boolean {
  const userAgent = request.headers.get('user-agent') || ''
  const accept = request.headers.get('accept') || ''

  // 检查 User-Agent
  for (const pattern of AGENT_UA_PATTERNS) {
    if (pattern.test(userAgent)) {
      return true
    }
  }

  // 检查 Accept 头（排除浏览器常见的 Accept 头）
  if (accept && !accept.includes('text/html')) {
    for (const pattern of AGENT_ACCEPT_PATTERNS) {
      if (pattern.test(accept)) {
        return true
      }
    }
  }

  // 检查自定义 Agent 标识头
  const agentHeader = request.headers.get('x-agent') || request.headers.get('x-ai-agent')
  if (agentHeader) {
    return true
  }

  return false
}

/**
 * 获取客户端类型
 * @param request - Request 对象
 * @returns 'agent' 或 'human'
 */
export function getClientType(request: Request): 'agent' | 'human' {
  return isAgentRequest(request) ? 'agent' : 'human'
}

/**
 * 获取请求的首选响应格式
 * @param request - Request 对象
 * @returns 响应格式
 */
export function getPreferredFormat(
  request: Request
): 'html' | 'markdown' | 'json' {
  if (!isAgentRequest(request)) {
    return 'html'
  }

  const accept = request.headers.get('accept') || ''

  if (accept.includes('application/json')) {
    return 'json'
  }

  if (accept.includes('text/markdown') || accept.includes('text/plain')) {
    return 'markdown'
  }

  // 默认返回 JSON
  return 'json'
}

/**
 * 获取 Agent 信息
 * @param request - Request 对象
 * @returns Agent 信息对象
 */
export function getAgentInfo(request: Request): {
  isAgent: boolean
  clientType: 'agent' | 'human'
  format: 'html' | 'markdown' | 'json'
  userAgent: string
} {
  const userAgent = request.headers.get('user-agent') || ''
  const isAgent = isAgentRequest(request)

  return {
    isAgent,
    clientType: isAgent ? 'agent' : 'human',
    format: getPreferredFormat(request),
    userAgent,
  }
}