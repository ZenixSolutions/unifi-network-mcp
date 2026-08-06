import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { JsonSchema } from '../domain/types.js';
import { UnifiUsageError } from '../domain/types.js';

type Validator = (schema: JsonSchema, value: unknown) => void;

let cached: Validator | undefined;

/**
 * Validates request bodies against the vendor's own component schemas
 * (src/generated/spec-schemas.json, registered under $id "unifi-spec").
 * A bad body fails locally with the vendor's field names in the message,
 * instead of a confusing upstream 400 (NetBox audit finding C2).
 */
export function getBodyValidator(): Validator {
  if (cached) return cached;
  const specDoc = JSON.parse(
    readFileSync(new URL('../generated/spec-schemas.json', import.meta.url), 'utf8'),
  ) as object;
  const ajv = new Ajv2020.default({
    strict: false,
    allErrors: true,
    validateFormats: true,
  });
  addFormats.default(ajv);
  ajv.addSchema(specDoc);
  const compiled = new WeakMap<JsonSchema, ReturnType<typeof ajv.compile>>();
  cached = (schema: JsonSchema, value: unknown): void => {
    let validate = compiled.get(schema);
    if (!validate) {
      validate = ajv.compile(schema);
      compiled.set(schema, validate);
    }
    if (!validate(value)) {
      const details = (validate.errors ?? [])
        .slice(0, 8)
        .map((e) => `${e.instancePath || '(body)'} ${e.message ?? 'invalid'}`)
        .join('; ');
      throw new UnifiUsageError(`Request body does not match the documented schema: ${details}`);
    }
  };
  return cached;
}

/** Test seam: drop the cached Ajv instance. */
export function resetBodyValidator(): void {
  cached = undefined;
}
