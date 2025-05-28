'use strict'

const { Mutex } = require('../escodb')

class DocPerFileStore {
  constructor (adapter) {
    this._adapter = adapter
    this._mutexes = new Map()
  }

  async update (key, fn) {
    if (!this._mutexes.has(key)) {
      this._mutexes.set(key, new Mutex())
    }

    await this._mutexes.get(key).lock(async () => {
      let doc = await this.get(key)
      doc = fn(doc)
      await this._adapter.write(this._filename(key), JSON.stringify(doc))
    })
  }

  async get (key) {
    let value = await this._adapter.read(this._filename(key))
    return value ? JSON.parse(value) : null
  }

  _filename (key) {
    return key.replace(/\//g, '-')
  }
}

module.exports = DocPerFileStore
