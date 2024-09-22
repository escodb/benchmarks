'use strict'

class HttpAdapter {
  constructor (url) {
    this._url = url
  }

  async read (id) {
    let response = await fetch(`${this._url}/${id}`)

    if (response.status === 200) {
      let value = await response.text()
      let rev = response.headers.get('etag')
      return { value, rev }
    }

    if (response.status === 404) {
      return null
    }
  }

  async write (id, value, rev = null) {
    let headers = {}
    if (rev !== null) headers['if-match'] = rev

    let response = await fetch(`${this._url}/${id}`, {
      method: 'PUT',
      headers,
      body: value
    })

    if (response.status === 201) {
      let rev = response.headers.get('etag')
      return { rev }
    }

    if (response.status === 409) {
      let error = Object.assign(new Error(), { code: 'ERR_CONFLICT' })
      throw error
    }
  }
}

module.exports = HttpAdapter
