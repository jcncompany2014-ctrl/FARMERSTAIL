/**
 * formatters.ts unit tests — Node native test runner.
 *
 * 모든 함수가 pure 라 stub 불요. 한국 사용자 입력 다양한 패턴 (한글 / 공백
 * 혼입 / 특수문자 / 자릿수 초과) 을 커버.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatPhone,
  stripHyphens,
  isValidMobilePhone,
  formatZip,
  isValidZip,
  formatBizNumber,
  formatCardNumber,
  formatThousands,
  formatDigitsOnly,
  formatCouponCode,
  formatKoreanName,
} from './formatters.ts'

describe('formatPhone', () => {
  it('returns empty string for empty / null input', () => {
    assert.equal(formatPhone(''), '')
  })

  it('formats 11-digit number with hyphens', () => {
    assert.equal(formatPhone('01012345678'), '010-1234-5678')
  })

  it('is idempotent — already formatted input stays formatted', () => {
    assert.equal(formatPhone('010-1234-5678'), '010-1234-5678')
  })

  it('partially formats while user is typing', () => {
    assert.equal(formatPhone('010'), '010')
    assert.equal(formatPhone('0101'), '010-1')
    assert.equal(formatPhone('01012345'), '010-1234-5')
  })

  it('strips non-digit characters (Korean / English / symbols)', () => {
    assert.equal(formatPhone('abc010가1234ㄱ5678'), '010-1234-5678')
    assert.equal(formatPhone('010 1234 5678'), '010-1234-5678')
    assert.equal(formatPhone('010.1234.5678'), '010-1234-5678')
  })

  it('truncates beyond 11 digits', () => {
    assert.equal(formatPhone('012345678901234'), '012-3456-7890')
  })
})

describe('stripHyphens', () => {
  it('removes hyphens and whitespace', () => {
    assert.equal(stripHyphens('010-1234-5678'), '01012345678')
    assert.equal(stripHyphens('010 1234 5678'), '01012345678')
    assert.equal(stripHyphens('010   - 1234-5678'), '01012345678')
  })

  it('handles empty / null input', () => {
    assert.equal(stripHyphens(''), '')
    assert.equal(stripHyphens(null as unknown as string), '')
  })

  it('keeps non-hyphen characters', () => {
    assert.equal(stripHyphens('abc-def-123'), 'abcdef123')
  })
})

describe('isValidMobilePhone', () => {
  it('accepts 010 numbers with or without hyphens', () => {
    assert.equal(isValidMobilePhone('01012345678'), true)
    assert.equal(isValidMobilePhone('010-1234-5678'), true)
    assert.equal(isValidMobilePhone('010 1234 5678'), true)
  })

  it('accepts 10-digit 010 numbers (older 010-XXX-XXXX)', () => {
    assert.equal(isValidMobilePhone('0101234567'), true)
  })

  it('rejects non-010 prefixes', () => {
    assert.equal(isValidMobilePhone('011-1234-5678'), false)
    assert.equal(isValidMobilePhone('02-1234-5678'), false)
  })

  it('rejects too short / too long', () => {
    assert.equal(isValidMobilePhone('010123'), false)
    assert.equal(isValidMobilePhone('0101234567890'), false)
  })

  it('rejects letters or special characters', () => {
    assert.equal(isValidMobilePhone('010-abcd-5678'), false)
  })
})

describe('formatZip', () => {
  it('extracts 5 digits', () => {
    assert.equal(formatZip('12345'), '12345')
    assert.equal(formatZip('123456789'), '12345')
    assert.equal(formatZip('1-2-3-4-5'), '12345')
  })

  it('returns shorter string while typing', () => {
    assert.equal(formatZip('123'), '123')
    assert.equal(formatZip(''), '')
  })

  it('strips non-digits', () => {
    assert.equal(formatZip('abc12345xyz'), '12345')
  })
})

describe('isValidZip', () => {
  it('accepts exactly 5 digits', () => {
    assert.equal(isValidZip('12345'), true)
  })

  it('rejects shorter / longer / non-digit', () => {
    assert.equal(isValidZip('1234'), false)
    assert.equal(isValidZip('123456'), false)
    assert.equal(isValidZip('1234a'), false)
    assert.equal(isValidZip(''), false)
  })
})

describe('formatBizNumber', () => {
  it('formats 10-digit business number to XXX-XX-XXXXX', () => {
    assert.equal(formatBizNumber('2430603606'), '243-06-03606')
  })

  it('partial format while typing', () => {
    assert.equal(formatBizNumber('243'), '243')
    assert.equal(formatBizNumber('2430'), '243-0')
    assert.equal(formatBizNumber('243060'), '243-06-0')
  })

  it('truncates beyond 10 digits', () => {
    assert.equal(formatBizNumber('24306036061234'), '243-06-03606')
  })
})

describe('formatCardNumber', () => {
  it('groups into 4-digit segments', () => {
    assert.equal(formatCardNumber('1234567812345678'), '1234-5678-1234-5678')
  })

  it('strips non-digits', () => {
    assert.equal(
      formatCardNumber('1234 5678-1234.5678'),
      '1234-5678-1234-5678',
    )
  })

  it('truncates at 16 digits', () => {
    assert.equal(
      formatCardNumber('12345678123456781234'),
      '1234-5678-1234-5678',
    )
  })

  it('handles short input', () => {
    assert.equal(formatCardNumber('12345'), '1234-5')
  })
})

describe('formatThousands', () => {
  it('adds commas every 3 digits', () => {
    assert.equal(formatThousands(1234567), '1,234,567')
    assert.equal(formatThousands(1000), '1,000')
    assert.equal(formatThousands(0), '0')
  })

  it('accepts string input', () => {
    assert.equal(formatThousands('1234567'), '1,234,567')
    assert.equal(formatThousands('1,234,567'), '1,234,567')
  })

  it('returns empty for null / undefined / empty', () => {
    assert.equal(formatThousands(null), '')
    assert.equal(formatThousands(undefined), '')
    assert.equal(formatThousands(''), '')
  })

  it('returns empty for NaN', () => {
    assert.equal(formatThousands('not a number'), '')
  })
})

describe('formatDigitsOnly', () => {
  it('strips non-digits', () => {
    assert.equal(formatDigitsOnly('abc123def'), '123')
  })

  it('respects maxLen', () => {
    assert.equal(formatDigitsOnly('1234567890', 4), '1234')
  })

  it('handles empty', () => {
    assert.equal(formatDigitsOnly('', 5), '')
  })
})

describe('formatCouponCode', () => {
  it('uppercases and removes non-alphanumerics', () => {
    assert.equal(formatCouponCode('welcome-2026!'), 'WELCOME2026')
  })

  it('respects 16-char default limit', () => {
    assert.equal(
      formatCouponCode('ABCDEFGHIJKLMNOPQRSTUV'),
      'ABCDEFGHIJKLMNOP',
    )
  })

  it('respects custom maxLen', () => {
    assert.equal(formatCouponCode('ABCDEFG', 4), 'ABCD')
  })
})

describe('formatKoreanName', () => {
  it('trims leading whitespace', () => {
    assert.equal(formatKoreanName('   김철수'), '김철수')
  })

  it('respects maxLen (default 20)', () => {
    const long = '가'.repeat(30)
    assert.equal(formatKoreanName(long).length, 20)
  })

  it('keeps trailing whitespace (user might be typing)', () => {
    assert.equal(formatKoreanName('홍길동 '), '홍길동 ')
  })
})
