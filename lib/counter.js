'use strict'

class Counter {
  constructor (adapter) {
    this._adapter = adapter
    this.metrics = { read: 0, write: 0 }
  }

  read (...args) {
    this.metrics.read += 1
    return this._adapter.read(...args)
  }

  write (...args) {
    this.metrics.write += 1
    return this._adapter.write(...args)
  }
}

module.exports = Counter
