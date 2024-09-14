'use strict'

const Mutex = require('storeroom/lib/util/mutex')

class StoreWrapper {
  constructor (store) {
    this._store = store
    this._mutex = new Mutex()
  }

  async update (path, fn) {
    await this._mutex.synchronize(async () => {
      let doc = await this.get(path)
      await this._store.put(path, fn(doc))
    })
  }

  async get (path) {
    return await this._store.get(path) || null
  }
}

module.exports = StoreWrapper
