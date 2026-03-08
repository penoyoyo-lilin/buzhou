/**
 * 测试 AI API 连接
 * 运行: npx tsx scripts/test-ai-api.ts
 */

import 'dotenv/config'

async function testAIApi() {
  const apiUrl = process.env.AI_API_URL
  const apiKey = process.env.AI_API_KEY
  const model = process.env.AI_MODEL || 'gpt-4o-mini'

  console.log('=== AI API 配置检查 ===')
  console.log('API URL:', apiUrl ? '已配置' : '未配置')
  console.log('API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : '未配置')
  console.log('Model:', model)
  console.log()

  if (!apiUrl || !apiKey) {
    console.error('❌ AI API 未配置，请检查 .env 文件中的 AI_API_URL 和 AI_API_KEY')
    return
  }

  console.log('正在测试 API 连接...')

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'user',
            content: '你好，请回复"测试成功"',
          },
        ],
        temperature: 0.7,
        max_tokens: 100,
      }),
    })

    console.log('HTTP 状态码:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ API 请求失败:', errorText)
      return
    }

    const data = await response.json()
    console.log('✅ API 连接成功!')
    console.log('响应:', JSON.stringify(data, null, 2).substring(0, 500))
  } catch (error) {
    console.error('❌ API 请求出错:', error)
  }
}

testAIApi()