'use strict'

class Converter {
  constructor (adapter) {
    this._adapter = adapter
  }

  async read (id) {
    let value = await this._adapter.read(id)
    return value ? { value, rev: null } : null
  }

  async write (id, value, rev = null) {
    await this._adapter.write(id, value)
    return { rev: null }
  }
}

module.exports = Converter
