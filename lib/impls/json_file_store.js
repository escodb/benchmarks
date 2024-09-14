'use strict'

const { Mutex } = require('../storeroom')

class JsonFileStore {
  constructor (adapter, filename = 'docs') {
    this._adapter = adapter
    this._filename = filename
    this._mutex = new Mutex()
  }

  async update (path, fn) {
    await this._mutex.synchronize(async () => {
      let data = await this._adapter.read(this._filename)
      let docs = data ? JSON.parse(data) : {}

      let item = docs[path]
      item = fn(item)
      docs[path] = item

      await this._adapter.write(this._filename, JSON.stringify(docs))
    })
  }

  async get (path) {
    let data = await this._adapter.read(this._filename)
    let docs = data ? JSON.parse(data) : {}
    return docs[path] || null
  }
}

module.exports = JsonFileStore
