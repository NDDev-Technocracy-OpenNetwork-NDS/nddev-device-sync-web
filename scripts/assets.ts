/** Immutable static-file inventory shared by the builder and app-shell worker. */
export interface Asset {
  readonly path: string;
  readonly sha256: string;
  readonly bytes: number;
}
