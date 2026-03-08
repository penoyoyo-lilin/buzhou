import { defineConfig } from 'vitest/config'
import path from 'path'
import { config } from 'dotenv'

// 加载 .env 文件
config({ path: path.resolve(__dirname, '.env') })

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/services/**/*.ts', 'src/lib/**/*.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})