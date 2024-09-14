'use strict'

const { MemoryAdapter } = require('../vaultdb')

class StoreroomMemoryAdapter {
  constructor (adapter = null) {
    this._memory = adapter || new MemoryAdapter()
    this._revs = {}
  }

  async read (id) {
    let rec = await this._memory.read(id)
    if (!rec) return null

    this._revs[id] = rec.rev
    return rec.value
  }

  async write (id, value) {
    let rec = await this._memory.write(id, value, this._revs[id])
    this._revs[id] = rec.rev
  }
}

module.exports = StoreroomMemoryAdapter
