'use strict'

function fmt (n) {
  let chars = [...n.toString()].reverse()
  let output = []

  for (let i = 0; i < chars.length; i++) {
    if (i > 0 && i % 3 === 0) output.push(',')
    output.push(chars[i])
  }
  return output.reverse().join('')
}

function lpad (str, len) {
  while (str.length < len) str = ' ' + str
  return str
}

function rpad (str, len) {
  while (str.length < len) str = str + ' '
  return str
}

module.exports = {
  fmt,
  lpad,
  rpad
}
