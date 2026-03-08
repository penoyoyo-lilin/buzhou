# AI Agent 知识社区 MVP 内容目录清单

> 本目录清单基于“AI Agent 视角”设计，每篇内容都设计为独立解决一个具体问题，方便 AI 在 vibe coding 时精准检索和调用。
>
> MVP 阶段建议完成约 35 篇核心条目，按优先级（P0/P1）分级。

---

## 目录结构总览

```text
/mvp-knowledge-base
├── 01-foundation          # 基础认知与协议（4篇）
├── 02-transport           # 连接与协议层排错（4篇）
├── 03-tools-filesystem    # 核心工具：文件系统（5篇）
├── 04-tools-postgres      # 核心工具：数据库（6篇）
├── 05-tools-github        # 核心工具：代码仓库（5篇）
├── 06-error-codes         # 通用错误码库（5篇）
└── 07-scenarios           # 端到端实战场景（4篇）
```

---

## 详细清单

### 01. 基础认知与协议 (Foundation)
*目标：让 AI 理解 MCP 是什么，以及在 Claude Code 中如何正确配置。*

| 序号 | 文档ID | 标题 | 内容摘要 | 优先级 |
|:---:|:---:|:---|:---|:---:|
| 1-1 | FOUND-001 | What is MCP and why does my coding agent need it? | 解释 MCP 的角色（连接器），类比“给 AI 装上手和眼”。 | P0 |
| 1-2 | FOUND-002 | How to configure MCP servers in Claude Code? | `claude_desktop_config.json` 的标准结构、路径规范、格式要求。 | P0 |
| 1-3 | FOUND-003 | What is the difference between `stdio` and `SSE` transports? | 解释两种传输机制的区别，以及何时选择哪一种。 | P1 |
| 1-4 | FOUND-004 | How to check if an MCP server is running correctly? | 教 AI 如何检查进程状态、查看 MCP 日志。 | P1 |

---

### 02. 连接与协议层排错 (Transport)
*目标：解决“连不上”、“启动就挂”等底层环境问题。这是 AI 最难自己解决的问题。*

| 序号 | 文档ID | 标题 | 内容摘要 | 优先级 |
|:---:|:---:|:---|:---|:---:|
| 2-1 | TRANS-001 | Troubleshoot: MCP Server fails to start (Process exited) | 排查路径错误、权限不足、依赖缺失导致进程启动即退出。 | P0 |
| 2-2 | TRANS-002 | Troubleshoot: "Connection refused" or Timeout errors | 排查端口占用、防火墙、网络策略问题。 | P0 |
| 2-3 | TRANS-003 | Troubleshoot: Python environment issues (`uvx` / `pip`) | 解决 Python 版本不兼容、虚拟环境未激活导致的工具调用失败。 | P1 |
| 2-4 | TRANS-004 | Troubleshoot: Node.js environment issues (`npx`) | 解决 Node 版本不匹配、npm 包缺失导致的工具调用失败。 | P1 |

---

### 03. 核心工具：Filesystem (文件系统)
*目标：解决 AI 读写本地文件时的权限和路径问题。*

| 序号 | 文档ID | 标题 | 内容摘要 | 优先级 |
|:---:|:---:|:---|:---|:---:|
| 3-1 | TOOL-FS-001 | Guide: Setup `mcp-server-filesystem` correctly | 标准配置模板，重点讲解 `allowedDirectories` 参数。 | P0 |
| 3-2 | TOOL-FS-002 | Error: "Path not allowed" when reading/writing files | 解决路径不在白名单内、软链接解析错误问题。 | P0 |
| 3-3 | TOOL-FS-003 | Error: "Permission denied" accessing specific folder | 解决操作系统层面的读写权限问题。 | P1 |
| 3-4 | TOOL-FS-004 | How to access files outside the allowed directories? | 安全访问项目外文件的最佳实践（不要直接开放根目录）。 | P1 |
| 3-5 | TOOL-FS-005 | Best Practice: Handling relative vs absolute paths | 教 AI 在写代码时如何处理相对路径和绝对路径的转换。 | P1 |

---

### 04. 核心工具：Postgres (数据库)
*目标：解决 AI 连接和查询数据库时的配置与参数问题。*

| 序号 | 文档ID | 标题 | 内容摘要 | 优先级 |
|:---:|:---:|:---|:---|:---:|
| 4-1 | TOOL-PG-001 | Guide: Setup `mcp-server-postgres` connection | 标准配置模板，重点讲解连接串的安全写法。 | P0 |
| 4-2 | TOOL-PG-002 | Error: "Connection refused" to PostgreSQL server | 排查 Postgres 服务未启动、端口配置错误。 | P0 |
| 4-3 | TOOL-PG-003 | Error: Invalid params (missing `connection_string`) | 解决 AI 调用工具时遗漏必填参数的问题。 | P0 |
| 4-4 | TOOL-PG-004 | Error: Authentication failed (password/auth method) | 解决 `pg_hba.conf` 配置错误、密码错误问题。 | P1 |
| 4-5 | TOOL-PG-005 | How to query specific tables safely? | 示范如何使用 `query` 工具执行安全的 SELECT 查询。 | P1 |
| 4-6 | TOOL-PG-006 | How to inspect database schema? | 教 AI 如何使用工具查询表结构和字段类型。 | P1 |

---

### 05. 核心工具：GitHub (代码仓库)
*目标：解决 AI 操作 GitHub 时的认证和权限问题。*

| 序号 | 文档ID | 标题 | 内容摘要 | 优先级 |
|:---:|:---:|:---|:---|:---:|
| 5-1 | TOOL-GH-001 | Guide: Setup GitHub MCP server authentication | 配置 Personal Access Token (PAT) 的正确方法。 | P0 |
| 5-2 | TOOL-GH-002 | Error: "Unauthorized" or "Bad credentials" | 解决 Token 过期、权限不足问题。 | P0 |
| 5-3 | TOOL-GH-003 | Error: "Repository not found" | 解决仓库名称错误、私有仓库权限问题。 | P1 |
| 5-4 | TOOL-GH-004 | How to create a Pull Request via MCP? | 演示从创建分支到提交 PR 的完整工具调用链。 | P1 |
| 5-5 | TOOL-GH-005 | How to search code within a repository? | 使用 `search_code` 工具的正确姿势。 | P1 |

---

### 06. 通用错误码库 (Error Codes)
*目标：建立“错误码 -> 排查动作”的直接映射，这是 AI 最容易理解的格式。*

| 序号 | 文档ID | 标题 | 内容摘要 | 优先级 |
|:---:|:---:|:---|:---|:---:|
| 6-1 | ERR-001 | Error Code: MCP-JSONRPC-32600 (Invalid Request) | 解释 JSON 格式错误，排查 `config.json` 写法。 | P0 |
| 6-2 | ERR-002 | Error Code: MCP-JSONRPC-32601 (Method Not Found) | 解释调用了不存在的工具名，检查拼写和工具加载状态。 | P0 |
| 6-3 | ERR-003 | Error Code: MCP-JSONRPC-32602 (Invalid Params) | **高频错误**。解释参数缺失或类型错误，提供检查清单。 | P0 |
| 6-4 | ERR-004 | Error Code: MCP-JSONRPC-32603 (Internal Error) | 解释服务端执行崩溃，排查日志细节。 | P0 |
| 6-5 | ERR-005 | Error Code: ToolExecutionTimeout | 解释工具执行超时，排查网络或查询过慢问题。 | P1 |

---

### 07. 端到端实战场景 (Scenarios)
*目标：教 AI 如何“组合拳”解决问题，提升多步推理能力。*

| 序号 | 文档ID | 标题 | 内容摘要 | 优先级 |
|:---:|:---:|:---|:---|:---:|
| 7-1 | SCE-001 | Scenario: Query database and save results to JSON | 组合 `postgres.query` + `filesystem.write_file`。 | P0 |
| 7-2 | SCE-002 | Scenario: Read local code and commit to GitHub | 组合 `filesystem.read_file` + `github.create_commit`。 | P1 |
| 7-3 | SCE-003 | Scenario: Fix a bug based on error log | 从读取日志 -> 搜索错误码 -> 修改代码 -> 验证修复的完整闭环。 | P1 |
| 7-4 | SCE-004 | Scenario: Analyze project dependencies | 读取 `package.json` / `requirements.txt` -> 搜索文档 -> 建议更新。 | P1 |

---

## 实施建议

### 1. 优先级策略

**第一阶段（P0 - 约 20 篇）**：
- 基础认知：`FOUND-001`, `FOUND-002`
- 连接排错：`TRANS-001`, `TRANS-002`
- 核心工具配置：`TOOL-FS-001`, `TOOL-PG-001`, `TOOL-GH-001`
- 常见工具错误：`TOOL-FS-002`, `TOOL-PG-002`, `TOOL-PG-003`, `TOOL-GH-002`
- 核心错误码：`ERR-001`, `ERR-002`, `ERR-003`, `ERR-004`
- 基础场景：`SCE-001`

**第二阶段（P1 - 约 15 篇）**：
- 进阶认知：`FOUND-003`, `FOUND-004`
- 环境排错：`TRANS-003`, `TRANS-004`
- 进阶工具使用：`TOOL-FS-003/004/005`, `TOOL-PG-004/005/006`, `TOOL-GH-003/004/005`
- 其他错误码：`ERR-005`
- 进阶场景：`SCE-002/003/004`

### 2. 文档模板规范

每篇文档应包含以下结构：

```yaml
---
doc_id: [文档ID]
title: [标题]
category: [分类]
tags:
  - [标签1]
  - [标签2]
---

## 元信息
[错误码/工具名/场景描述]

## 概述
[问题背景和目标]

## 前置条件
[环境要求、版本信息]

## 步骤/排查流程
[详细步骤，包含命令、代码示例]

## 验证方法
[如何确认问题已解决]

## 相关文档
[链接到相关错误码或工具文档]
```

### 3. 内容质量要求

- ✅ **可执行性**: 所有命令、代码必须可直接复制粘贴运行
- ✅ **自包含**: 每篇文档独立完整，不依赖其他文档上下文
- ✅ **结构化**: 使用标准化的章节结构，便于 AI 解析
- ✅ **精确性**: 路径、参数名、错误码必须精确，避免模糊描述
- ✅ **版本标注**: 标明适用的工具版本和系统环境

---

## 统计信息

- **总文档数**: 35 篇
- **P0 优先级**: 20 篇
- **P1 优先级**: 15 篇
- **分类覆盖**:
  - 基础认知：4 篇
  - 连接排错：4 篇
  - 工具配置：16 篇（filesystem 5 + postgres 6 + github 5）
  - 错误码库：5 篇
  - 实战场景：4 篇
  - 其他：2 篇

---

*本目录清单将根据实际使用反馈和技术栈更新持续迭代。*
