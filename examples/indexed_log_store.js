'use strict'

const crypto = require('crypto')
const fs = require('fs').promises
const path = require('path')
const IndexedLogStore = require('../lib/impls/indexed_log_store')

class Reader {
  constructor (file, pos = 0) {
    this._file = file
    this._pos = pos
  }

  async readStr () {
    let len = await this._readBuf(2)
    len = len.readUInt16BE(0)

    let str = await this._readBuf(len)
    return str.toString()
  }

  async _readBuf (length) {
    let buf = Buffer.alloc(length)
    await this._file.read(buf, 0, length, this._pos)
    this._pos += length
    return buf
  }
}

async function main () {
  let name = 'index-' + crypto.randomBytes(4).toString('hex')
  let filename = path.resolve(__dirname, '..', 'tmp', name)
  let store = new IndexedLogStore(filename)
  let updates = []

  for (let k = 1; k <= 3; k++) {
    for (let i = 0; i < 1000; i++) {
      let put = store.update('/doc-' + i, (doc) => {
        let n = doc ? doc.n : i
        return { n: k * n }
      })
      updates.push(put)
    }
  }

  await Promise.all(updates)
  await store.flush()

  let wal = await fs.open(filename)
  let reader = new Reader(wal)

  while (true) {
    let key = await reader.readStr()
    let doc = await reader.readStr()

    if (key === '') break

    console.log({ key, doc })
  }

  let doc = await store.get('/doc-169')
  console.log({ doc })
}

main()
