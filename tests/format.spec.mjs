// Slack mrkdwn formatting tests.

import { test, assert, equal } from './_util.mjs'
import { escapeMrkdwn, toSlackMrkdwn } from '../src/format.js'

const NL = String.fromCharCode(10)
const FENCE = '```'

test('escapeMrkdwn escapes the reserved trio', () => {
  equal(escapeMrkdwn('a < b & c > d'), 'a &lt; b &amp; c &gt; d')
})

test('angle-bracket links are neutralized outside code', () => {
  equal(escapeMrkdwn('see <https://evil.example|click>'), 'see &lt;https://evil.example|click&gt;')
})

test('fenced blocks pass through verbatim', () => {
  const text = ['before', FENCE + 'js', 'const x = 1 < 2', FENCE, 'after'].join(NL)
  const out = toSlackMrkdwn(text)
  assert(out.includes('const x = 1 < 2'), 'code content untouched inside fences')
  equal((out.match(new RegExp(FENCE.replace(/```/, '\\\$&'), 'g')) ?? []).length, 2, 'two fences kept')
})

test('inline backtick spans pass through', () => {
  equal(toSlackMrkdwn('run `npm i` now'), 'run `npm i` now')
})

test('unbalanced inline backticks escape the whole line', () => {
  equal(toSlackMrkdwn('odd ` <usage>'), 'odd ` &lt;usage&gt;')
})

test('unbalanced fence still closes', () => {
  const out = toSlackMrkdwn(FENCE + NL + 'const x = 1')
  assert(out.trimEnd().endsWith(FENCE), 'closes fence at end')
})

test('plain lines are escaped', () => {
  equal(toSlackMrkdwn('a<b> & c'), 'a&lt;b&gt; &amp; c')
})
