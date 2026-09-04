# dsh-pet-app — 内核桌宠（会管理电脑的桌面宠物）

基于 **dsh 内核**（本 workspace）驱动的桌面宠物：[dsh-pet](https://github.com/PC2005-cloud/dsh-pet) 的动画外壳 + 内核 Agent 大脑。对话即命令——桌宠收到的话会交给一个带完整工具目录的内核 Agent 执行，包括 **pwsh 管理本机**（查系统信息、管文件/进程、装软件、改配置……）。

```
┌────────────────────────────────────────────┐
│ Electron 透明置顶窗口（dsh-pet 桌面壳）       │
│  97 个手绘动画 · 拖拽/点击/漫游 · 右键菜单    │
│  对话输入框 → POST /dsh-pet-7340/chat        │
└──────────────┬─────────────────────────────┘
               │ HTTP 127.0.0.1:7340
┌──────────────▼─────────────────────────────┐
│ apps/pet（本包，cordis 插件 pet-server）      │
│  /config /thumb /font /pic → 配置与素材      │
│  /whisper → 人设碎碎念（裸 LLM，一句话）      │
│  /chat → 每宠一个内核 Agent（重点改造）       │
└──────────────┬─────────────────────────────┘
               │ cordis（dsh-base 组合）
┌──────────────▼─────────────────────────────┐
│ dsh 内核：agent-loop + llm-deepseek          │
│  工具：pwsh · fs · fs-search · jobs · todo   │
│  会话持久化（JSONL）· 压缩 · 沙箱/审批        │
└────────────────────────────────────────────┘
```

## 运行

```sh
cd D:\dsh\dsh-kernel
pnpm install                     # 首次（含 Electron 二进制下载；慢则设 ELECTRON_MIRROR）
pnpm --filter @deepseek-ai/dsh-pet-app start
```

启动后：内核引导（dsh-base + 本包 patch）→ pet-server 监听 `http://127.0.0.1:7340/dsh-pet-7340` → 拉起 Electron 透明窗（默认右上角，蓝毛小女仆）。**右键宠物 → 对话**，输入如「看看 C 盘剩余空间」「把 D 盘根目录列一下」「帮我打开记事本」——Agent 会用 pwsh 真的执行，并用桌宠口吻回复。

凭据/模型：复用 `~/.dsh` 的凭据与 settings（与 `dsh` CLI 相同，默认 deepseek-official / deepseek-v4-flash）。

## 关键环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `DSH_PERMISSION_MODE` | `danger-full-access`（bin 内兜底） | **桌宠默认完全访问**：沙箱不限制、审批不出现。这是"管理电脑"的语义；要收敛则显式设为 `workspace-write`（文件效果限于工作区，越权操作会因无审批端而失败） |
| `DSH_PET_NO_ELECTRON` | 未设 | `1` = 不起桌面窗口（仅 HTTP 服务，调试/无头环境用） |
| `DSH_PET_SMOKE_OUT` | 未设 | 设后 Electron 进冒烟模式：延时截图到该路径并退出（`DSH_PET_SMOKE_AFTER_MS` 控制延时） |
| `DSH_HOME` | `~/.dsh` | 会话/凭据/用户配置根；本 app 状态在 `$DSH_HOME/dsh-pet-agent/` |

## 结构

```
apps/pet/
├── src/
│   ├── bin.ts            # 引导：组合 [dsh-base patch, 本包 patch, 用户 overlay] → app-boot boot()
│   ├── server.ts         # pet-server 插件：/dsh-pet-7340 路由 + Electron 拉起
│   ├── agent-chat.ts     # 每宠一个内核 Agent（会话持久化、逐宠串行）
│   ├── electron.ts       # Electron 解析与 spawn（stdio 全 inherit/ignore——管道在沙箱 shell 下不可用）
│   └── vendor/           # 移植自 dsh-pet 的 host 模块（config 合并 / whisper 生成）
├── cordis.patch.yml      # 本包 bundle patch：禁用 web/subagent/workflow/skill/goal 等无关行 + 桌宠人设
├── runtime/electron-helper/  # dsh-pet 的 Electron 壳（含 shared-core.js）
└── assets/               # 100 个 webm 动画 + 字体 + 图标 + config.jsonc
```

与上游 dsh-pet 的关系：**/chat 由内核 Agent 应答**（上游是裸 LLM 调用、无工具）；其余路由契约不变（渲染端零修改）。whisper/配置/素材逻辑 vendored 自上游 `src/host/`（MIT）；素材（动画/字体）禁止商用。

## 已知限制（v1）

- Agent 回复在 `whenIdle` 后一次性返回（chat 弹窗 60s 客户端超时；长任务建议拆句提问）。流式进度已由广播气泡覆盖（思考/工具/正文/终态四段）。
- `/balance` 返回 `unsupported`（渲染端按设计不显示）。
- 重推理模型上"回复"集中在思考阶段之后涌出（~17s 思考 → 正文秒级流出），这是模型特性不是阻塞。

## v1.1 内核增强（已落地）

| 能力 | 实现 | 验证 |
|---|---|---|
| 高层 Agent API（B4） | 新包 `@deepseek-ai/dsh-chat-agent`（`packages/core/chat-agent`）：`createChatAgent(ctx)` → `send/onEvent/dispose`，agent-chat.ts 从 100 行手卷缩到 50 行门面调用 | 对话端到端通过 |
| 审批注册点（B5） | pet-server 注册 `approval/request` 瀑布监听（自动放行 + 审计行） | `workspace-write` 模式下 C 盘写文件：5 次真实提权审批全部放行并执行成功 |
| 工具进度气泡（D12） | Agent `tool-call` 事件 → 每宠广播缓存 → `/broadcast` | 对话后 `/broadcast` 返回 `正在执行 pwsh…`（渲染端 1s 轮询自动弹气泡） |
| 预设卫生（C8） | 删除引用已删 terminal 组的 `minimal` 预设 | 剩余预设：standard / ptc / cordis |

## v2 体验增强（已落地）

| 能力 | 实现 | 验证 |
|---|---|---|
| 流式回复气泡 | text-delta 逐句累积（800ms 节流）+ **turn-end 冲刷**（防 800ms 窗口内完成时丢终态）；reasoning 阶段显示「正在思考…」、工具调用显示「正在执行 pwsh…」 | 慢速写作任务：思考期 17s 思考气泡 → 正文逐字增长 → 终态完整 148 字 |
| 审批气泡 UI | `DSH_PET_APPROVAL=bubble`：审批请求挂起 → 宠物轮询 `/approval/pending` → DOM 确认框（允许一次/拒绝）→ `/approval/decide` 放行 | 全新会话写 C 盘：4 次提权请求全部经气泡决策放行，文件创建成功 |
| 跨重启记忆 | 稳定 sessionId（`pet-<id>`）+ `agents.resume`（chat-agent 新增 `resume` 选项，失败回退 create） | 重启后问「我叫什么名字」→ 「你叫小明呀」 |

## v2.1 交互与设置（已落地）

| 能力 | 实现 | 验证 |
|---|---|---|
| 双击打开对话框 | 命中区 dblclick 事件 → 对话弹窗（单击动画 280ms 去抖防冲突） | 冒烟注入 dblclick → `chatOpen:true` |
| 右键「设置」项 | 菜单新增根项 → DOM 设置卡（开机自启勾选 + 模型输入 + 当前生效显示） | 菜单 rootText 含「设置」 |
| 开机自启 | host 写注册表 `HKCU\...\Run\DshPet` → 生成的 wscript VBS 无窗口拉起（cwd 固定、node 绝对路径） | reg query 键值写入/删除均验证 |
| 模型配置 | `PUT /settings` 校验（`llm.resolveModelInfo`）→ 持久化 settings.json → `closeAllPetAgents()` 下一句起生效；留空跟随系统默认 | 有效/无效模型路径均验证；缺凭据报错清晰（MISSING_CREDENTIAL） |
| 端口占用韧性 | 第二实例（开机自启+手动并存）自动回落随机端口 | — |

## v3 Computer Use（已落地）

桌宠现在有一整套 GUI 操控工具（`src/computer-use.ts`，koffi 直调 user32.dll，零 pwsh 延迟）：

| 工具 | 能力 | 验证 |
|---|---|---|
| `computer_screenshot` | 截全屏（虚拟屏）→ 图片经 attachment 服务进模型内容块；视觉模型直接看屏幕，纯文本模型自动降级占位符 + 可配合 window_list 感知 | 截图落盘成功；k3 模型（无图像输入）自动降级并用窗口列表复述了屏幕内容 |
| `computer_click` / `move` / `drag` | 指针移动/左中右键单击双击/平滑拖拽（SendInput，INPUT 结构按 x64 精确 40 字节） | 结构体尺寸运行时校验通过 |
| `computer_type` / `computer_key` | Unicode 逐字输入（中文/emoji 代理对）+ 命名键与组合键（enter/ctrl+c/alt+f4/win+d…） | **记事本 GUI 真实输入「你好我是桌宠」，窗口标题变为 `*你好我是桌宠 - Notepad`** |
| `window_list` / `window_focus` | 可见顶层窗口枚举（标题+hwnd）/ 还原并置前台（SendInput 轻推绕过前台锁） | 窗口清单准确复述当前桌面 |
| `app_open` | 启动程序/文件/URI（notepad、mspaint、explorer、网址…） | 记事本启动成功 |
| `clipboard_read` / `clipboard_write` | 文本剪贴板读写 | — |
| `notify` | Windows 气泡通知 | — |

人设已同步更新（cordis.patch.yml）：先截图看屏幕、拿不准先 window_list、被拒绝就 escalate。

权限提示：GUI 操控默认在 `danger-full-access` 下直通；`workspace-write` 模式下每次敏感操作走审批气泡。

## 冒烟

```sh
# HTTP 路由 + Agent 对话（无窗口）
& D:\dsh\pet-smoke.ps1
# 桌面窗口截图自检
$env:DSH_PET_SMOKE_OUT='D:\dsh\pet-desktop-smoke.png'; pnpm --filter @deepseek-ai/dsh-pet-app start
```
