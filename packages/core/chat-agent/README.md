---
description: "High-level chat Agent facade: createChatAgent folds registry creation, model selection, turn driving, and progress projection into one small API for chat-shaped applications."
kind: "package-reference"
---

# @deepseek-ai/dsh-chat-agent

## Summary

`dsh-chat-agent` is the chat-shaped counterpart of the headless runner's inline driver. The kernel's Agent registry is a composition engine; applications that just want "a conversation that can use tools" repeat the same four moves — create through the registry, install a model selection, drive serialized turns, project session events for a UI. This package folds them into one facade:

```ts
import { createChatAgent } from '@deepseek-ai/dsh-chat-agent'

const chat = await createChatAgent(ctx, { sessionId: 'pet-main' })
const off = chat.onEvent((event) => {
  if (event.type === 'tool-call') showBusy(`running ${event.name}…`)
})
const reply = await chat.send('check the free space on C:')
```

- **Tools included, by construction**: the facade changes nothing about the booted composition — whatever tool catalog the profile mounts (pwsh, fs, …) is what the Agent wields.
- **Durable by default**: `send` resolves from the session log (the headless summarize contract), and a stable `sessionId` replays prior turns as conversation history on the next process start.
- **Progress as data**: `onEvent` projects the instance's own log into a UI-safe vocabulary — `text-delta`, `reasoning-delta`, `tool-call`, `tool-result`, `turn-end` — scoped to this instance's session, never process-global.

## API

### `createChatAgent(ctx, options?): Promise<ChatAgent>`

`ctx` is any plugin context whose realm resolves `agents` and `agentDefaultModel`. Options:

| field | default | meaning |
|---|---|---|
| `sessionId` | `chat-<uuid>` | stable id reuses the durable log across restarts |
| `cwd` | `process.cwd()` | workspace root metadata |
| `provider` / `model` | `agentDefaultModel.currentSelection()` | explicit route override (both or neither) |

### `ChatAgent`

- `send(text): Promise<ChatReply>` — queue one user turn; sends serialize per instance. `ChatReply.text` is the last assistant text of the owned turn (`''` when none), `ChatReply.error` the `code: message` identity when the turn ended in error.
- `onEvent(listener): () => void` — subscribe to this instance's progress events; returns an unsubscribe disposer.
- `agent` — the underlying kernel Agent (escape hatch).
- `dispose()` — stop event projection (the Agent stays registry-owned).

## Non-goals

No prompt/tool configuration of its own (that is the profile's composition), no streaming `send` (use `onEvent` for progress; `send` stays a one-shot outcome), and no multi-agent orchestration (that is the subagent capability seam).
