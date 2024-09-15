'use strict'

const storeroom = require('storeroom')
const Encryptor = require('storeroom/lib/store/encryptor')
const Mutex = require('storeroom/lib/util/mutex')

const Converter = require('./converter')
const StoreWrapper = require('./store_wrapper')

const id = (x) => x
Encryptor.prototype.encrypt = id
Encryptor.prototype.decrypt = id

function createStore (options) {
  let store = storeroom.createStore(options)
  return new StoreWrapper(store)
}

module.exports = {
  createFileAdapter: storeroom.createFileAdapter,
  createStore,
  Converter,
  Mutex
}
