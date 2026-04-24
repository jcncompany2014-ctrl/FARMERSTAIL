import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  BASE_SHIPPING_FEE,
  FREE_SHIPPING_THRESHOLD,
  REMOTE_AREA_SURCHARGE,
  calculateShipping,
  calculateShippingFee,
  isRemoteZip,
  shippingLabel,
} from './shipping.ts'

describe('isRemoteZip', () => {
  it('returns false for null / undefined / empty', () => {
    assert.equal(isRemoteZip(null), false)
    assert.equal(isRemoteZip(undefined), false)
    assert.equal(isRemoteZip(''), false)
  })

  it('accepts hyphenated zip formats', () => {
    assert.equal(isRemoteZip('637-00'), true) // strips hyphen → 63700 → Jeju
    assert.equal(isRemoteZip('63000'), true)
  })

  it('identifies Jeju zips (63xxx) as remote', () => {
    assert.equal(isRemoteZip('63000'), true)
    assert.equal(isRemoteZip('63644'), true)
  })

  it('identifies Ulleungdo zips as remote', () => {
    assert.equal(isRemoteZip('40200'), true)
    assert.equal(isRemoteZip('40240'), true)
  })

  it('rejects mainland zips', () => {
    assert.equal(isRemoteZip('06000'), false)
    assert.equal(isRemoteZip('13494'), false)
  })

  it('rejects malformed zips (not 5 digits after strip)', () => {
    assert.equal(isRemoteZip('abc'), false)
    assert.equal(isRemoteZip('123'), false)
    assert.equal(isRemoteZip('1234567'), false)
  })
})

describe('calculateShipping', () => {
  it('charges base fee below the threshold', () => {
    const b = calculateShipping({ subtotal: 20000 })
    assert.equal(b.base, BASE_SHIPPING_FEE)
    assert.equal(b.total, BASE_SHIPPING_FEE)
    assert.equal(b.isBaseFree, false)
    assert.equal(b.remainingToFree, FREE_SHIPPING_THRESHOLD - 20000)
  })

  it('frees base fee at or above the threshold', () => {
    const b = calculateShipping({ subtotal: FREE_SHIPPING_THRESHOLD })
    assert.equal(b.base, 0)
    assert.equal(b.total, 0)
    assert.equal(b.isBaseFree, true)
    assert.equal(b.remainingToFree, 0)
  })

  it('adds remote surcharge for Jeju zip even when base is free', () => {
    const b = calculateShipping({ subtotal: 50000, zip: '63000' })
    assert.equal(b.base, 0)
    assert.equal(b.remoteSurcharge, REMOTE_AREA_SURCHARGE)
    assert.equal(b.total, REMOTE_AREA_SURCHARGE)
    assert.equal(b.isRemote, true)
  })

  it('combines base + remote surcharge below threshold', () => {
    const b = calculateShipping({ subtotal: 10000, zip: '63000' })
    assert.equal(b.total, BASE_SHIPPING_FEE + REMOTE_AREA_SURCHARGE)
  })

  it('honors forceFreeBase (does not free remote surcharge)', () => {
    const b = calculateShipping({
      subtotal: 5000,
      zip: '63000',
      forceFreeBase: true,
    })
    assert.equal(b.base, 0)
    assert.equal(b.remoteSurcharge, REMOTE_AREA_SURCHARGE)
    assert.equal(b.total, REMOTE_AREA_SURCHARGE)
  })

  it('honors freeThresholdOverride', () => {
    const b = calculateShipping({
      subtotal: 19000,
      freeThresholdOverride: 19000,
    })
    assert.equal(b.isBaseFree, true)
    assert.equal(b.total, 0)
  })

  it('returns 0 for empty cart regardless of zip', () => {
    const b = calculateShipping({ subtotal: 0, zip: '63000' })
    assert.equal(b.total, 0)
    assert.equal(b.base, 0)
    assert.equal(b.remoteSurcharge, 0)
  })
})

describe('calculateShippingFee (wrapper)', () => {
  it('returns total number only', () => {
    assert.equal(calculateShippingFee(50000), 0)
    assert.equal(calculateShippingFee(1000), BASE_SHIPPING_FEE)
    assert.equal(
      calculateShippingFee(1000, '63000'),
      BASE_SHIPPING_FEE + REMOTE_AREA_SURCHARGE,
    )
  })
})

describe('shippingLabel', () => {
  it('"무료" when total is 0', () => {
    assert.equal(shippingLabel(calculateShipping({ subtotal: 50000 })), '무료')
  })

  it('plain price for non-remote fees', () => {
    assert.equal(
      shippingLabel(calculateShipping({ subtotal: 1000 })),
      '3,000원',
    )
  })

  it('includes remote surcharge breakdown label', () => {
    const b = calculateShipping({ subtotal: 1000, zip: '63000' })
    assert.equal(shippingLabel(b), '6,000원 (도서산간 +3,000원)')
  })

  it('remote-only surcharge label when base is free', () => {
    const b = calculateShipping({ subtotal: 50000, zip: '63000' })
    assert.equal(shippingLabel(b), '3,000원 (도서산간 +3,000원)')
  })
})
