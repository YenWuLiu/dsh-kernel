# KERNEL.md — DSH 内核裁剪报告

> 上游：deepseek-ai/deepseek-harness@master（0.1.2-rc.1，tarball 快照）
> 裁剪方法：以 `dsh-base` + `dsh-headless` 两个 bundle 为根做 workspace 依赖闭包，
> 加上 CLI 启动胶水、构建期工具（typert 生成器）、测试支撑，以及 agent 预设面
> （persona / tool-ask-user / agent-tool-presentation）。

## 总量

| | 包数 |
|---|---|
| 上游 workspace 包 | 267 |
| **保留（内核）** | **151** |
| 删除 | 116 |
| 裁剪后源码体积 | ~17 MB（原 checkout ~90 MB 源码） |

## 内核定义

内核 = 可以不依赖 Host / HTTP / 浏览器运行的 Agent 运行时：

```
L0  vendor/cordis          微内核：IoC 容器、服务 provide/inject、realm 隔离、插件加载
L1  packages/core/*        契约：agent / session / tools / system-prompt（接口与事件词汇）
L2  agent-loop + llm/* +   运行时：agent 循环、LLM 适配器、压缩、子代理、会话持久化、
    session/* sandbox/* …  沙箱与审批、工具执行管道（由 packages/bundle/base 组合）
L3  tool-* 插件            工具：fs / pwsh / subagent / workflow / web / todo / skill …
启动 apps/cli (裁剪后)      dsh --profile headless / --dump-config / plugin
```

组合机制不变：profile = bundle 层 + cordis.patch.yml 覆盖，按 id patch。
内核workspace 自带的 headless profile 即"只挂内核"的证明（81 个插件行，无 Host/HTTP/浏览器）。

## 保留清单（151 个包，按目录分组）

| 目录 | 数量 | 保留理由 |
|---|---|---|
| `apps` | 1 | 启动器：裁剪后的 dsh CLI（headless/dump-config/plugin 三个入口） |
| `native/landlock-run/packages` | 3 | L2 运行时：Linux Landlock 沙箱启动器（subprocess-local 依赖链） |
| `packages/api` | 1 | Typert RPC 网关（dsh-base 的 typert-gateway 行） |
| `packages/attachment` | 2 | 附件（图片字节）能力与本地后端 |
| `packages/boot` | 2 | 启动胶水：profile 引导 / 命令行参数 |
| `packages/bundle` | 2 | 组合层：dsh-base（内核组合）+ dsh-headless（一次性运行器） |
| `packages/client` | 1 | client-connection（api 网关测试链） |
| `packages/code-runtime` | 2 | Code Mode 运行时 + worker 线程后端 |
| `packages/compaction` | 4 | 上下文压缩能力 + basic 提供者 + 工具结果修剪 |
| `packages/context` | 1 | agent-instructions（AGENTS.md 指令注入） |
| `packages/core` | 8 | L1 契约 + L2 循环：agent / agent-loop / session / system-prompt / tools / scope |
| `packages/credentials` | 3 | 凭据/授权能力 + 本地提供者 |
| `packages/extensions` | 2 | cordis-host-runner + tool-cordis（typert 生成器测试链） |
| `packages/feedback` | 1 | command-feedback（/feedback 命令） |
| `packages/fs` | 7 | 文件系统能力 + 沙箱 + fs 工具组 |
| `packages/goal` | 4 | 目标服务 + 轮次驱动 + goal 工具与命令 |
| `packages/guard` | 2 | 循环卫生：重复工具提醒 + 工具超时策略 |
| `packages/host` | 2 | webserver + directory-picker（api 网关测试链） |
| `packages/identity` | 1 | 匿名用户 ID |
| `packages/interaction` | 5 | 命令 / 审批 / 权限预设 / 用户提问 |
| `packages/jobs` | 3 | 后台任务注册表 + 本地实现 + jobs 工具 |
| `packages/llm` | 7 | LLM 能力：中立接口 + DeepSeek/pi-ai 适配器 + 重试 + token 计量 |
| `packages/plan` | 1 | 计划模式（plan mode） |
| `packages/preset` | 2 | agent 预设组合（standard/ptc 可用）+ persona |
| `packages/runtime-diagnostics` | 1 | invariants（运行时不变量注册） |
| `packages/sandbox` | 4 | 沙箱能力 + 本地实现 + 策略 + Windows ACL |
| `packages/session` | 11 | 会话持久化 / 投影 / 标题 / 遥测 / 检查点 |
| `packages/session-query` | 2 | 会话查询 + SQLite 后端 |
| `packages/settings` | 2 | 用户设置能力 + 文件提供者 |
| `packages/shell` | 8 | shell 能力 + bash/pwsh 沙箱与工具 |
| `packages/skill` | 4 | 技能注册表 + 文件系统发现 + 目录/加载工具 |
| `packages/spill` | 3 | 大输出外溢（spill）策略与本地实现 |
| `packages/storage` | 3 | 存储能力 + JSON/域实现（web 外壳之外的通用件） |
| `packages/subagent` | 6 | 子代理能力 + 进程内 spawn/fork + 委派工具 |
| `packages/subprocess` | 3 | 子进程能力 + 本地进程树 + Win32 库 |
| `packages/test-support` | 3 | agent-loop-testkit / llm-mock-server / loader-smoke（测试） |
| `packages/todo` | 1 | todo_write 工具 |
| `packages/typert` | 4 | RPC 类型图：协议 / 注册表 / 加载器 / 生成器（构建期） |
| `packages/util` | 11 | 零依赖工具包（brand/home-paths/timeout/atomic-write 等） |
| `packages/web` | 5 | web 能力 + DeepSeek/Exa 搜索提供者 + web_search 工具 |
| `packages/workflow` | 4 | 工作流引擎 + worker 线程 + workflow/ralph 工具 |
| `vendor` | 9 | L0 微内核：vendored cordis 框架与插件加载器 |

## 删除清单（116 个包，按目录分组）

| 目录 | 数量 | 删除理由 / 包名 |
|---|---|---|
| `(root)` | 1 | website（文档站 VitePress 工程） |
|  |  | website |
| `apps` | 1 | apps/web（Web 前端应用与 e2e 脚手架） |
|  |  | dsh-web-frontend |
| `native` | 1 | landlock-run workspace 根胶水（Cargo 构建根，预编译包已保留） |
|  |  | node-addon-landlock-run-workspace |
| `packages/acp` | 1 | Agent Client Protocol 服务器（自动化协议外壳） |
|  |  | dsh-acp |
| `packages/api` | 4 | Remote BFF：session/settings/workspace 控制器（Web 外壳的 API 面） |
|  |  | dsh-api-remotes, dsh-api-session-controller, dsh-api-settings-controller, dsh-api-workspace-controller |
| `packages/bundle` | 4 | web-app / sdk-app / sdk-minimal / acp-app 组合包 |
|  |  | dsh-acp-app, dsh-sdk-app, dsh-sdk-minimal, dsh-web-app |
| `packages/client` | 43 | 浏览器 UI 全部 43 个包（ui-* / store / locale / theme …） |
|  |  | dsh-client-hmr, dsh-client-locale, dsh-client-modules, dsh-client-store, dsh-client-ui-agent-preset, dsh-client-ui-approval, dsh-client-ui-attachment, dsh-client-ui-brand-official, dsh-client-ui-chat, dsh-client-ui-commands, dsh-client-ui-conversation, dsh-client-ui-deliverables, dsh-client-ui-directory-picker-browse, dsh-client-ui-directory-picker-native, dsh-client-ui-goal, dsh-client-ui-input-trigger, dsh-client-ui-jobs, dsh-client-ui-layout, dsh-client-ui-message-feedback, dsh-client-ui-model-selection, dsh-client-ui-permission-presets, dsh-client-ui-plan, dsh-client-ui-primitives, dsh-client-ui-reference, dsh-client-ui-renderer, dsh-client-ui-schedule, dsh-client-ui-session, dsh-client-ui-settings, dsh-client-ui-settings-general, dsh-client-ui-settings-models, dsh-client-ui-settings-plugin-inventory, dsh-client-ui-settings-plugins, dsh-client-ui-sidebar, dsh-client-ui-skill, dsh-client-ui-slots, dsh-client-ui-subagent, dsh-client-ui-theme, dsh-client-ui-tool, dsh-client-ui-trajectory, dsh-client-ui-user-questions, dsh-client-ui-workflow-run, dsh-client-ui-workspace, dsh-client-web |
| `packages/context` | 5 | file/session/time/tmux 上下文插件（Web 外壳的运行时上下文） |
|  |  | dsh-file-reference, dsh-file-reference-local, dsh-session-reference, dsh-time-context, dsh-tmux-context |
| `packages/e2b` | 3 | E2B 云沙箱 POC（fs/subprocess 适配器） |
|  |  | dsh-e2b, dsh-fs-e2b, dsh-subprocess-e2b |
| `packages/experimental` | 9 | 全部 9 个实验包（agent-team / webworker / inspector …） |
|  |  | dsh-experimental-agent-team, dsh-experimental-agent-team-profile, dsh-experimental-agent-team-web-profile, dsh-experimental-client-ui-agent-team, dsh-experimental-code-runtime-python, dsh-experimental-inspector, dsh-experimental-tool-agent-team, dsh-experimental-webworker-packer, dsh-experimental-webworker-runtime |
| `packages/extensions` | 2 | cordis-client-runner / ui-cordis（浏览器侧 cordis） |
|  |  | dsh-client-ui-cordis, dsh-cordis-client-runner |
| `packages/feedback` | 1 | message-feedback（Web 消息反馈域） |
|  |  | dsh-message-feedback |
| `packages/hooks` | 3 | Claude Code / Codex 钩子桥 |
|  |  | dsh-hook-protocol, dsh-hooks-claude-code, dsh-hooks-codex |
| `packages/host` | 5 | frontend-static / plugin-inventory / directory-picker-{auto,browse,native} |
|  |  | dsh-host-directory-picker-auto, dsh-host-directory-picker-browse, dsh-host-directory-picker-native, dsh-host-frontend-static, dsh-host-plugin-inventory |
| `packages/lsp` | 3 | 语言服务器能力与工具 |
|  |  | dsh-lsp, dsh-lsp-stdio, dsh-tool-lsp |
| `packages/mcp` | 1 | MCP 客户端 |
|  |  | dsh-mcp-client |
| `packages/schedule` | 1 | 调度（Web 外壳的 schedule 域） |
|  |  | dsh-schedule |
| `packages/sdk` | 3 | TypeScript SDK（JSON-RPC client/server/protocol） |
|  |  | dsh-sdk-client, dsh-sdk-jsonrpc-server, dsh-sdk-protocol |
| `packages/session` | 3 | session-stats / turn-outline / title-all-prompts-llm（Web 投影） |
|  |  | dsh-session-stats, dsh-session-title-all-prompts-llm, dsh-session-turn-outline |
| `packages/session-query` | 2 | session-log-export / tool-session-query |
|  |  | dsh-session-log-export, dsh-tool-session-query |
| `packages/shell` | 2 | tool-bash-persistent / tool-pwsh-persistent（persistent shell，随 terminal 删除） |
|  |  | dsh-tool-bash-persistent, dsh-tool-pwsh-persistent |
| `packages/storage` | 1 | storage-sqlite |
|  |  | dsh-storage-sqlite |
| `packages/subagent` | 4 | acp / claude-code / codex / dsh-sdk 外部子代理提供者 |
|  |  | dsh-subagent-acp, dsh-subagent-claude-code, dsh-subagent-codex, dsh-subagent-dsh-sdk |
| `packages/terminal` | 3 | PTY 终端（terminal/terminal-bash/tool-terminal） |
|  |  | dsh-terminal, dsh-terminal-bash, dsh-tool-terminal |
| `packages/test-support` | 3 | client-runtime / llm-replay / session-snapshot |
|  |  | dsh-client-test-runtime, dsh-llm-replay, dsh-session-snapshot |
| `packages/util` | 2 | native-command / workspace-path（仅 Web/CLI 全量使用） |
|  |  | dsh-native-command, dsh-util-workspace-path |
| `packages/web` | 1 | web-search-perplexity |
|  |  | dsh-web-search-perplexity |
| `packages/webhook` | 2 | webhook 入口 + GitHub 提供者 |
|  |  | dsh-webhook, dsh-webhook-github |
| `packages/workspace` | 1 | workspace 域（Web 多工作区） |
|  |  | dsh-workspace |
| `python` | 1 | Python SDK 运行时闭包清单 |
|  |  | dsh-python-runtime-closure |

## 根配置改动

- `package.json`：scripts 仅保留 build（host 面）/ clean / test / typecheck / dsh / gen-tsconfig-paths；devDependencies 裁剪为构建+测试必需集。
- `pnpm-workspace.yaml`：workspace glob 裁剪（去掉 website、python、apps/web、native 构建根）；allowBuilds/patchedDependencies 仅保留内核依赖链所需（node-pty、koffi、esbuild）。
- `tsconfig.base.json`：paths 中指向已删包的别名已移除（运行 `pnpm run gen-tsconfig-paths` 可再生）。
- `tsconfig.host.json`：references/include 裁剪到保留包；`tsconfig.client.json` 删除（无 Client 面）。
- `apps/cli`：dependencies 从 70+ 裁剪到启动胶水 + 两个 bundle + 预设面引用（预设行的插件名在运行时从 CLI 安装目录解析）；tests 仅保留 6 个内核可运行套件（args / process-shutdown / telemetry-switch / source-launch / dsh-badge / headless-shutdown）。
- `scripts/`：仅保留 build/test 链路引用的 9 个脚本；`patches/` 仅保留 node-pty 补丁。
- `pnpm-lock.yaml` 未保留（其引用全部 267 个包）。依赖按范围重装，唯一漂移：`@earendil-works/pi-ai` 在 `llm-pi-ai` 中已钉死为 `0.84.2`（上游 lockfile 版本；^0.84.2 会拉到 0.84.4 引入新必需类型字段）。

## 裁剪后为通过构建所做的修订

- `native/landlock-run/tsconfig.base.json` 从上游恢复（entry 包的 tsconfig 继承它），并给其 entry 包补 `@types/node` devDependency（上游由已删的 native workspace 根胶水提供）。
- 删除与已删包耦合的测试：`apps/cli/tests/profiles/`（session-snapshot 夹具套件）、4 个引用未保留 gate 脚本的 spec（verify-export-jsdoc / gen-persistence-catalog / gen-tool-catalog / cordis-catalog）。
- 移除 2 个引用 `pty-send` 任务种类的 tool-jobs 测试用例（PTY 种类随 terminal 组删除）、1 个引用 `session-reference` 来源种类的 session-title 测试用例（随 session-reference 删除）。产品源码不受影响——错误仅存在于测试。
- `packages/api/gateway`、`packages/typert/registry`、`packages/client/connection` 的包级 `tsdown.config.ts` 删除（其引用了浏览器打包共享预设 `packages/client/tsdown.client.ts` 及其整条 client 构建链；删除后回退到根 tsdown 的 host 配置，且这三个包在上游 host 面本就 SKIP、由 client 面构建——内核 host 面现在直接产出其 node half）。两包的 `tsconfig.client.json` 及 solution 引用同步删除（指向已删的 `tsconfig.base.client.json`）。

## 验证结果（裁剪后实测）

| 检查 | 结果 |
|---|---|
| `pnpm install` | ✅ 通过（36s） |
| `pnpm run build`（tsc host + tsdown host） | ✅ 通过，0 错误 |
| `--profile headless --dump-default-config` | ✅ 88 插件行 = 上游 master 的 headless 组合（与 npm 0.1.1 的 81 行差异为版本漂移：+8 新增 −1 移除，非裁剪误差） |
| 真实 headless 任务（DeepSeek API） | ✅ 端到端跑通（源码直跑 `pnpm dsh` 与构建后 bin 均验证） |
| 单元测试（core/agent、core/session、core/tools、bundle、apps/cli） | ✅ 58 文件 / 1122 用例全过 |

## 已知取舍

- ~~`minimal` agent 预设不可用~~ → 已删除该预设（引用已裁剪的 terminal 组；剩余 standard / ptc / cordis 可用）。
- `cordis` agent 预设的 cordis 开发工具（tool-cordis / cordis-host-runner）因 typert 生成器测试链保留，可用。
- 需要 Web UI 时：把 `packages/client`、`packages/host`、`apps/web`、`bundle/web-app` 从上游拷回并恢复 tsconfig 引用即可（分层未被破坏）。
- telemetry（OTLP 上报）在 dsh-base 中默认 DISABLED，内核保持默认。

## 内核之上的新增（裁剪后迭代）

- `packages/core/chat-agent`（`@deepseek-ai/dsh-chat-agent`）：高层 chat Agent 门面——`createChatAgent(ctx)` 折叠注册表创建/模型选择/轮次驱动/进度投影为一个 API（`send` 串行化轮次、`onEvent` 投影 text-delta/tool-call/turn-end 等 UI 安全词汇）。内核包数 151 → 152。
- `apps/pet`：内核桌宠应用（见 apps/pet/README.md），验证了 approval/request 瀑布缝作为应用侧审批注册点（B5）与 tool-call → 气泡广播桥（D12）。
