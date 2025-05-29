'use strict'

const Cipher = require('@escodb/core/lib/ciphers/aes_gcm')
const FileAdapter = require('@escodb/core/lib/adapters/file')
const MemoryAdapter = require('@escodb/core/lib/adapters/memory')
const Mutex = require('@escodb/core/lib/sync/mutex')
const Store = require('@escodb/core/lib/store')

const Converter = require('./converter')
const CouchAdapter = require('@escodb/couchdb-adapter')
const HttpAdapter = require('./http_adapter')
const Latency = require('./latency')
const Server = require('./server')

const id = (x) => x
Cipher.prototype.encrypt = id
Cipher.prototype.decrypt = id

function createStore (adapter, openOpts, createOpts) {
  let store = new Store(adapter, openOpts)
  return store.create(createOpts)
}

module.exports = {
  Converter,
  CouchAdapter,
  FileAdapter,
  HttpAdapter,
  Latency,
  MemoryAdapter,
  Mutex,
  Server,
  createStore
}
