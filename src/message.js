// Hand-rolled equivalent of the dsh-llm createUserMessage text path — the
// exact shape the in-repo ACP bridge produces via createUserMessage with a
// user source, including the immutable freeze, so the plugin needs no
// workspace imports.

import { randomUUID } from 'node:crypto'

/** Recursively freeze a plain message value. */
function deepFreeze(value) {
  if (value === null || typeof value !== 'object') return value
  for (const key of Object.keys(value)) deepFreeze(value[key])
  return Object.freeze(value)
}

/**
 * Build one frozen user-role text message with a fresh stable identity — the
 * shape DSH's agent inbox consumes (Message: id, role, content, source).
 * @param text - the model-facing user text.
 */
export function createTextUserMessage(text) {
  return deepFreeze({
    id: randomUUID(),
    role: 'user',
    content: [{ type: 'text', text }],
    source: { kind: 'user' },
  })
}
