'use strict'

const { parseArgs } = require('util')
const { randomBytes } = require('crypto')
const { resolve} = require('path')
const fs = require('fs').promises

const storeroom = require('./lib/storeroom')
const escodb = require('./lib/escodb')

const DocPerFileStore = require('./lib/impls/doc_per_file_store')
const JsonFileStore = require('./lib/impls/json_file_store')
const { SSTableStore } = require('./lib/impls/sstable_store')
const ShardedTableStore = require('./lib/impls/sharded_table_store')
const IndexedLogStore = require('./lib/impls/indexed_log_store')

const Counter = require('./lib/counter')
const stats = require('./lib/stats')
const { fmt, lpad, rpad } = require('./lib/format')

let { values: config } = parseArgs({
  options: {
    task:    { type: 'boolean', default: true },
    seq:     { type: 'boolean', default: false },

    backend: { type: 'string', default: '' },
    file:    { type: 'boolean', default: false },
    http:    { type: 'boolean', default: false },
    couchdb: { type: 'boolean', default: false },
    fsync:   { type: 'boolean', default: true },
    latency: { type: 'string', default: '' },

    docs:    { type: 'string', default: '1000' },
    size:    { type: 'string', default: '0' },
    shards:  { type: 'string', default: '4' },
    runs:    { type: 'string', default: '10' }
  },
  allowNegative: true,
  strict: true
})

for (let key of ['docs', 'size', 'shards', 'runs']) {
  config[key] = parseInt(config[key], 10)
}

function generatePaths (n, { width, depth }) {
  let keys = new Array(width).fill(null).map(() => randomBytes(4).toString('hex'))
  let paths = []

  for (let i = 1; i <= n; i++) {
    let path = ''
    let d = 1 + Math.floor(Math.random() * depth)
    while (d--) {
      let k = Math.floor(Math.random() * keys.length)
      path += '/' + keys[k]
    }
    paths.push(path + '-' + i)
  }
  return paths
}

function generateDocs (paths, size) {
  return paths.map((path, i) => {
    let doc = { n: i + 1 }
    let len = 8
    while (len < size) {
      let key = 'f' + len
      let val = randomBytes(48).toString('hex')
      doc[key] = val
      len += key.length + val.length + 6
    }
    return [path, doc]
  })
}

const PATHS = generatePaths(config.docs, { width: 100, depth: 5 })
const DOCS = generateDocs(PATHS, config.size)
const UPDATE_LIMIT = 1e5

function createServer () {
  return new escodb.Server({
    createAdapter: () => new escodb.MemoryAdapter()
  })
}

async function runTest (subject) {
  if (config.file) await fs.rm(STORE_PATH, { recursive: true }).catch(e => e)

  let server = null
  if (config.http) {
    server = createServer()
    await server.start()
  }

  let adapter = await subject.createAdapter()
  if (adapter.cleanup) await adapter.cleanup()

  if (config.latency) {
    let [min, max] = config.latency.split(/ *, */).map((n) => parseInt(n, 10))
    adapter = new escodb.Latency(adapter, min, max)
  }

  let counter = new Counter(adapter)
  let store = await subject.createStore(counter)
  let updates = []

  // single read to force store to complete initialisation
  await store.get('/doc')

  let a = process.hrtime.bigint()

  for (let [path, doc] of DOCS) {
    let put = store.update(path, () => doc)

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
  if (store.flush) await store.flush()

  let b = process.hrtime.bigint()

  if (server) await server.stop()

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
  return Math.round(mean)
}

async function main (subjects) {
  let times = []

  for (let subject of subjects) {
    if ('only' in subject && !subject.only) continue
    times.push(await benchmark(subject))
  }

  console.log('\ndocs = ' + config.docs)
  console.log(times.join(';') + '\n')
}

const STORE_PATH = resolve(__dirname, 'tmp')
const password = 'hello'
const HTTP_ADAPTER_URL = 'http://127.0.0.1:5000'
const COUCHDB_URL = 'http://admin:admin@127.0.0.1:5984/escodb'

function createStoreroomAdapter () {
  if (config.backend === 'escodb') {
    return new storeroom.Converter(createEscoAdapter())
  } else if (config.file) {
    return storeroom.createFileAdapter(STORE_PATH)
  } else if (config.http) {
    return new storeroom.Converter(new escodb.HttpAdapter(HTTP_ADAPTER_URL))
  } else if (config.couchdb) {
    return new storeroom.Converter(new escodb.CouchAdapter({ db: COUCHDB_URL }))
  } else {
    return new storeroom.Converter(new escodb.MemoryAdapter())
  }
}

function createEscoAdapter () {
  if (config.backend === 'storeroom') {
    return new escodb.Converter(createStoreroomAdapter())
  } else if (config.file) {
    return new escodb.FileAdapter({ path: STORE_PATH, fsync: config.fsync })
  } else if (config.http) {
    return new escodb.HttpAdapter(HTTP_ADAPTER_URL)
  } else if (config.couchdb) {
    return new escodb.CouchAdapter({ db: COUCHDB_URL })
  } else {
    return new escodb.MemoryAdapter()
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
    name: 'sstable',
    createAdapter: createStoreroomAdapter,
    createStore (adapter) {
      return new SSTableStore(adapter)
    }
  },
  {
    name: 'sharded tables',
    createAdapter: createStoreroomAdapter,
    createStore (adapter) {
      return new ShardedTableStore(adapter, { shards: config.shards })
    }
  },
  {
    name: 'doc per file',
    only: !config.http,
    createAdapter: createStoreroomAdapter,
    createStore (adapter) {
      return new DocPerFileStore(adapter)
    }
  },
  {
    name: 'indexed log',
    only: config.file,
    createAdapter: createStoreroomAdapter,
    createStore (adapter) {
      return new IndexedLogStore(resolve(__dirname, 'tmp', 'index'))
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
    name: 'escodb',
    createAdapter: createEscoAdapter,
    async createStore (adapter) {
      let store = await escodb.createStore(adapter, {
        key: { password }
      }, {
        password: { iterations: 2 ** 13 },
        shards: { n: config.shards }
      })
      if (config.task) store = store.task()
      return store
    }
  }
])
