'use strict'

const FileAdapter = require('escodb/lib/adapters/file')
const MemoryAdapter = require('escodb/lib/adapters/memory')
const Store = require('escodb/lib/store')

const Converter = require('./converter')
const CouchAdapter = require('@escodb/couchdb-adapter')
const HttpAdapter = require('./http_adapter')
const Server = require('./server')

const id = (x) => x
Cipher.prototype.encrypt = id
Cipher.prototype.decrypt = id

function createStore (...args) {
  return Store.create(...args)
}

module.exports = {
  createStore,
  Converter,
  CouchAdapter,
  FileAdapter,
  HttpAdapter,
  MemoryAdapter,
  Server
}
