'use strict'

const fs = require('fs').promises
const { dirname, resolve } = require('path')

const { O_RDWR, O_CREAT, O_APPEND } = require('fs').constants

const { Mutex } = require('../storeroom')
const { SSTable } = require('./sstable_store')

class WriteAheadLog {
  constructor (filename) {
    this._file = this._openFile(filename)
  }

  async put (path, item) {
    let key = Buffer.from(path)
    let val = Buffer.from(JSON.stringify(item))

    let buf = Buffer.alloc(4 + key.length + val.length)
    buf.writeUInt16BE(key.length, 0)
    key.copy(buf, 2)
    buf.writeUInt16BE(val.length, 2 + key.length)
    val.copy(buf, 4 + key.length)

    let file = await this._file
    await file.write(buf)
  }

  async close () {
    let file = await this._file
    await file.close()
  }

  async _openFile (filename) {
    await fs.mkdir(dirname(filename), { recursive: true })
    return fs.open(filename, O_RDWR | O_CREAT | O_APPEND)
  }
}

class IndexedLogStore {
  constructor (filename) {
    this._filename = filename
    this._wal = new WriteAheadLog(this._filename)
    this._table = new SSTable()
    this._mutex = new Mutex()
  }

  async update (path, fn) {
    await this._mutex.synchronize(async () => {
      let item = this._table.get(path)
      item = JSON.stringify(fn(item))

      await this._wal.put(path, item)

      this._table.update(path, item)
    })
  }

  async flush () {
    await this._mutex.synchronize(async () => {
      let tablefile = this._filename + '.sst'
      await fs.writeFile(tablefile, this._table.serialize())

      await this._wal.close()
    })
  }

  async get (path) {
    return this._table.get(path)
  }
}

module.exports = IndexedLogStore
