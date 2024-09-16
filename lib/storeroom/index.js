'use strict'

const storeroom = require('storeroom')
const Encryptor = require('storeroom/lib/store/encryptor')
const Mutex = require('storeroom/lib/util/mutex')

const Converter = require('./converter')

const id = (x) => x
Encryptor.prototype.encrypt = id
Encryptor.prototype.decrypt = id

module.exports = {
  createFileAdapter: storeroom.createFileAdapter,
  createStore: storeroom.createStore,
  Converter,
  Mutex
}
