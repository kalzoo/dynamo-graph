import test from 'ava'

import { V, E } from 'dynamo-graph'
import { g, Gen } from '../helpers'

const N = 2
const M = 4
const P = 1

const ADJ_NODE = V.define('AdjNode')
const ADJ_TO = E.define('AdjTo', E.MANY_TO_MANY)

function assertOrdered(t, edges, reverse = false) {
  edges.forEach((e, idx) => {
    const e2 = edges[idx + 1]
    if (!e2) return
    t.true(reverse ? e.weight < e2.weight : e.weight > e2.weight)
  })
}

test
  ( 'Retrieves adjacencies'
  , async t => {

      // create vertices
      const v1s = await Promise.all(
        Gen.array(N).map(() => V.create(g, ADJ_NODE))
      )
      const v2s = await Promise.all(
        Gen.array(M).map(() => V.create(g, ADJ_NODE))
      )

      // test both directions
      for (const DIR of [ E.OUT, E.IN ]) {

        // create edges
        for (const { id } of v1s)
          for (const { id: id2 } of v2s)
            await E.set(g, id, ADJ_TO, DIR, E.GENERATE, id2)

        for (const { id } of v1s) {

          // paginates in correct order
          const all = await E.range(g, id, ADJ_TO, DIR)
          assertOrdered(t, all.items)
          for (const e of all.items) {
            t.is(e.label, 'AdjTo')
            t.is(e.direction, DIR)
          }

          // forward pagination works

          const pf1 = await E.range(g, id, ADJ_TO, DIR, { first: P })
          const pf2 = await E.range(g, id, ADJ_TO, DIR, { first: P, after: pf1.lastCursor })
          const pf3 = await E.range(g, id, ADJ_TO, DIR, { after: pf2.lastCursor })

          t.deepEqual
            ( [].concat(pf1.items, pf2.items, pf3.items)
            , all.items
            )

          // backwards pagination works

          const pr1 = await E.range(g, id, ADJ_TO, DIR, { last: P })
          const pr2 = await E.range(g, id, ADJ_TO, DIR, { last: P, before: pr1.lastCursor })
          const pr3 = await E.range(g, id, ADJ_TO, DIR, { before: pr2.lastCursor })

          t.deepEqual
            ( [].concat(pr1.items, pr2.items, pr3.items).reverse()
            , all.items
            )

        }
      }

    }
  )

test
  ( 'Orders adjacencies by weight'
  , async t => {

      for (const DIR of [ E.OUT, E.IN ]) {

        const [ { id: a }, { id: b }, { id: c }, { id: d } ] =
          await Promise.all(
            Gen.array(4).map(() => V.create(g, ADJ_NODE))
          )

        const e1 = await E.set(g, a, ADJ_TO, DIR, 0, b)
        const e2 = await E.set(g, a, ADJ_TO, DIR, 1, c)
        const e3 = await E.set(g, a, ADJ_TO, DIR, -1, d)

        const all = await E.range(g, a, ADJ_TO, DIR)
        assertOrdered(t, all.items)
        t.deepEqual([ e2, e1, e3 ], all.items)

        const forward = await E.range(g, a, ADJ_TO, DIR, { first: 3 })
        assertOrdered(t, forward.items)
        t.deepEqual([ e2, e1, e3 ], forward.items)

        const reverse = await E.range(g, a, ADJ_TO, DIR, { last: 3 })
        assertOrdered(t, reverse.items, true)
        t.deepEqual([ e3, e1, e2 ], reverse.items)

      }

    }
  )
