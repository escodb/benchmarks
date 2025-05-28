'use strict'

const { MemoryAdapter, Server } = require('../lib/escodb')

let server = new Server({
  createAdapter () {
    return new MemoryAdapter()
  }
})

server.start()
