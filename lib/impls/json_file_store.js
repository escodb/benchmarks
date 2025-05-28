'use strict'

const { Mutex } = require('../escodb')

class JsonFileStore {
  constructor (adapter, filename = 'docs') {
    this._adapter = adapter
    this._filename = filename
    this._mutex = new Mutex()
  }

  async update (key, fn) {
    await this._mutex.lock(async () => {
      let data = await this._adapter.read(this._filename)
      let docs = data ? JSON.parse(data) : {}

      let doc = docs[key]
      doc = fn(doc)
      docs[key] = doc

      await this._adapter.write(this._filename, JSON.stringify(docs))
    })
  }

  async get (key) {
    let data = await this._adapter.read(this._filename)
    let docs = data ? JSON.parse(data) : {}
    return docs[key] || null
  }
}

module.exports = JsonFileStore
