import test from 'node:test'
import assert from 'node:assert/strict'
import { buildLookup, findDefaultDistrict, computeTargetPreset } from './usePlanner.js'

test('buildLookup extracts district lookup and calculates city bounding boxes', () => {
  const meta = {
    provinces: [
      {
        code: 34,
        name: 'İstanbul',
        districts: [
          { code: 2053, name: 'Kadıköy', has_data: true, bounds: [29.0, 40.9, 29.1, 41.0] },
          { code: 2054, name: 'Üsküdar', has_data: true, bounds: [29.0, 41.0, 29.1, 41.1] },
        ],
      },
    ],
  }
  const { byDistrict, cityBounds } = buildLookup(meta)
  assert.equal(byDistrict.get(2053).name, 'Kadıköy')
  assert.equal(byDistrict.get(2053).cityCode, 34)
  assert.deepEqual(cityBounds.get(34), [29.0, 40.9, 29.1, 41.1])
})

test('findDefaultDistrict prioritizes Kadıköy or first available district with data', () => {
  const meta = {
    provinces: [
      {
        code: 1,
        name: 'Adana',
        districts: [{ code: 1104, name: 'Seyhan', has_data: true, bounds: [0, 0, 1, 1] }],
      },
      {
        code: 34,
        name: 'İstanbul',
        districts: [{ code: 2053, name: 'Kadıköy', has_data: true, bounds: [0, 0, 1, 1] }],
      },
    ],
  }
  const found = findDefaultDistrict(meta)
  assert.equal(found.districtCode, 2053)
  assert.equal(found.cityCode, 34)
})

test('computeTargetPreset formats hectares appropriately for input', () => {
  assert.equal(computeTargetPreset(12.34), '12.4')
  assert.equal(computeTargetPreset(10), '10')
  assert.equal(computeTargetPreset(null), null)
})
