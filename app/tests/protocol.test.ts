// The postMessage protocol accepts only well-formed, namespaced, versioned messages.
import { describe, expect, it } from 'vitest';
import { isAppMessage, isWorldMessage, wrap, PROTOCOL_NS, PROTOCOL_VERSION } from '../../world-prototype/src/bridge/protocol';

describe('world ⇄ app protocol', () => {
  it('accepts valid world messages', () => {
    expect(isWorldMessage(wrap({ type: 'interact', site: { zoneId: 'bay', siteId: 'evdoctor' } }))).toBe(true);
    expect(isWorldMessage(wrap({ type: 'proximity', site: null }))).toBe(true);
    expect(isWorldMessage(wrap({ type: 'progress', stage: 'erosion', frac: 0.3 }))).toBe(true);
    expect(isWorldMessage(wrap({ type: 'error', code: 'context-lost', message: 'x' }))).toBe(true);
  });
  it('rejects messages without the namespace or with another version', () => {
    expect(isWorldMessage({ type: 'interact', site: { zoneId: 'bay', siteId: 'evdoctor' } })).toBe(false);
    expect(isWorldMessage({ ns: 'other', v: PROTOCOL_VERSION, type: 'zone', zoneId: 'bay' })).toBe(false);
    expect(isWorldMessage({ ns: PROTOCOL_NS, v: 99, type: 'zone', zoneId: 'bay' })).toBe(false);
  });
  it('rejects unknown types and malformed fields', () => {
    expect(isWorldMessage({ ns: PROTOCOL_NS, v: PROTOCOL_VERSION, type: 'eval', code: 'alert(1)' })).toBe(false);
    expect(isWorldMessage(wrap({ type: 'interact', site: { zoneId: 'bay' } } as never))).toBe(false);
    expect(isWorldMessage(wrap({ type: 'progress', stage: 'x', frac: 7 }))).toBe(false);
    expect(isWorldMessage(wrap({ type: 'error', code: 'pwned', message: '' } as never))).toBe(false);
    expect(isWorldMessage(null)).toBe(false);
    expect(isWorldMessage('string')).toBe(false);
  });
  it('app → world guards', () => {
    expect(isAppMessage(wrap({ type: 'teleport', zoneId: 'research' }))).toBe(true);
    expect(isAppMessage(wrap({ type: 'input', enabled: false }))).toBe(true);
    expect(isAppMessage(wrap({ type: 'input', enabled: 'no' } as never))).toBe(false);
    expect(isAppMessage(wrap({ type: 'teleport', zoneId: '' }))).toBe(false);
    expect(isAppMessage(wrap({ type: 'view', mode: 'sideways' } as never))).toBe(false);
    // a world message is not an app message
    expect(isAppMessage(wrap({ type: 'zone', zoneId: 'bay' }))).toBe(false);
  });
});
