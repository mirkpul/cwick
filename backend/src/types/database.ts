/**
 * Common database result types
 * Used to replace `any` types throughout the codebase
 */

export type DbRow = Record<string, unknown>;
export type DbResult = DbRow[];

export interface QueryResult<T = DbRow> {
  rows: T[];
  rowCount: number;
  [key: string]: unknown;
}
