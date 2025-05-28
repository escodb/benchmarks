'use strict'

class Converter {
  constructor (adapter) {
    this._adapter = adapter
    this._revs = {}
  }

  cleanup () {
    if (this._adapter.cleanup) return this._adapter.cleanup()
  }

  async read (id) {
    let rec = await this._adapter.read(id)
    if (!rec) return null

    this._revs[id] = rec.rev
    return rec.value
  }

  async write (id, value) {
    let rec = await this._adapter.write(id, value, this._revs[id])
    this._revs[id] = rec.rev
  }
}

module.exports = Converter
