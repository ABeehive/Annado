import { AgendaBlock } from './types';

interface OverlapInfo {
  overlapIndex: number;
  overlapTotal: number;
}

/**
 * Compute side-by-side layout columns for overlapping agenda blocks.
 * Singletons get { overlapIndex: 0, overlapTotal: 1 } — no visual change.
 */
export function computeOverlapLayout(blocks: AgendaBlock[]): Map<string, OverlapInfo> {
  const result = new Map<string, OverlapInfo>();
  if (blocks.length === 0) return result;

  // Only schedule blocks stay full-width in the background — all events participate in columns
  const layoutBlocks: AgendaBlock[] = [];
  for (const block of blocks) {
    if (block.type === 'schedule') {
      result.set(block.id, { overlapIndex: 0, overlapTotal: 1 });
    } else {
      layoutBlocks.push(block);
    }
  }
  if (layoutBlocks.length === 0) return result;

  // Sort by start time, then by earlier end time (shorter blocks first for greedy)
  const sorted = [...layoutBlocks].sort(
    (a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes,
  );

  // Build overlap clusters — a cluster ends when the next block starts
  // at or after the cluster's max endMinutes
  const clusters: AgendaBlock[][] = [];
  let cluster: AgendaBlock[] = [sorted[0]];
  let clusterEnd = sorted[0].endMinutes;

  for (let i = 1; i < sorted.length; i++) {
    const block = sorted[i];
    if (block.startMinutes < clusterEnd) {
      // Overlaps with current cluster
      cluster.push(block);
      clusterEnd = Math.max(clusterEnd, block.endMinutes);
    } else {
      clusters.push(cluster);
      cluster = [block];
      clusterEnd = block.endMinutes;
    }
  }
  clusters.push(cluster);

  // Assign columns greedily within each cluster
  for (const group of clusters) {
    if (group.length === 1) {
      result.set(group[0].id, { overlapIndex: 0, overlapTotal: 1 });
      continue;
    }

    // columns[i] = endMinutes of the last block placed in column i
    const columns: number[] = [];

    for (const block of group) {
      // Find first column where this block doesn't overlap
      let placed = false;
      for (let col = 0; col < columns.length; col++) {
        if (block.startMinutes >= columns[col]) {
          columns[col] = block.endMinutes;
          result.set(block.id, { overlapIndex: col, overlapTotal: 0 }); // total set later
          placed = true;
          break;
        }
      }
      if (!placed) {
        result.set(block.id, { overlapIndex: columns.length, overlapTotal: 0 });
        columns.push(block.endMinutes);
      }
    }

    // Set overlapTotal for all blocks in this cluster
    const total = columns.length;
    for (const block of group) {
      const info = result.get(block.id)!;
      info.overlapTotal = total;
    }
  }

  return result;
}
