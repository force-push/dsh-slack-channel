# dsh-slack-channel

A Slack **channel** for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH): point a Slack bot at a DSH runtime and chat with the agent from any Slack channel. One live agent session per channel, replies posted back in-thread.

Pure `fetch` + the platform `WebSocket` — no npm dependencies, no build step, Node ≥ 22. Socket Mode needs **no public URL**.

## What it does

| Slack side | DSH side |
|---|---|
| message event (channels, groups, DMs) | `createTextUserMessage` → `agent.followup()` — the same in-process seam the [ACP bridge](../../code/deepseek-harness/packages/acp/acp) uses |
| committed assistant text | collected per turn from `session/event` (`assistant/message`), posted on `turn/end` via `chat.postMessage` |
| /stop command | `agent.cancel({ kind: 'user' })` + queue clear |
| /new command | dispose the channel's agent, start a fresh session |
| reaction ack | ⏳ reaction while the turn runs, removed when the reply lands |
| errors | `agent/error` quoted back to the channel |

Sessions are created through `ctx.agents` (`inject: ['agents']`), so each channel gets a real DSH session with its own history, tools, and model route.

The bot's own messages come back as events (`bot_id`) and edits/deletes carry a `subtype` — both are skipped, so the agent never reacts to itself.

## Slack app setup (one-time)

1. Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps) (from manifest is fastest).
2. Enable **Socket Mode** (this mints the app-level `xapp-` token).
3. Subscribe to bot events: `message.channels`, `message.groups`, `message.im`. Do **not** subscribe `app_mention` (Slack would deliver both and double-drive the agent).
4. OAuth scopes: `chat:write`, `channels:history`, `groups:history`, `im:history`, and `reactions:write` (for the ack reaction).
5. Install to the workspace → bot token (`xoxb-`).
6. Invite the bot to the channels you want served (`/invite @yourbot`).

## Install

Drop the folder anywhere on disk and mount it with a patch overlay (see `cordis.patch.yml`):

```sh
SLACK_BOT_TOKEN=xoxb-… SLACK_APP_TOKEN=xapp-… pnpm dsh web --patch /path/to/dsh-slack-channel/cordis.patch.yml
```

or install it into a profile (`dsh plugin --profile demo add /path/to/dsh-slack-channel`) and add a row to the profile's `cordis.yml`:

```yaml
- insert:
    - id: slack-channel
      name: dsh-slack-channel
      inject: [agents]
      config:
        botToken: !!js process.env.SLACK_BOT_TOKEN
        appToken: !!js process.env.SLACK_APP_TOKEN
        # Target channels: Slack channel ids (C…/G…/D…).
        allowedChannelIds: ['C0123456789']
```

The host composition must provide the `agents` service (any agent-loop-bearing composition, e.g. the default web/headless profiles).

## Channel commands

| Command | Effect |
|---|---|
| /new | dispose the channel's session and start a fresh one |
| /stop | cancel the running turn and clear the queue |
| /id | reply with the channel id (for `allowedChannelIds`) |
| /pair <token> | enroll this channel when `pairToken` is configured |
| /help, /start | command summary |

Anything else goes to the agent as a user message. Messages posted while the agent is busy are queued per channel and drained in order (with a configurable ack). Replies post in-thread when `threadReplies` is on.

## Configuration

| Key | Default | Meaning |
|---|---|---|
| `botToken` | `SLACK_BOT_TOKEN` env | Bot token (`xoxb-`) for the Web API. |
| `appToken` | `SLACK_APP_TOKEN` env | App-level token (`xapp-`) for Socket Mode. |
| `apiBase` | `https://slack.com/api` | Web API base; point at a mock for tests. |
| `provider` / `model` | host default | Agent route for created sessions. |
| `cwd` | server cwd | Workspace root for created sessions (must be absolute). |
| `allowedChannelIds` | `[]` | Channel allowlist. Empty + `allowAllChannels: false` denies everything. |
| `allowAllChannels` | `false` | Explicitly serve every channel the bot is in. |
| `notifyUnauthorized` | `false` | Reply "not authorized" to rejected channels. |
| `stateFile` | — | JSON file persisting channel → session ids and /pair enrollments. |
| `pairToken` | — | Enables the enrollment flow (requires `stateFile`). |
| `replyMode` | `last` | `last`: final assistant message of a turn; `all`: join every assistant message. |
| `maxReplyChars` | `4000` | Split longer replies at line boundaries. |
| `threadReplies` | `true` | Reply in-thread on the originating message. |
| `ackReaction` | `hourglass` | Emoji reaction marking the message being worked on (empty string disables). |
| `retryDelayMs` | `3000` | Backoff after Web API failures. |
| `socketRetryDelayMs` | `2000` | Backoff between Socket Mode reconnects. |

## Security

A bot token is a **credential**: whoever can post into a served channel can drive a full agent — with shell tools if the composition mounts them. The plugin denies every channel by default. Practical posture:

1. Post `/id` in the target channel; put the channel id in `allowedChannelIds`.
2. Prefer private channels/groups; in public channels every member can drive the agent.
3. Never set `allowAllChannels: true` on a bot installed workspace-wide.
4. Restrict the composition the channel mounts into — don't give the Slack-facing host approval-free shell access unless you accept the risk.
5. For enrollment without config edits, set `pairToken` (+ `stateFile`) and `/pair <token>` from the target channel. Enrollment is additive; remove ids from `state.json` to revoke.

## Testing

```sh
node tests/run.mjs
```

52 tests, no network required: the suite drives the plugin's `apply` against a local mock Web API server and a scripted fake websocket — reply delivery (threaded), reaction acks, echo guard, queueing, /new, /stop, /pair enrollment persistence, unauthorized gating, teardown, Socket Mode ack/reconnect/abort behavior, config validation, mrkdwn escaping, chunk splitting, and the Web API client (error mapping, 429 Retry-After header).

## Known limitations

- **Text only** — attachments, blocks, and mentions in the incoming message are ignored (only `text` is forwarded); replies are mrkdwn text.
- **Socket Mode only** — no Events API webhook mode; the plugin holds a websocket in-process.
- **No slash-command integration** — commands are plain chat text ("/new"); Slack's interactivity/slash-command payloads are acked and ignored.
- **One turn per channel at a time** — concurrent messages queue; they are not steering.
- **No mid-turn cancel from the wire** — /stop cancels via the in-process agent seam (same as the Telegram sibling).
- **Approval questions** are not surfaced on Slack; mount this plugin in a composition whose policy does not require interactive approval.

## Files

```
package.json            zero-dependency plugin package (exports ./src/index.js)
cordis.patch.yml        ready-made --patch overlay with a hardened example config
src/index.js            entry: name / inject / Config / apply — socket loop wiring, commands, reply path
src/schema.js           Standard Schema v1 config validator (inline, no deps)
src/slack.js            Web API client: call / openConnections / postMessage / reactions, splitMessage
src/socket.js           Socket Mode loop: fresh-URL reconnect, envelope acks, event routing
src/format.js           markdown → Slack mrkdwn (escaped angle brackets, fences preserved)
src/message.js          frozen user-message factory (dsh-llm createUserMessage shape)
src/collector.js        per-turn reply collector (last/all)
src/sessions.js         per-channel agent manager (create/resume, state file, enrollments)
tests/                  52-test suite + mock Web API + fake websocket (node tests/run.mjs)
```
