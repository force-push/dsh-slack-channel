// Pure per-turn reply collection: assistant message text blocks accumulate
// under their turn number; take() removes and reduces one turn to the text a
// chat user should see.

/**
 * Build one collector. Kept pure so tests can drive it without a host.
 * @returns the collector with add(turn, text), take(turn, replyMode), clear().
 */
export function createTurnCollector() {
  const turns = new Map()

  return {
    /** Record one committed assistant text block for a turn. */
    add(turn, text) {
      if (typeof text !== 'string' || text.length === 0) return
      let list = turns.get(turn)
      if (list === undefined) {
        list = []
        turns.set(turn, list)
      }
      list.push(text)
    },

    /**
     * Remove a finished turn and reduce it to reply text.
     * @param turn - the turn that just ended.
     * @param replyMode - 'last' sends the final non-empty assistant text;
     *   'all' joins every text of the turn in order.
     * @returns the reply text, or undefined when the turn said nothing.
     */
    take(turn, replyMode = 'last') {
      const list = turns.get(turn)
      turns.delete(turn)
      if (list === undefined || list.length === 0) return undefined
      if (replyMode === 'all') return list.join('\n\n')
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].trim().length > 0) return list[i]
      }
      return undefined
    },

    /** Drop everything (e.g. after a stop cancel). */
    clear() {
      turns.clear()
    },
  }
}
