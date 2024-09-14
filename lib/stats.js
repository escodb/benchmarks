'use strict'

function mean (xs) {
  let sum = xs.reduce((a, b) => a + b, 0)
  return sum / xs.length
}

function stddev (xs) {
  return Math.sqrt(variance(xs))
}

function variance (xs) {
  let sumSq = xs.map((x) => x ** 2).reduce((a, b) => a + b, 0)
  return (sumSq / xs.length) - (mean(xs) ** 2)
}

module.exports = {
  mean,
  stddev
}
