import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyIcDateOfBirth, dateOfBirthFromIc } from './ic.js';

test('dateOfBirthFromIc reads YYMMDD from a Malaysian IC', () => {
  assert.equal(dateOfBirthFromIc('900101-01-1234'), '1990-01-01');
  assert.equal(dateOfBirthFromIc('160315145678'), '2016-03-15');
  assert.equal(dateOfBirthFromIc('991332-01-1234'), '');
  assert.equal(dateOfBirthFromIc('90'), '');
});

test('applyIcDateOfBirth keeps an existing date of birth', () => {
  assert.equal(applyIcDateOfBirth('1988-05-20', '900101-01-1234'), '1988-05-20');
  assert.equal(applyIcDateOfBirth('', '900101-01-1234'), '1990-01-01');
});
