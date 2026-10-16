import test from 'node:test'
import assert from 'node:assert/strict'
import { parseAmount, pointsToHa } from './format.js'
import { translations, interpolate } from './i18n.js'

test('parseAmount reads Turkish thousands separators', () => {
  assert.equal(parseAmount('10.000'), 10000)
  assert.equal(parseAmount('1.500'), 1500)
  assert.equal(parseAmount('12.345.678'), 12345678)
  assert.equal(parseAmount('-1.500'), -1500)
})

test('parseAmount keeps the formats that already worked', () => {
  assert.equal(parseAmount('10000'), 10000)
  assert.equal(parseAmount('1 500'), 1500)
  assert.equal(parseAmount('1500,5'), 1500.5)
  assert.equal(parseAmount('1.500,5'), 1500.5)
  assert.equal(parseAmount('1500.5'), 1500.5) // English decimal
  assert.equal(parseAmount('1.50'), 1.5) // one dot, two digits: a decimal, not thousands
  assert.equal(parseAmount('0,5'), 0.5)
  assert.equal(parseAmount('0.500'), 0.5) // starts with 0: decimal fraction, not thousands
  assert.equal(parseAmount('0.005'), 0.005)
  assert.equal(parseAmount('-0.123'), -0.123)
})

test('parseAmount rejects empty and malformed input', () => {
  assert.ok(Number.isNaN(parseAmount('')))
  assert.ok(Number.isNaN(parseAmount('-')))
  assert.ok(Number.isNaN(parseAmount('1.500.00')))
  assert.ok(Number.isNaN(parseAmount('abc')))
})

test('pointsToHa converts points of green share to hectares', () => {
  // one point of green share is 1% of the built-up area; the built-up area is urban_km2 km² = urban_km2 x 100 ha
  assert.equal(pointsToHa(10, 2), 20)
  assert.equal(pointsToHa(5, 0.5), 2.5)
  assert.equal(pointsToHa(0, 3), 0)
})

test('parseAmount reads the printed minus sign and refuses mixed separators', () => {
  assert.equal(parseAmount('−1.500'), -1500) // U+2212 is the minus sign the UI itself prints
  assert.ok(Number.isNaN(parseAmount('1.5,5'))) // a dot that is not a thousands group: refuse, do not read 15,5
  assert.equal(parseAmount('1.500.000,5'), 1500000.5)
  assert.equal(parseAmount('1500,5'), 1500.5)
  assert.equal(parseAmount('1234567,89'), 1234567.89)
})

test('i18n en and tr dictionaries have identical key sets and non-empty strings', () => {
  const enKeys = Object.keys(translations.en).sort()
  const trKeys = Object.keys(translations.tr).sort()
  assert.deepEqual(enKeys, trKeys, 'en and tr dictionaries must have the exact same keys')
  for (const key of enKeys) {
    assert.ok(translations.en[key].length > 0, `en.${key} should not be empty`)
    assert.ok(translations.tr[key].length > 0, `tr.${key} should not be empty`)
  }
})

test('interpolate replaces placeholders correctly', () => {
  assert.equal(interpolate('Hello {name}, {temp} °C', { name: 'Odunpazarı', temp: '25.5' }), 'Hello Odunpazarı, 25.5 °C')
})
