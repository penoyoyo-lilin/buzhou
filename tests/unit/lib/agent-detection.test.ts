import { describe, it, expect } from 'vitest'
import {
  isAgentRequest,
  getClientType,
  getPreferredFormat,
  getAgentInfo,
} from '@/lib/agent-detection'

describe('agent-detection', () => {
  describe('isAgentRequest', () => {
    it('should return true for bot user agents', () => {
      const botUserAgents = [
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
        'Claude-Web/1.0',
        'OpenAI/1.0',
        'GPT-Bot/1.0',
        'Anthropic-Agent/1.0',
        'curl/7.68.0',
        'python-requests/2.28.0',
        'axios/1.0.0',
      ]

      botUserAgents.forEach((ua) => {
        const request = new Request('https://example.com', {
          headers: { 'user-agent': ua },
        })
        expect(isAgentRequest(request)).toBe(true)
      })
    })

    it('should return false for human user agents', () => {
      const humanUserAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
      ]

      humanUserAgents.forEach((ua) => {
        const request = new Request('https://example.com', {
          headers: { 'user-agent': ua },
        })
        expect(isAgentRequest(request)).toBe(false)
      })
    })

    it('should return true when Accept header contains application/json', () => {
      const request = new Request('https://example.com', {
        headers: {
          'user-agent': 'MyApp/1.0',
          accept: 'application/json',
        },
      })
      expect(isAgentRequest(request)).toBe(true)
    })

    it('should return true when Accept header contains text/markdown', () => {
      const request = new Request('https://example.com', {
        headers: {
          'user-agent': 'MyApp/1.0',
          accept: 'text/markdown',
        },
      })
      expect(isAgentRequest(request)).toBe(true)
    })

    it('should return true for custom agent headers', () => {
      const request = new Request('https://example.com', {
        headers: {
          'user-agent': 'MyApp/1.0',
          'x-agent': 'true',
        },
      })
      expect(isAgentRequest(request)).toBe(true)
    })
  })

  describe('getClientType', () => {
    it('should return "agent" for bot requests', () => {
      const request = new Request('https://example.com', {
        headers: { 'user-agent': 'Googlebot/2.1' },
      })
      expect(getClientType(request)).toBe('agent')
    })

    it('should return "human" for human requests', () => {
      const request = new Request('https://example.com', {
        headers: {
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124',
        },
      })
      expect(getClientType(request)).toBe('human')
    })
  })

  describe('getPreferredFormat', () => {
    it('should return "html" for human requests', () => {
      const request = new Request('https://example.com', {
        headers: {
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124',
          accept: 'text/html,application/xhtml+xml',
        },
      })
      expect(getPreferredFormat(request)).toBe('html')
    })

    it('should return "json" when Accept header contains application/json', () => {
      const request = new Request('https://example.com', {
        headers: {
          'user-agent': 'curl/7.68.0',
          accept: 'application/json',
        },
      })
      expect(getPreferredFormat(request)).toBe('json')
    })

    it('should return "markdown" when Accept header contains text/markdown', () => {
      const request = new Request('https://example.com', {
        headers: {
          'user-agent': 'curl/7.68.0',
          accept: 'text/markdown',
        },
      })
      expect(getPreferredFormat(request)).toBe('markdown')
    })

    it('should return "json" as default for agent requests', () => {
      const request = new Request('https://example.com', {
        headers: { 'user-agent': 'curl/7.68.0' },
      })
      expect(getPreferredFormat(request)).toBe('json')
    })
  })

  describe('getAgentInfo', () => {
    it('should return complete agent info', () => {
      const request = new Request('https://example.com', {
        headers: {
          'user-agent': 'Claude-Web/1.0',
          accept: 'application/json',
        },
      })
      const info = getAgentInfo(request)

      expect(info.isAgent).toBe(true)
      expect(info.clientType).toBe('agent')
      expect(info.format).toBe('json')
      expect(info.userAgent).toBe('Claude-Web/1.0')
    })
  })
})