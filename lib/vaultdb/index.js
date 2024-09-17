'use strict'

const Cipher = require('vaultdb/lib/cipher')
const FileAdapter = require('vaultdb/lib/adapters/file')
const MemoryAdapter = require('vaultdb/lib/adapters/memory')
const Store = require('vaultdb/lib/store')

const Converter = require('./converter')
const CouchAdapter = require('./couch_adapter')

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
  MemoryAdapter
}
