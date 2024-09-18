'use strict'

const fs = require('fs').promises
const path = require('path')

const { O_RDWR, O_CREAT, O_APPEND } = require('fs').constants

const { Mutex } = require('../storeroom')
const { SSTable } = require('./sstable_store')

class WriteAheadLog {
  constructor (filename) {
    this._file = this._openFile(filename)
  }

  async put (key, doc) {
    key = Buffer.from(key)
    doc = Buffer.from(JSON.stringify(doc))

    let buf = Buffer.alloc(4 + key.length + doc.length)
    buf.writeUInt16BE(key.length, 0)
    key.copy(buf, 2)
    buf.writeUInt16BE(doc.length, 2 + key.length)
    doc.copy(buf, 4 + key.length)

    let file = await this._file
    await file.write(buf)
  }

  async close () {
    let file = await this._file
    await file.close()
  }

  async _openFile (filename) {
    await fs.mkdir(path.dirname(filename), { recursive: true })
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

  async update (key, fn) {
    await this._mutex.synchronize(async () => {
      let doc = this._table.get(key)
      doc = JSON.stringify(fn(doc))

      await this._wal.put(key, doc)

      this._table.update(key, doc)
    })
  }

  async flush () {
    await this._mutex.synchronize(async () => {
      let tablefile = this._filename + '.sst'
      await fs.writeFile(tablefile, this._table.serialize())

      await this._wal.close()
    })
  }

  async get (key) {
    return this._table.get(key)
  }
}

module.exports = IndexedLogStore
