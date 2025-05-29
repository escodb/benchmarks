'use strict'

class Latency {
  constructor (adapter, min, max) {
    this._adapter = adapter
    this._min = min
    this._max = max
  }

  async read (...args) {
    await this._delay()
    return this._adapter.read(...args)
  }

  async write (...args) {
    await this._delay()
    return this._adapter.write(...args)
  }

  _delay () {
    let diff = this._max - this._min
    let ms = this._min + Math.floor(Math.random() * diff)

    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

module.exports = Latency
