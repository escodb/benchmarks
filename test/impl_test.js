'use strict'

const assert = require('assert').strict

const storeroom = require('../lib/storeroom')
const escodb = require('../lib/escodb')

const DocPerFileStore = require('../lib/impls/doc_per_file_store')
const JsonFileStore = require('../lib/impls/json_file_store')
const { SSTableStore } = require('../lib/impls/sstable_store')
const ShardedTableStore = require('../lib/impls/sharded_table_store')

function testStore (impl) {
  let store

  beforeEach(async () => {
    store = await impl.createStore()
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
  for (let [name, createStore] of Object.entries(stores)) {
    describe(name, () => {
      testStore({ createStore })
    })
  }
}

const password = 'hello'

testStores({
  JsonFileStore () {
    let adapter = new storeroom.Converter(new escodb.MemoryAdapter())
    return new JsonFileStore(adapter)
  },
  SSTableStore () {
    let adapter = new storeroom.Converter(new escodb.MemoryAdapter())
    return new SSTableStore(adapter)
  },
  ShardedTableStore () {
    let adapter = new storeroom.Converter(new escodb.MemoryAdapter())
    return new ShardedTableStore(adapter, { shards: 4 })
  },
  DocPerFileStore () {
    let adapter = new storeroom.Converter(new escodb.MemoryAdapter())
    return new DocPerFileStore(adapter)
  },
  Storeroom () {
    let adapter = new storeroom.Converter(new escodb.MemoryAdapter())
    return storeroom.createStore({ adapter, password, hashBits: 2 })
  },
  EscoDB () {
    let adapter = new escodb.MemoryAdapter()
    return escodb.createStore(adapter, {
      key: { password }
    }, {
      password: { iterations: 2 ** 13 },
      shards: { n: 4 }
    })
  }
})
