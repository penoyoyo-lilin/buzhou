import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

interface PackageJsonLike {
  scripts?: Record<string, string>
}

function readScripts(): Record<string, string> {
  const pkgPath = path.resolve(process.cwd(), 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as PackageJsonLike
  return pkg.scripts || {}
}

describe('dev scripts sqlite safety', () => {
  it('dev:clean should route through sqlite schema setup', () => {
    const scripts = readScripts()
    expect(scripts['dev:clean']).toBe('npm run dev:sqlite')
  })

  it('dev:reset should force sqlite schema + prisma generate before next dev', () => {
    const scripts = readScripts()
    const reset = scripts['dev:reset'] || ''
    expect(reset).toContain('schema.sqlite.prisma')
    expect(reset).toContain('prisma generate')
    expect(reset).toContain('next dev')
  })
})
