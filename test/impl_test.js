'use strict'

const assert = require('assert').strict

const { MemoryAdapter } = require('../lib/storeroom')
const JsonFileStore = require('../lib/impls/json_file_store')
const JsonListStore = require('../lib/impls/json_list_store')
const ShardedListStore = require('../lib/impls/sharded_list_store')

function testStore (impl) {
  let store

  beforeEach(() => {
    store = impl.createStore()
  })

  it('returns null for a missing doc', async () => {
    let doc = await store.get('/doc')
    assert.equal(doc, null)
  })

  it('stores a doc', async () => {
    await store.update('/doc', () => ({ a: 1 }))

    let doc = await store.get('/doc')
    assert.deepEqual(doc, { a: 1 })
  })

  it('updates the same doc multiple times', async () => {
    await Promise.all([
      store.update('/doc', (doc) => ({ ...doc, a: 1 })),
      store.update('/doc', (doc) => ({ ...doc, b: 2 })),
      store.update('/doc', (doc) => ({ ...doc, c: 3 }))
    ])

    let doc = await store.get('/doc')
    assert.deepEqual(doc, { a: 1, b: 2, c: 3 })
  })

  it('updates multiple docs', async () => {
    await Promise.all([
      store.update('/doc-a', (doc) => ({ ...doc, a: 1 })),
      store.update('/doc-b', (doc) => ({ ...doc, b: 2 })),
      store.update('/doc-c', (doc) => ({ ...doc, c: 3 }))
    ])

    assert.deepEqual(await store.get('/doc-a'), { a: 1 })
    assert.deepEqual(await store.get('/doc-b'), { b: 2 })
    assert.deepEqual(await store.get('/doc-c'), { c: 3 })
  })
}

function testStores (stores) {
  for (let [name, [Store, options]] of Object.entries(stores)) {
    describe(name, () => {
      testStore({
        createStore () {
          let adapter = new MemoryAdapter()
          return new Store(adapter, options)
        }
      })
    })
  }
}

testStores({
  JsonFileStore: [JsonFileStore],
  JsonListStore: [JsonListStore],
  ShardedListStore: [ShardedListStore, { shards: 4 }]
})
