'use strict'

const Cipher = require('vaultdb/lib/cipher')
const MemoryAdapter = require('vaultdb/lib/adapters/memory')
const Store = require('vaultdb/lib/store')

const id = (x) => x
Cipher.prototype.encrypt = id
Cipher.prototype.decrypt = id

function createStore (...args) {
  return Store.create(...args)
}

module.exports = {
  createStore,
  MemoryAdapter
}
