/**
 * Next.js Instrumentation
 * 在服务器启动时执行初始化代码
 */

export async function register() {
  // 仅在服务器端运行
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // 动态导入事件处理器
    const { registerArticleEventHandlers } = await import('@/core/events/handlers')
    registerArticleEventHandlers()
    console.log('[Instrumentation] Article event handlers registered')
  }
}