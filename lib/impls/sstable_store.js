'use strict'

const { Mutex } = require('../escodb')

class SSTableStore {
  constructor (adapter, filename = 'docs') {
    this._adapter = adapter
    this._filename = filename
    this._mutex = new Mutex()
  }

  async update (key, fn) {
    await this._mutex.lock(async () => {
      let data = await this._adapter.read(this._filename)
      let table = new SSTable(data)
      table.update(key, fn)
      await this._adapter.write(this._filename, table.serialize())
    })
  }

  async get (key) {
    let data = await this._adapter.read(this._filename)
    let table = new SSTable(data)
    return table.get(key)
  }
}

class SSTable {
  constructor (data = null) {
    if (data) {
      let [first, ...rest] = data.split('\n')
      this._index = JSON.parse(first)
      this._docs = rest
    } else {
      this._index = []
      this._docs = []
    }
  }

  serialize () {
    let items = [JSON.stringify(this._index), ...this._docs]
    return items.join('\n')
  }

  update (key, fn) {
    let idx = binarySearch(this._index, key)

    if (idx < 0) {
      idx = Math.abs(idx) - 1
      this._index.splice(idx, 0, key)
      this._docs.splice(idx, 0, '{}')
    }

    if (typeof fn === 'string') {
      this._docs[idx] = fn
    } else {
      let doc = JSON.parse(this._docs[idx])
      doc = fn(doc)
      this._docs[idx] = JSON.stringify(doc)
    }
  }

  get (key) {
    let idx = binarySearch(this._index, key)
    return (idx < 0) ? null : JSON.parse(this._docs[idx])
  }
}

function binarySearch (array, target) {
  let low = 0
  let high = array.length - 1

  while (low <= high) {
    let mid = Math.floor((low + high) / 2)
    let value = array[mid]

    if (value < target) {
      low = mid + 1
    } else if (value > target) {
      high = mid - 1
    } else {
      return mid
    }
  }

  return -1 - low
}

module.exports = { SSTableStore, SSTable }
