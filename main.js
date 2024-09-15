'use strict'

const { parseArgs } = require('util')
const { randomBytes } = require('crypto')
const { resolve} = require('path')
const fs = require('fs').promises

const storeroom = require('./lib/storeroom')
const vaultdb = require('./lib/vaultdb')

const JsonFileStore = require('./lib/impls/json_file_store')
const JsonListStore = require('./lib/impls/json_list_store')
const ShardedListStore = require('./lib/impls/sharded_list_store')
const DocPerFileStore = require('./lib/impls/doc_per_file_store')

const Counter = require('./lib/counter')
const stats = require('./lib/stats')
const { fmt, lpad, rpad } = require('./lib/format')

let { values: config } = parseArgs({
  options: {
    task:    { type: 'boolean', default: true },
    seq:     { type: 'boolean', default: false },
    backend: { type: 'string', default: '' },
    file:    { type: 'boolean', default: false },
    fsync:   { type: 'boolean', default: true },
    docs:    { type: 'string', default: '1000' },
    shards:  { type: 'string', default: '4' },
    runs:    { type: 'string', default: '10' }
  },
  allowNegative: true,
  strict: true
})

for (let key of ['docs', 'shards', 'runs']) {
  config[key] = parseInt(config[key], 10)
}

function generatePaths (n, { width, depth }) {
  let keys = new Array(width).fill(null).map(() => randomBytes(4).toString('hex'))
  let paths = []

  while (paths.length < n) {
    let path = ''
    let d = 1 + Math.floor(Math.random() * depth)
    for (let i = 0; i < d; i++) {
      let k = Math.floor(Math.random() * keys.length)
      path += '/' + keys[k]
    }
    paths.push(path)
  }
  return paths
}

const PATHS = generatePaths(config.docs, { width: 100, depth: 3 })
const UPDATE_LIMIT = 1e5

async function runTest (subject) {
  await fs.rm(STORE_PATH, { recursive: true }).catch(e => e)

  let adapter = await subject.createAdapter()
  let counter = new Counter(adapter)
  let store = await subject.createStore(counter)
  let updates = []

  // single read to force store to complete initialisation
  await store.get('/doc')

  let a = process.hrtime.bigint()

  for (let [i, path] of PATHS.entries()) {
    let put = store.update(path + '-' + (i + 1), () => ({ n: i + 1 }))

    if (config.seq) {
      await put
    } else {
      updates.push(put)
    }

    if (updates.length >= UPDATE_LIMIT) {
      await Promise.all(updates)
      updates = []
    }
  }

  await Promise.all(updates)
  let b = process.hrtime.bigint()

  return {
    metrics: counter.metrics,
    time: Number((b - a) / 1000000n)
  }
}

async function benchmark (subject) {
  let metrics = []
  let times = []

  for (let i = 0; i < config.runs; i++) {
    let result = await runTest(subject)
    metrics.push(result.metrics)
    times.push(result.time)
  }

  let mean = stats.mean(times)
  let stddev = stats.stddev(times)
  let err = 100 * stddev / mean

  let printTime = lpad(fmt(Math.round(mean)), 12) + ' ms ' +
                  '± ' + Math.round(err) + '%'

  console.log(rpad(subject.name, 16), rpad(printTime, 24), metrics[0])
}

async function main (subjects) {
  for (let subject of subjects) {
    await benchmark(subject)
  }
}

const STORE_PATH = resolve(__dirname, 'tmp')
const password = 'hello'

function createStoreroomAdapter () {
  if (config.backend === 'vaultdb') {
    return new storeroom.Converter(createVaultAdapter())
  } else if (config.file) {
    return storeroom.createFileAdapter(STORE_PATH)
  } else {
    return new storeroom.Converter(new vaultdb.MemoryAdapter())
  }
}

function createVaultAdapter () {
  if (config.backend === 'storeroom') {
    return new vaultdb.Converter(createStoreroomAdapter())
  } else if (config.file) {
    return new vaultdb.FileAdapter(STORE_PATH, { fsync: config.fsync })
  } else {
    return new vaultdb.MemoryAdapter()
  }
}

main([
  {
    name: 'json file',
    createAdapter: createStoreroomAdapter,
    createStore (adapter) {
      return new JsonFileStore(adapter)
    }
  },
  {
    name: 'json list',
    createAdapter: createStoreroomAdapter,
    createStore (adapter) {
      return new JsonListStore(adapter)
    }
  },
  {
    name: 'sharded json',
    createAdapter: createStoreroomAdapter,
    createStore (adapter) {
      return new ShardedListStore(adapter, { shards: config.shards })
    }
  },
  {
    name: 'doc per file',
    createAdapter: createStoreroomAdapter,
    createStore (adapter) {
      return new DocPerFileStore(adapter)
    }
  },
  {
    name: 'storeroom',
    createAdapter: createStoreroomAdapter,
    createStore (adapter) {
      let hashBits = Math.ceil(Math.log(config.shards) / Math.log(2))
      return storeroom.createStore({ adapter, password, hashBits })
    }
  },
  {
    name: 'vaultdb',
    createAdapter: createVaultAdapter,
    async createStore (adapter) {
      let store = await vaultdb.createStore(adapter, {
        key: { password, iterations: 2 ** 13 },
        shards: { n: config.shards }
      })
      if (config.task) store = store.task()
      return store
    }
  }
])
