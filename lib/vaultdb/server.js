'use strict'

const http = require('http')

const DEFAULT_PORT = 5000

const JSON_HEADERS = {
  'Content-Type': 'application/json'
}

class Server {
  constructor (options = {}) {
    this._options = options
    this._reset()

    this._http = http.createServer()
    this._http.on('request', (req, res) => this._handle(req, res))
  }

  async start () {
    let port = this._options.port || DEFAULT_PORT
    this._http.listen(port)

    while (true) {
      try {
        await fetch(`http://127.0.0.1:${port}/`)
        return
      } catch (error) {
        await new Promise(r => setTimeout(r, 10))
      }
    }
  }

  stop () {
    return this._http.close()
  }

  async _reset () {
    this._adapter = await this._options.createAdapter()
  }

  async _handle (request, response) {
    let [_, id] = request.url.split('/')

    if (request.method === 'DELETE') {
      await this._reset()
      response.writeHead(201, JSON_HEADERS)
      response.end(JSON.stringify({ ok: true }))
    }

    if (request.method === 'GET') {
      this._get(response, id)
    }

    if (request.method === 'PUT') {
      let rev = request.headers['if-match'] || null
      if (/^\d+$/.test(rev)) rev = parseInt(rev, 10)

      let body = []
      request.on('data', (chunk) => body.push(chunk))

      request.on('end', () => {
        let value = Buffer.concat(body).toString('utf8')
        this._put(response, id, value, rev)
      })
    }
  }

  async _get (response, id) {
    let rec = await this._adapter.read(id)

    if (rec) {
      response.writeHead(200, { ETag: rec.rev })
      response.end(rec.value)
    } else {
      response.writeHead(404, JSON_HEADERS)
      response.end(JSON.stringify({ error: 'not_found' }))
    }
  }

  async _put (response, id, value, rev) {
    try {
      let result = await this._adapter.write(id, value, rev)
      response.writeHead(201, { ...JSON_HEADERS, ETag: result.rev })
      response.end(JSON.stringify({ ok: true }))
    } catch (err) {
      response.writeHead(409, JSON_HEADERS)
      response.end(JSON.stringify({ error: err.code }))
    }
  }
}

module.exports = Server
