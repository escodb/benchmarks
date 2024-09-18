'use strict'

const crypto = require('crypto')
const { SSTableStore } = require('./sstable_store')

class ShardedTableStore {
  constructor (adapter, options = {}) {
    this._adapter = adapter
    this._shards = []

    for (let i = 0; i < options.shards; i++) {
      this._shards.push(new SSTableStore(adapter, 'shard-' + i))
    }
  }

  update (path, fn) {
    return this._shardFor(path).update(path, fn)
  }

  get (path) {
    return this._shardFor(path).get(path)
  }

  _shardFor (path) {
    let hash = crypto.createHash('sha256')
    hash.update(path)

    let n = hash.digest().readUInt16BE()
    return this._shards[n % this._shards.length]
  }
}

module.exports = ShardedTableStore
