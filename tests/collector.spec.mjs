// Per-turn reply collector tests.

import { test, assert, equal } from './_util.mjs'
import { createTurnCollector } from '../src/collector.js'

test('take last returns the final non-empty text', () => {
  const collector = createTurnCollector()
  collector.add(1, 'first')
  collector.add(1, '')
  collector.add(1, 'second')
  equal(collector.take(1, 'last'), 'second')
})

test('take all joins in order', () => {
  const collector = createTurnCollector()
  collector.add(2, 'one')
  collector.add(2, 'two')
  equal(collector.take(2, 'all'), 'one\n\ntwo')
})

test('turns are independent', () => {
  const collector = createTurnCollector()
  collector.add(1, 'a')
  collector.add(2, 'b')
  equal(collector.take(1, 'last'), 'a')
  equal(collector.take(2, 'last'), 'b')
})

test('take removes the turn', () => {
  const collector = createTurnCollector()
  collector.add(1, 'x')
  collector.take(1)
  equal(collector.take(1), undefined)
})

test('empty turn yields undefined', () => {
  const collector = createTurnCollector()
  collector.add(1, '')
  equal(collector.take(1, 'last'), undefined)
})

test('clear drops everything', () => {
  const collector = createTurnCollector()
  collector.add(1, 'x')
  collector.add(2, 'y')
  collector.clear()
  equal(collector.take(1), undefined)
  equal(collector.take(2), undefined)
})
