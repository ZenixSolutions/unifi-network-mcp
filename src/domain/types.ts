/** Types for the generated operation map (src/generated/op-map.json). */

export type OperationClass = 'read' | 'create' | 'update' | 'admin' | 'destructive';

/** Classes that require `confirm: true` in the tool input (RFC-004 D1). */
export const GATED_CLASSES: readonly OperationClass[] = ['admin', 'destructive'];

export interface ParamDef {
  readonly name: string;
  readonly required?: boolean;
  readonly description?: string;
  readonly schema: JsonSchema;
}

/** Minimal JSON-schema shape we traverse; vendor schemas are richer but opaque here. */
export interface JsonSchema {
  readonly type?: string | string[];
  readonly format?: string;
  readonly enum?: readonly unknown[];
  readonly $ref?: string;
  readonly [key: string]: unknown;
}

export interface OperationDef {
  readonly opId: string;
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly path: string;
  readonly class: OperationClass;
  readonly summary: string;
  readonly pathParams: readonly ParamDef[];
  readonly queryParams: readonly ParamDef[];
  readonly bodyRequired: boolean;
  readonly bodySchema: JsonSchema | null;
  readonly responseSchema: JsonSchema | null;
}

export interface ToolDef {
  readonly title: string;
  readonly ops: Readonly<Record<string, OperationDef>>;
}

export interface OpMap {
  readonly apiVersion: string;
  readonly generatedFrom: string;
  readonly operationCount: number;
  readonly tools: Readonly<Record<string, ToolDef>>;
}

/** Error raised for a non-2xx response from the UniFi Network API. */
export class UnifiApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code?: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'UnifiApiError';
  }
}

/** Error raised before any request is sent (bad input, missing config). */
export class UnifiUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnifiUsageError';
  }
}
