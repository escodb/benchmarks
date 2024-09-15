'use strict'

const { Mutex } = require('../storeroom')

class DocPerFileStore {
  constructor (adapter) {
    this._adapter = adapter
    this._mutexes = new Map()
  }

  async update (path, fn) {
    if (!this._mutexes.has(path)) {
      this._mutexes.set(path, new Mutex())
    }

    await this._mutexes.get(path).synchronize(async () => {
      let item = await this.get(path)
      item = fn(item)
      await this._adapter.write(this._filename(path), JSON.stringify(item))
    })
  }

  async get (path) {
    let value = await this._adapter.read(this._filename(path))
    return value ? JSON.parse(value) : null
  }

  _filename (path) {
    return path.replace(/\//g, '_')
  }
}

module.exports = DocPerFileStore
