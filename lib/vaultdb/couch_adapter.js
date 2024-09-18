'use strict'

const HOST = 'http://127.0.0.1:5984'
const DB = 'vaultdbtest'
const USERNAME = 'admin'
const PASSWORD = 'admin'

class CouchAdapter {
  static async cleanup () {
    let creds = [USERNAME, PASSWORD].join(':')
    let token = Buffer.from(creds).toString('base64')

    await fetchWithRetry(`${HOST}/${DB}`, {
      method: 'DELETE',
      headers: { authorization: `Basic ${token}` }
    })
  }

  constructor () {
    this._cookie = login()
  }

  async read (id) {
    let response = await this._request(`${DB}/${id}`)

    if (response.status === 200) {
      let json = await response.json()
      return { value: json.value, rev: json._rev }
    } else {
      return null
    }
  }

  async write (id, value, rev = null) {
    let url = `${DB}/${id}`
    if (rev) url += `?rev=${rev}`

    let response = await this._request(url, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value })
    })

    if (response.status === 404) {
      await this._request(DB, { method: 'PUT' })
      return this.write(id, value, rev)
    }

    if (response.status === 409) {
      let error = Object.assign(new Error(), { code: 'ERR_CONFLICT' })
      throw error
    }

    if (response.status === 201) {
      let json = await response.json()
      return { rev: json.rev }
    }

    throw new Error('Unknown status code: ' + response.status)
  }

  async _request (path, options = {}) {
    let [cookie] = await this._cookie
    let headers = options.headers || {}

    return fetchWithRetry(`${HOST}/${path}`, {
      ...options,
      headers: { ...headers, cookie }
    })
  }
}

async function login () {
  let body = new URLSearchParams()
  body.set('username', USERNAME)
  body.set('password', PASSWORD)

  let response = await fetchWithRetry(`${HOST}/_session`, {
    method: 'POST',
    body
  })

  let cookie = response.headers.get('set-cookie')
  return cookie.split(/ *; */)
}

async function fetchWithRetry (...args) {
  try {
    return await fetch(...args)
  } catch (error) {
    while (error) {
      if (error.code === 'ECONNRESET') {
        return fetchWithRetry(...args)
        error = error.cause
      }
    }
    throw error
  }
}

module.exports = CouchAdapter
