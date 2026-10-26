import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidTriggerAccelerator } from '../../lib/accelerator-validate.js';

test('accepts default-style accelerators', () => {
  assert.equal(isValidTriggerAccelerator('<Super><Shift>m'), true);
  assert.equal(isValidTriggerAccelerator('<Primary><Alt>t'), true);
  assert.equal(isValidTriggerAccelerator('F1'), true);
});

test('rejects malformed trailing bracket', () => {
  assert.equal(isValidTriggerAccelerator('<Super><Shift>m>'), false);
});

test('rejects empty and disabled', () => {
  assert.equal(isValidTriggerAccelerator(''), false);
  assert.equal(isValidTriggerAccelerator('   '), false);
  assert.equal(isValidTriggerAccelerator('disabled'), false);
});

test('rejects stray angle brackets in key part', () => {
  assert.equal(isValidTriggerAccelerator('<Super>foo>bar'), false);
});
