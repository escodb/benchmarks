'use strict'

const { parseArgs } = require('util')
const { resolve} = require('path')
const fs = require('fs').promises

const storeroom = require('./lib/storeroom')
const vaultdb = require('./lib/vaultdb')

const JsonFileStore = require('./lib/impls/json_file_store')
const JsonListStore = require('./lib/impls/json_list_store')
const ShardedListStore = require('./lib/impls/sharded_list_store')

const Counter = require('./lib/counter')
const stats = require('./lib/stats')

let { values: config } = parseArgs({
  options: {
    task:   { type: 'boolean', default: true },
    seq:    { type: 'boolean', default: false },
    file:   { type: 'boolean', default: false },
    fsync:  { type: 'boolean', default: true },
    docs:   { type: 'string', default: '1000' },
    shards: { type: 'string', default: '4' },
    runs:   { type: 'string', default: '10' }
  },
  allowNegative: true,
  strict: true
})

for (let key of ['docs', 'shards', 'runs']) {
  config[key] = parseInt(config[key], 10)
}

const STORE_PATH = resolve(__dirname, 'tmp')
const password = 'hello'

function createStoreroomAdapter () {
  if (config.file) {
    return storeroom.createFileAdapter(STORE_PATH)
  } else {
    return new storeroom.MemoryAdapter()
  }
}

function createVaultAdapter () {
  if (config.file) {
    return new vaultdb.FileAdapter(STORE_PATH, { fsync: config.fsync })
  } else {
    return new vaultdb.MemoryAdapter()
  }
}

const SUBJECTS = [
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
]

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

  for (let i = 1; i <= config.docs; i++) {
    let put = store.update('/path/to/doc-' + i, () => ({ n: i }))

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

  let printTime = lpad(fmt(Math.round(mean)), 8) + ' ms ' +
                  '± ' + Math.round(err) + '%'

  console.log(rpad(subject.name, 16), rpad(printTime, 20), metrics[0])
}

function fmt (n) {
  let chars = [...n.toString()].reverse()
  let output = []

  for (let i = 0; i < chars.length; i++) {
    if (i > 0 && i % 3 === 0) output.push(',')
    output.push(chars[i])
  }
  return output.reverse().join('')
}

function lpad (str, len) {
  while (str.length < len) str = ' ' + str
  return str
}

function rpad (str, len) {
  while (str.length < len) str = str + ' '
  return str
}

async function main () {
  for (let subject of SUBJECTS) {
    await benchmark(subject)
  }
}

main()
