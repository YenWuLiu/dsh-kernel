# dsh-kernel

DeepSeek Harness 的**内核裁剪版**：从上游 monorepo（deepseek-ai/deepseek-harness@master，0.1.2-rc.1）中保留 Agent 运行时闭包（151 个包），删除 Web 外壳、浏览器 UI、实验包与外部协议适配（116 个包）。分层与组合机制与上游完全一致，可作为二次开发的基座。

> 裁剪明细（保留/删除清单、理由、根配置改动）见 [KERNEL.md](KERNEL.md)；上游原始 README 见 [README.upstream.md](README.upstream.md)。

## 内核里有什么

```
vendor/cordis            L0 微内核（IoC / 插件加载 / realm 隔离）
packages/core/*          L1 契约（agent / session / tools / system-prompt）
packages/bundle/base     L2 内核组合（agent-loop、LLM、压缩、子代理、会话、沙箱、工具管道）
packages/bundle/headless 一次性任务运行器（无 Host / HTTP / 浏览器的证明）
apps/cli                 裁剪后的 dsh 启动器
```

## 快速开始

```sh
pnpm install
pnpm run build            # tsc -b tsconfig.host.json + tsdown（host 面）

# 组合检查（不需要 API key）：打印 headless profile 的完整插件树
node apps/cli/lib/bin.js --profile headless --dump-default-config

# 源码直跑（开发态，等价于构建后的 bin）
pnpm dsh --profile headless --dump-default-config

# 真实一次性任务（需要 DEEPSEEK_API_KEY；DSH_HOME 默认为 ~/.dsh）
$env:DSH_HOME = "D:/tmp/dsh-kernel-home"   # 建议隔离
pnpm dsh --profile headless "say hello in one word"
```

## 在内核上开发

**加工具/插件**：在 `packages/<group>/<pkg>` 新建 cordis 插件包（参考任一 `tool-*` 包的结构：`src/index.ts` 导出 `apply(ctx)`，用 `ctx.effect()` 注册贡献），然后：

1. 把包名加入 `packages/bundle/base/package.json` 的 dependencies（或放进你自己的 bundle/profile）；
2. 在 `packages/bundle/base/cordis.patch.yml` 的 insert 列表加一行（或在你的 profile `cordis.patch.yml` 里加）；
3. `pnpm run gen-tsconfig-paths && pnpm run build`。

**自定义 profile（不改内核）**：`$DSH_HOME/profiles/<name>/package.json` 声明 `dsh.profile.bundles: ["@deepseek-ai/dsh-base"]`，同目录 `cordis.patch.yml` 里按 id 禁用/覆写内核行、insert 自己的插件（插件包装进该 profile 的 node_modules，`dsh plugin --profile <name> add <pkg>`）。

**自定义 bundle（内核内复用）**：复制 `packages/bundle/headless` 为模板——一个 `cordis.patch.yml`（组合）+ 少量 startup 插件。

## 与上游的差异（为何能安全裁剪）

- 每个 bundle 的插件行从**该 bundle 自己的 node_modules** 解析（`createRequire(packageDir)`），所以只要 `dsh-base`/`dsh-headless` 的 manifest 自洽，删掉其他包不影响运行时解析。
- Host/Client 是独立的 tsconfig 面；删除整个 Client 面（`packages/client`、浏览器 UI）不影响 Host 面编译。
- Agent 预设（`standard` / `ptc`）保留在 `packages/preset/agent-presets/presets/`，CLI 直接依赖其引用的全部包；`minimal` 预设因 terminal 组删除而不可用（需要时从上游拷回 `packages/terminal` 与 `packages/shell/tool-*-persistent`）。

## 测试

```sh
pnpm test          # vitest（保留包的单元测试）
```

注意：上游的 100% 覆盖率门禁、Web/快照/e2e 车道、文档门禁均未保留；少量与已删包耦合的测试用例被移除（见 KERNEL.md「根配置改动」）。
