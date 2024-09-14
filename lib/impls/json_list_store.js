'use strict'

const { Mutex } = require('../storeroom')

class JsonListStore {
  constructor (adapter, filename = 'docs') {
    this._adapter = adapter
    this._filename = filename
    this._mutex = new Mutex()
  }

  async update (path, fn) {
    await this._mutex.synchronize(async () => {
      let data = await this._adapter.read(this._filename)
      let doclist = new DocList(data)
      doclist.update(path, fn)
      await this._adapter.write(this._filename, doclist.serialize())
    })
  }

  async get (path) {
    let data = await this._adapter.read(this._filename)
    let doclist = new DocList(data)
    return doclist.get(path)
  }
}

class DocList {
  constructor (data = null) {
    if (data) {
      let [first, ...rest] = data.split('\n')
      this._index = JSON.parse(first)
      this._items = rest
    } else {
      this._index = []
      this._items = []
    }
  }

  serialize () {
    let items = [JSON.stringify(this._index), ...this._items]
    return items.join('\n')
  }

  update (path, fn) {
    let idx = binarySearch(this._index, path)

    if (idx < 0) {
      idx = Math.abs(idx) - 1
      this._index.splice(idx, 0, path)
      this._items.splice(idx, 0, '{}')
    }

    let item = JSON.parse(this._items[idx])
    item = fn(item)
    this._items[idx] = JSON.stringify(item)
  }

  get (path) {
    let idx = binarySearch(this._index, path)
    return (idx < 0) ? null : JSON.parse(this._items[idx])
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

module.exports = JsonListStore
