// STUB — owned by Laptop C; replaced on feat/data
import type { AnalysisResult, EntityGraph } from '@akshi/contracts';
import { ENTITY_GRAPH_FIXTURE } from '@akshi/contracts/fixtures';

/** Returns the entity-graph fixture regardless of input. */
export function buildEntityGraph(
  _history: AnalysisResult[],
  _opts?: { includeBundled?: boolean },
): EntityGraph {
  return ENTITY_GRAPH_FIXTURE;
}
