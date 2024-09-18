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

  update (key, fn) {
    return this._shardFor(key).update(key, fn)
  }

  get (key) {
    return this._shardFor(key).get(key)
  }

  _shardFor (key) {
    let hash = crypto.createHash('sha256')
    hash.update(key)

    let n = hash.digest().readUInt16BE()
    return this._shards[n % this._shards.length]
  }
}

module.exports = ShardedTableStore
