import { useWindowVirtualizer } from "@tanstack/react-virtual";

interface UseVirtualListOptions {
  count: number;
  estimateSize?: (index: number) => number;
  overscan?: number;
}

/**
 * Virtualises a flat vertical list using the window as the scroll container.
 * No fixed-height wrapper needed — the list sits in normal page flow.
 *
 * Usage:
 *   const { virtualItems, totalSize } = useVirtualList({ count: items.length })
 *
 *   <div style={{ height: totalSize, position: "relative" }}>
 *     {virtualItems.map((vItem) => (
 *       <div
 *         key={vItem.key}
 *         ref={vItem.measureElement}
 *         style={{ position: "absolute", top: vItem.start, left: 0, right: 0 }}
 *       >
 *         {items[vItem.index]}
 *       </div>
 *     ))}
 *   </div>
 */
export function useVirtualList({
  count,
  estimateSize = () => 140,
  overscan = 5,
}: UseVirtualListOptions) {
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useWindowVirtualizer({ count, estimateSize, overscan });

  return {
    virtualItems: virtualizer.getVirtualItems(),
    totalSize: virtualizer.getTotalSize(),
    virtualizer,
  };
}
