#!/bin/bash
# ============================================
# 线上 API 完整测试脚本
# 测试所有公开和内部 API 端点
# ============================================

set -e

BASE_URL="${BASE_URL:-https://www.buzhou.io}"
INTERNAL_API_KEY="${INTERNAL_API_KEY:-}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass_count=0
fail_count=0

pass() {
  echo -e "${GREEN}✓ PASS${NC}: $1"
  ((pass_count++))
}

fail() {
  echo -e "${RED}✗ FAIL${NC}: $1"
  echo "  Response: $2"
  ((fail_count++))
}

warn() {
  echo -e "${YELLOW}⚠ WARN${NC}: $1"
}

echo "============================================"
echo "线上 API 测试"
echo "目标: $BASE_URL"
echo "时间: $(date)"
echo "============================================"
echo

# ============================================
# 1. 公开 API 测试
# ============================================
echo "--- 公开 API 测试 ---"

# 1.1 健康检查
echo "Testing: GET /api/health"
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/health")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')
if [ "$http_code" = "200" ]; then
  pass "Health check"
else
  fail "Health check" "$http_code"
fi

# 1.2 搜索接口
echo "Testing: GET /api/v1/search"
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/search")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')
if [ "$http_code" = "200" ]; then
  if echo "$body" | grep -q '"success":true'; then
    pass "Search API (no params)"
  else
    fail "Search API - wrong response format" "$body"
  fi
else
  fail "Search API" "$http_code"
fi

# 1.3 搜索带参数
echo "Testing: GET /api/v1/search?q=mcp&domain=mcp"
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/search?q=mcp&domain=mcp&lang=zh")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')
if [ "$http_code" = "200" ]; then
  if echo "$body" | grep -q '"success":true'; then
    pass "Search API with params"
  else
    fail "Search API with params - wrong format" "$body"
  fi
else
  fail "Search API with params" "$http_code"
fi

# 1.4 搜索 - 验证状态过滤
echo "Testing: GET /api/v1/search?status=verified"
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/search?status=verified")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')
if [ "$http_code" = "200" ]; then
  pass "Search API - status filter"
else
  fail "Search API - status filter" "$http_code"
fi

# 1.5 搜索 - domain 参数测试（使用下划线）
echo "Testing: GET /api/v1/search?domain=tools_filesystem"
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/search?domain=tools_filesystem")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')
if [ "$http_code" = "200" ]; then
  pass "Search API - domain filter (underscore)"
else
  fail "Search API - domain filter" "$http_code"
fi

# 1.6 搜索 - 无效 domain 参数
echo "Testing: GET /api/v1/search?domain=invalid_domain"
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/search?domain=invalid_domain")
http_code=$(echo "$response" | tail -n1)
if [ "$http_code" = "400" ]; then
  pass "Search API - invalid domain rejected"
else
  fail "Search API - invalid domain should return 400" "$http_code"
fi

# 1.7 统计接口
echo "Testing: GET /api/v1/stats"
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/stats")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')
if [ "$http_code" = "200" ]; then
  pass "Stats API"
else
  fail "Stats API" "$http_code"
fi

# 1.8 页脚链接
echo "Testing: GET /api/footer-links"
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/footer-links")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')
if [ "$http_code" = "200" ]; then
  pass "Footer links API"
else
  fail "Footer links API" "$http_code"
fi

# ============================================
# 2. 文章详情测试
# ============================================
echo
echo "--- 文章详情测试 ---"

# 先获取一个有效的文章 slug
first_slug=$(curl -s "$BASE_URL/api/v1/search?pageSize=1" | grep -o '"slug":"[^"]*"' | head -1 | sed 's/"slug":"//;s/"//')

if [ -n "$first_slug" ]; then
  echo "Using slug: $first_slug"

  # 2.1 HTML 格式
  echo "Testing: GET /zh/articles/$first_slug"
  response=$(curl -s -w "\n%{http_code}" "$BASE_URL/zh/articles/$first_slug")
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  if [ "$http_code" = "200" ]; then
    pass "Article HTML page"
  else
    fail "Article HTML page" "$http_code"
  fi

  # 2.2 Markdown 格式
  echo "Testing: GET /zh/articles/$first_slug?format=markdown"
  response=$(curl -s -w "\n%{http_code}" "$BASE_URL/zh/articles/$first_slug?format=markdown")
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  if [ "$http_code" = "200" ]; then
    if echo "$body" | grep -q "^# "; then
      pass "Article Markdown format"
    else
      fail "Article Markdown format - missing header" "$body"
    fi
  else
    fail "Article Markdown format" "$http_code"
  fi

  # 2.3 JSON 格式
  echo "Testing: GET /zh/articles/$first_slug?format=json"
  response=$(curl -s -w "\n%{http_code}" "$BASE_URL/zh/articles/$first_slug?format=json")
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  if [ "$http_code" = "200" ]; then
    if echo "$body" | grep -q '"id"'; then
      pass "Article JSON format"
    else
      fail "Article JSON format - missing id" "$body"
    fi
  else
    fail "Article JSON format" "$http_code"
  fi
else
  warn "No articles found, skipping article detail tests"
fi

# 2.4 不存在的文章
echo "Testing: GET /zh/articles/non-existent-article-slug"
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/zh/articles/non-existent-article-slug")
http_code=$(echo "$response" | tail -n1)
if [ "$http_code" = "404" ]; then
  pass "Non-existent article returns 404"
else
  fail "Non-existent article should return 404" "$http_code"
fi

# ============================================
# 3. Internal API 测试（需要 API Key）
# ============================================
echo
echo "--- Internal API 测试 ---"

if [ -z "$INTERNAL_API_KEY" ]; then
  warn "INTERNAL_API_KEY not set, skipping internal API tests"
else
  AUTH_HEADER="Authorization: Bearer $INTERNAL_API_KEY"

  # 3.1 统计数据
  echo "Testing: GET /api/internal/v1/analytics"
  response=$(curl -s -w "\n%{http_code}" -H "$AUTH_HEADER" "$BASE_URL/api/internal/v1/analytics?type=overview")
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  if [ "$http_code" = "200" ]; then
    if echo "$body" | grep -q '"success":true'; then
      pass "Internal analytics API"
    else
      fail "Internal analytics API - wrong format" "$body"
    fi
  else
    fail "Internal analytics API" "$http_code"
  fi

  # 3.2 验证人列表
  echo "Testing: GET /api/internal/v1/verifiers"
  response=$(curl -s -w "\n%{http_code}" -H "$AUTH_HEADER" "$BASE_URL/api/internal/v1/verifiers")
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  if [ "$http_code" = "200" ]; then
    pass "Internal verifiers API"
  else
    fail "Internal verifiers API" "$http_code"
  fi

  # 3.3 文章列表
  echo "Testing: GET /api/internal/v1/articles"
  response=$(curl -s -w "\n%{http_code}" -H "$AUTH_HEADER" "$BASE_URL/api/internal/v1/articles?page=1&pageSize=5")
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  if [ "$http_code" = "200" ]; then
    pass "Internal articles list API"
  else
    fail "Internal articles list API" "$http_code"
  fi

  # 3.4 无认证测试
  echo "Testing: GET /api/internal/v1/analytics without auth"
  response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/internal/v1/analytics")
  http_code=$(echo "$response" | tail -n1)
  if [ "$http_code" = "401" ]; then
    pass "Internal API rejects unauthenticated request"
  else
    fail "Internal API should return 401 for unauthenticated request" "$http_code"
  fi
fi

# ============================================
# 4. llms.txt 测试
# ============================================
echo
echo "--- llms.txt 测试 ---"

echo "Testing: GET /llms.txt"
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/llms.txt")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')
if [ "$http_code" = "200" ]; then
  if echo "$body" | grep -q "buzhou.io"; then
    pass "llms.txt accessible"
  else
    fail "llms.txt content check" "$body"
  fi
else
  fail "llms.txt" "$http_code"
fi

# ============================================
# 5. 页面路由测试
# ============================================
echo
echo "--- 页面路由测试 ---"

# 5.1 首页
echo "Testing: GET /"
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/")
http_code=$(echo "$response" | tail -n1)
if [ "$http_code" = "200" ]; then
  pass "Home page"
else
  fail "Home page" "$http_code"
fi

# 5.2 中文首页
echo "Testing: GET /zh"
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/zh")
http_code=$(echo "$response" | tail -n1)
if [ "$http_code" = "200" ]; then
  pass "Chinese home page"
else
  fail "Chinese home page" "$http_code"
fi

# 5.3 API 文档
echo "Testing: GET /zh/api-docs"
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/zh/api-docs")
http_code=$(echo "$response" | tail -n1)
if [ "$http_code" = "200" ]; then
  pass "API docs page"
else
  fail "API docs page" "$http_code"
fi

# ============================================
# 总结
# ============================================
echo
echo "============================================"
echo "测试完成"
echo "--------------------------------------------"
echo -e "通过: ${GREEN}$pass_count${NC}"
echo -e "失败: ${RED}$fail_count${NC}"
echo "============================================"

if [ $fail_count -gt 0 ]; then
  exit 1
fi