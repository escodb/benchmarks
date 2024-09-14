'use strict'

const { parseArgs } = require('util')
const storeroom = require('./lib/storeroom')
const vaultdb = require('./lib/vaultdb')

const Counter = require('./lib/counter')
const stats = require('./lib/stats')

const JsonFileStore = require('./lib/impls/json_file_store')
const JsonListStore = require('./lib/impls/json_list_store')
const ShardedListStore = require('./lib/impls/sharded_list_store')

let { values: config } = parseArgs({
  options: {
    docs:   { type: 'string', default: '1000' },
    shards: { type: 'string', default: '4' },
    runs:   { type: 'string', default: '10' }
  },
  strict: true
})

for (let key of ['docs', 'shards', 'runs']) {
  config[key] = parseInt(config[key], 10)
}

function createStoreroomAdapter () {
  return new storeroom.MemoryAdapter()
}

const SUBJECTS = [
  {
    name: 'JSON file',
    createAdapter: createStoreroomAdapter,
    createStore (adapter) {
      return new JsonFileStore(adapter)
    }
  },
  {
    name: 'JSON list',
    createAdapter: createStoreroomAdapter,
    createStore (adapter) {
      return new JsonListStore(adapter)
    }
  },
  {
    name: 'Sharded JSON list',
    createAdapter: createStoreroomAdapter,
    createStore (adapter) {
      return new ShardedListStore(adapter, { shards: config.shards })
    }
  }
]

const UPDATE_LIMIT = 1e5

async function runTest (subject) {
  let adapter = await subject.createAdapter()
  let counter = new Counter(adapter)
  let store = await subject.createStore(counter)
  let updates = []

  // single read to force store to complete initialisation
  await store.get('/doc')

  let a = process.hrtime.bigint()

  for (let i = 1; i <= config.docs; i++) {
    let put = store.update('/path/to/doc-' + i, () => ({ n: i }))
    updates.push(put)

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

  let printTime = Math.round(mean) + 'ms ± ' + Math.round(err) + '%'

  let { name } = subject
  while (name.length < 20) name += ' '

  console.log(name, '|', printTime, '|', metrics[0])
}

async function main () {
  for (let subject of SUBJECTS) {
    await benchmark(subject)
  }
}

main()
