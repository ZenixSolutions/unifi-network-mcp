import { describe, expect, it } from 'vitest';
import { getBodyValidator } from '../../src/api/validate.js';
import { loadOpMap } from '../../src/tools/registry.js';
import { UnifiUsageError } from '../../src/domain/types.js';
import { BODY_FIXTURES } from '../fixtures/bodies.js';

const map = loadOpMap();
const validate = getBodyValidator();

function opByOpId(opId: string) {
  for (const tool of Object.values(map.tools)) {
    for (const op of Object.values(tool.ops)) if (op.opId === opId) return op;
  }
  throw new Error(`no op ${opId}`);
}

describe('body validation against the vendor schemas', () => {
  it('accepts every committed fixture (fixtures conform to the vendor contract)', () => {
    for (const [opId, body] of Object.entries(BODY_FIXTURES)) {
      const op = opByOpId(opId);
      expect(op.bodySchema, opId).not.toBeNull();
      expect(() => {
        validate(op.bodySchema!, body);
      }, opId).not.toThrow();
    }
  });

  it('rejects a wrong field type with the vendor field name in the message', () => {
    const op = opByOpId('createVouchers');
    expect(() => {
      validate(op.bodySchema!, { name: 'x', timeLimitMinutes: 'sixty' });
    }).toThrow(UnifiUsageError);
    expect(() => {
      validate(op.bodySchema!, { name: 'x', timeLimitMinutes: 'sixty' });
    }).toThrow(/timeLimitMinutes/);
  });

  it('rejects a missing required field', () => {
    const op = opByOpId('createVouchers');
    expect(() => {
      validate(op.bodySchema!, { name: 'x' });
    }).toThrow(/timeLimitMinutes/);
  });

  it('rejects an undocumented discriminator value (const-pinned anyOf)', () => {
    const op = opByOpId('executeAdoptedDeviceAction');
    expect(() => {
      validate(op.bodySchema!, { action: 'SELF_DESTRUCT' });
    }).toThrow(UnifiUsageError);
    expect(() => {
      validate(op.bodySchema!, { action: 'RESTART' });
    }).not.toThrow();
  });

  it('validates guest authorization limits from the vendor schema', () => {
    const op = opByOpId('executeConnectedClientAction');
    expect(() => {
      validate(op.bodySchema!, { action: 'AUTHORIZE_GUEST_ACCESS', timeLimitMinutes: 0 });
    }).toThrow(UnifiUsageError); // minimum is 1
  });

  it('every body-carrying operation has a fixture (coverage is complete)', () => {
    for (const tool of Object.values(map.tools)) {
      for (const op of Object.values(tool.ops)) {
        if (op.bodySchema !== null) {
          expect(BODY_FIXTURES[op.opId], `missing fixture for ${op.opId}`).toBeDefined();
        }
      }
    }
  });
});
