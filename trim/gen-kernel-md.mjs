/** Generate KERNEL.md (keep/delete report) for the trimmed workspace. */
import { readFileSync, writeFileSync } from 'node:fs';

const report = JSON.parse(readFileSync('D:/dsh/trim-report.json', 'utf8'));
const { totals, keep, delete: del } = report;

const KEEP_REASON = {
  'vendor': 'L0 微内核：vendored cordis 框架与插件加载器',
  'native/landlock-run/packages': 'L2 运行时：Linux Landlock 沙箱启动器（subprocess-local 依赖链）',
  'apps': '启动器：裁剪后的 dsh CLI（headless/dump-config/plugin 三个入口）',
  'packages/core': 'L1 契约 + L2 循环：agent / agent-loop / session / system-prompt / tools / scope',
  'packages/bundle': '组合层：dsh-base（内核组合）+ dsh-headless（一次性运行器）',
  'packages/boot': '启动胶水：profile 引导 / 命令行参数',
  'packages/llm': 'LLM 能力：中立接口 + DeepSeek/pi-ai 适配器 + 重试 + token 计量',
  'packages/typert': 'RPC 类型图：协议 / 注册表 / 加载器 / 生成器（构建期）',
  'packages/api': 'Typert RPC 网关（dsh-base 的 typert-gateway 行）',
  'packages/session': '会话持久化 / 投影 / 标题 / 遥测 / 检查点',
  'packages/session-query': '会话查询 + SQLite 后端',
  'packages/settings': '用户设置能力 + 文件提供者',
  'packages/credentials': '凭据/授权能力 + 本地提供者',
  'packages/attachment': '附件（图片字节）能力与本地后端',
  'packages/fs': '文件系统能力 + 沙箱 + fs 工具组',
  'packages/shell': 'shell 能力 + bash/pwsh 沙箱与工具',
  'packages/subprocess': '子进程能力 + 本地进程树 + Win32 库',
  'packages/sandbox': '沙箱能力 + 本地实现 + 策略 + Windows ACL',
  'packages/skill': '技能注册表 + 文件系统发现 + 目录/加载工具',
  'packages/compaction': '上下文压缩能力 + basic 提供者 + 工具结果修剪',
  'packages/subagent': '子代理能力 + 进程内 spawn/fork + 委派工具',
  'packages/workflow': '工作流引擎 + worker 线程 + workflow/ralph 工具',
  'packages/goal': '目标服务 + 轮次驱动 + goal 工具与命令',
  'packages/plan': '计划模式（plan mode）',
  'packages/preset': 'agent 预设组合（standard/ptc 可用）+ persona',
  'packages/interaction': '命令 / 审批 / 权限预设 / 用户提问',
  'packages/jobs': '后台任务注册表 + 本地实现 + jobs 工具',
  'packages/guard': '循环卫生：重复工具提醒 + 工具超时策略',
  'packages/spill': '大输出外溢（spill）策略与本地实现',
  'packages/code-runtime': 'Code Mode 运行时 + worker 线程后端',
  'packages/web': 'web 能力 + DeepSeek/Exa 搜索提供者 + web_search 工具',
  'packages/storage': '存储能力 + JSON/域实现（web 外壳之外的通用件）',
  'packages/identity': '匿名用户 ID',
  'packages/context': 'agent-instructions（AGENTS.md 指令注入）',
  'packages/feedback': 'command-feedback（/feedback 命令）',
  'packages/extensions': 'cordis-host-runner + tool-cordis（typert 生成器测试链）',
  'packages/host': 'webserver + directory-picker（api 网关测试链）',
  'packages/client': 'client-connection（api 网关测试链）',
  'packages/runtime-diagnostics': 'invariants（运行时不变量注册）',
  'packages/test-support': 'agent-loop-testkit / llm-mock-server / loader-smoke（测试）',
  'packages/util': '零依赖工具包（brand/home-paths/timeout/atomic-write 等）',
  'packages/todo': 'todo_write 工具',
};

const DELETE_REASON = {
  '(root)': 'website（文档站 VitePress 工程）',
  'apps': 'apps/web（Web 前端应用与 e2e 脚手架）',
  'native': 'landlock-run workspace 根胶水（Cargo 构建根，预编译包已保留）',
  'packages/acp': 'Agent Client Protocol 服务器（自动化协议外壳）',
  'packages/api': 'Remote BFF：session/settings/workspace 控制器（Web 外壳的 API 面）',
  'packages/bundle': 'web-app / sdk-app / sdk-minimal / acp-app 组合包',
  'packages/client': '浏览器 UI 全部 43 个包（ui-* / store / locale / theme …）',
  'packages/context': 'file/session/time/tmux 上下文插件（Web 外壳的运行时上下文）',
  'packages/core': 'agent-tool-presentation 之外无；实际删除见其组',
  'packages/e2b': 'E2B 云沙箱 POC（fs/subprocess 适配器）',
  'packages/experimental': '全部 9 个实验包（agent-team / webworker / inspector …）',
  'packages/extensions': 'cordis-client-runner / ui-cordis（浏览器侧 cordis）',
  'packages/feedback': 'message-feedback（Web 消息反馈域）',
  'packages/hooks': 'Claude Code / Codex 钩子桥',
  'packages/host': 'frontend-static / plugin-inventory / directory-picker-{auto,browse,native}',
  'packages/interaction': 'tool-ask-user 已保留；无',
  'packages/lsp': '语言服务器能力与工具',
  'packages/mcp': 'MCP 客户端',
  'packages/preset': '无（persona 已补回）',
  'packages/schedule': '调度（Web 外壳的 schedule 域）',
  'packages/sdk': 'TypeScript SDK（JSON-RPC client/server/protocol）',
  'packages/session': 'session-stats / turn-outline / title-all-prompts-llm（Web 投影）',
  'packages/session-query': 'session-log-export / tool-session-query',
  'packages/shell': 'tool-bash-persistent / tool-pwsh-persistent（persistent shell，随 terminal 删除）',
  'packages/storage': 'storage-sqlite',
  'packages/subagent': 'acp / claude-code / codex / dsh-sdk 外部子代理提供者',
  'packages/terminal': 'PTY 终端（terminal/terminal-bash/tool-terminal）',
  'packages/test-support': 'client-runtime / llm-replay / session-snapshot',
  'packages/util': 'native-command / workspace-path（仅 Web/CLI 全量使用）',
  'packages/web': 'web-search-perplexity',
  'packages/webhook': 'webhook 入口 + GitHub 提供者',
  'packages/workspace': 'workspace 域（Web 多工作区）',
  'python': 'Python SDK 运行时闭包清单',
};

const keepRows = keep.map(({ group, packages }) => {
  const reason = KEEP_REASON[group] ?? '';
  return `| \`${group}\` | ${packages.length} | ${reason} |`;
}).join('\n');

const delRows = del.map(({ group, packages }) => {
  const reason = DELETE_REASON[group] ?? '';
  const names = packages.map((n) => n.replace('@deepseek-ai/', '')).join(', ');
  return `| \`${group}\` | ${packages.length} | ${reason} |\n|  |  | ${names} |`;
}).join('\n');

const md = `# KERNEL.md — DSH 内核裁剪报告

> 上游：deepseek-ai/deepseek-harness@master（0.1.2-rc.1，tarball 快照）
> 裁剪方法：以 \`dsh-base\` + \`dsh-headless\` 两个 bundle 为根做 workspace 依赖闭包，
> 加上 CLI 启动胶水、构建期工具（typert 生成器）、测试支撑，以及 agent 预设面
> （persona / tool-ask-user / agent-tool-presentation）。

## 总量

| | 包数 |
|---|---|
| 上游 workspace 包 | ${totals.upstream} |
| **保留（内核）** | **${totals.keep}** |
| 删除 | ${totals.delete} |
| 裁剪后源码体积 | ~17 MB（原 checkout ~90 MB 源码） |

## 内核定义

内核 = 可以不依赖 Host / HTTP / 浏览器运行的 Agent 运行时：

\`\`\`
L0  vendor/cordis          微内核：IoC 容器、服务 provide/inject、realm 隔离、插件加载
L1  packages/core/*        契约：agent / session / tools / system-prompt（接口与事件词汇）
L2  agent-loop + llm/* +   运行时：agent 循环、LLM 适配器、压缩、子代理、会话持久化、
    session/* sandbox/* …  沙箱与审批、工具执行管道（由 packages/bundle/base 组合）
L3  tool-* 插件            工具：fs / pwsh / subagent / workflow / web / todo / skill …
启动 apps/cli (裁剪后)      dsh --profile headless / --dump-config / plugin
\`\`\`

组合机制不变：profile = bundle 层 + cordis.patch.yml 覆盖，按 id patch。
内核workspace 自带的 headless profile 即"只挂内核"的证明（81 个插件行，无 Host/HTTP/浏览器）。

## 保留清单（${totals.keep} 个包，按目录分组）

| 目录 | 数量 | 保留理由 |
|---|---|---|
${keepRows}

## 删除清单（${totals.delete} 个包，按目录分组）

| 目录 | 数量 | 删除理由 / 包名 |
|---|---|---|
${delRows}

## 根配置改动

- \`package.json\`：scripts 仅保留 build（host 面）/ clean / test / typecheck / dsh / gen-tsconfig-paths；devDependencies 裁剪为构建+测试必需集。
- \`pnpm-workspace.yaml\`：workspace glob 裁剪（去掉 website、python、apps/web、native 构建根）；allowBuilds/patchedDependencies 仅保留内核依赖链所需（node-pty、koffi、esbuild）。
- \`tsconfig.base.json\`：paths 中指向已删包的别名已移除（运行 \`pnpm run gen-tsconfig-paths\` 可再生）。
- \`tsconfig.host.json\`：references/include 裁剪到保留包；\`tsconfig.client.json\` 删除（无 Client 面）。
- \`apps/cli\`：dependencies 从 70+ 裁剪到启动胶水 + 两个 bundle + 预设面引用（预设行的插件名在运行时从 CLI 安装目录解析）；tests 仅保留 6 个内核可运行套件。
- \`scripts/\`：仅保留 build/test 链路引用的 9 个脚本；\`patches/\` 仅保留 node-pty 补丁。

## 已知取舍

- \`minimal\` agent 预设不可用：它引用 persistent shell（terminal-bash / tool-*-persistent），已随 terminal 组删除。standard / ptc 预设可用。
- \`cordis\` agent 预设的 cordis 开发工具（tool-cordis / cordis-host-runner）因 typert 生成器测试链保留，可用。
- 需要 Web UI 时：把 \`packages/client\`、\`packages/host\`、\`apps/web\`、\`bundle/web-app\` 从上游拷回并恢复 tsconfig 引用即可（分层未被破坏）。
- telemetry（OTLP 上报）在 dsh-base 中默认 DISABLED，内核保持默认。
`;
writeFileSync('D:/dsh/dsh-kernel/KERNEL.md', md);
console.log('KERNEL.md written,', md.length, 'chars');
