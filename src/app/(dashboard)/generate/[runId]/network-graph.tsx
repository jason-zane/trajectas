"use client"

import React, { useState, useRef, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { constructColor } from "./metric-helpers"
import type { GeneratedItem } from "@/types/database"

const BASE_W = 600
const BASE_H = 450

type GraphStage = "initial" | "final"

interface GraphNode {
  item: GeneratedItem
  communityId: number
}

interface NodePos {
  x: number
  y: number
  item: GeneratedItem
  constructIndex: number
  communityIndex: number
  communityId: number
}

function communityForStage(item: GeneratedItem, stage: GraphStage): number | undefined {
  if (stage === "initial") {
    return item.initialCommunityId ?? item.communityId
  }

  if (item.isRedundant || item.isUnstable) {
    return undefined
  }

  return item.finalCommunityId ?? item.communityId
}

function displayNodesForStage(items: GeneratedItem[], stage: GraphStage): GraphNode[] {
  return items
    .map((item) => ({
      item,
      communityId: communityForStage(item, stage) ?? 0,
    }))
    .filter(({ item, communityId }) => stage === "initial" || (!(item.isRedundant || item.isUnstable) && communityId !== 0))
}

function buildRadialLayout(
  nodes: GraphNode[],
  constructIds: string[],
  cx: number,
  cy: number,
): NodePos[] {
  const communities = new Map<number, GraphNode[]>()
  for (const node of nodes) {
    if (!communities.has(node.communityId)) communities.set(node.communityId, [])
    communities.get(node.communityId)!.push(node)
  }

  const communityIds = Array.from(communities.keys()).sort((a, b) => a - b)
  const numCommunities = communityIds.length
  if (numCommunities === 0) return []

  const outerRadius = Math.min(cx, cy) - 60
  const innerRadius = Math.min(60, outerRadius * 0.4)

  const positions: NodePos[] = []

  communityIds.forEach((communityId, communityIndex) => {
    const communityNodes = communities.get(communityId)!
    const angle = (communityIndex / numCommunities) * 2 * Math.PI - Math.PI / 2
    const ccx = cx + outerRadius * Math.cos(angle)
    const ccy = cy + outerRadius * Math.sin(angle)

    communityNodes.forEach(({ item }, itemIndex) => {
      const n = communityNodes.length
      if (n === 1) {
        positions.push({
          x: ccx,
          y: ccy,
          item,
          constructIndex: constructIds.indexOf(item.constructId),
          communityIndex,
          communityId,
        })
        return
      }

      const itemAngle = (itemIndex / n) * 2 * Math.PI
      positions.push({
        x: ccx + innerRadius * Math.cos(itemAngle),
        y: ccy + innerRadius * Math.sin(itemAngle),
        item,
        constructIndex: constructIds.indexOf(item.constructId),
        communityIndex,
        communityId,
      })
    })
  })

  return positions
}

function buildConstructCommunityMap(
  nodes: GraphNode[],
): Map<string, number> {
  const grouped = new Map<string, GraphNode[]>()
  nodes.forEach((node) => {
    const arr = grouped.get(node.item.constructId) ?? []
    arr.push(node)
    grouped.set(node.item.constructId, arr)
  })

  const map = new Map<string, number>()
  grouped.forEach((constructNodes, constructId) => {
    const counts = new Map<number, number>()
    constructNodes.forEach(({ communityId }) => {
      if (communityId === 0) return
      counts.set(communityId, (counts.get(communityId) ?? 0) + 1)
    })

    let modalCommunityId = -1
    let maxCount = 0
    counts.forEach((count, communityId) => {
      if (count > maxCount) {
        maxCount = count
        modalCommunityId = communityId
      }
    })

    if (modalCommunityId !== -1) map.set(constructId, modalCommunityId)
  })

  return map
}

interface TooltipState {
  x: number
  y: number
  item: GeneratedItem
}

export function NetworkGraph({
  items,
  constructIds,
  constructNameMap,
  onItemClick,
}: {
  items: GeneratedItem[]
  constructIds: string[]
  constructNameMap: Map<string, string>
  onItemClick: (itemId: string) => void
}) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [stage, setStage] = useState<GraphStage>("final")
  const svgRef = useRef<SVGSVGElement>(null)

  const isMulti = constructIds.length >= 2
  const displayNodes = useMemo(() => displayNodesForStage(items, stage), [items, stage])
  const communityCount = useMemo(
    () => new Set(displayNodes.map((node) => node.communityId)).size,
    [displayNodes],
  )
  const constructCommunityMap = useMemo(
    () => buildConstructCommunityMap(displayNodes),
    [displayNodes],
  )

  const pad = 40
  const scale = communityCount > 4 ? 1 + (communityCount - 4) * 0.1 : 1
  const W = Math.round(BASE_W * scale)
  const H = Math.round(BASE_H * scale)
  const cx = W / 2
  const cy = H / 2

  const positions = useMemo(
    () => buildRadialLayout(displayNodes, constructIds, cx, cy),
    [displayNodes, constructIds, cx, cy],
  )

  const communityGroups = useMemo(() => {
    const grouped = new Map<number, NodePos[]>()
    positions.forEach((position) => {
      const arr = grouped.get(position.communityId) ?? []
      arr.push(position)
      grouped.set(position.communityId, arr)
    })
    return grouped
  }, [positions])

  const { edges, centroids } = useMemo(() => {
    const nextEdges: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
    const nextCentroids: Array<{ x: number; y: number; label: number }> = []

    communityGroups.forEach((group, communityId) => {
      const cgx = group.reduce((sum, pos) => sum + pos.x, 0) / group.length
      const cgy = group.reduce((sum, pos) => sum + pos.y, 0) / group.length
      nextCentroids.push({ x: cgx, y: cgy, label: communityId })

      if (group.length < 2) return
      group.forEach((position) => {
        nextEdges.push({ x1: cgx, y1: cgy, x2: position.x, y2: position.y })
      })
    })

    return { edges: nextEdges, centroids: nextCentroids }
  }, [communityGroups])

  const handleMouseEnter = useCallback(
    (position: NodePos, event: React.MouseEvent<SVGCircleElement>) => {
      const rect = svgRef.current?.getBoundingClientRect()
      if (!rect) return
      setTooltip({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        item: position.item,
      })
    },
    [],
  )

  const handleMouseLeave = useCallback(() => setTooltip(null), [])

  const stageCounts = useMemo(() => {
    const kept = items.filter((item) => !(item.isRedundant || item.isUnstable)).length
    return { initial: items.length, final: kept }
  }, [items])

  return (
    <div className="relative rounded-xl bg-card ring-1 ring-foreground/[0.06] shadow-sm overflow-hidden">
      <div className="px-5 pt-4 pb-2 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-overline text-primary">Item Network</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {stage === "initial"
                ? "Initial clustering across the full generated pool, before redundancy and instability filtering."
                : "Final clustering after UVA and bootEGA. Only items that survived filtering are shown."}
            </p>
          </div>
          <div className="inline-flex rounded-lg bg-muted/50 p-1">
            <Button
              type="button"
              size="sm"
              variant={stage === "initial" ? "default" : "ghost"}
              className="h-8"
              onClick={() => setStage("initial")}
            >
              Initial ({stageCounts.initial})
            </Button>
            <Button
              type="button"
              size="sm"
              variant={stage === "final" ? "default" : "ghost"}
              className="h-8"
              onClick={() => setStage("final")}
            >
              Final ({stageCounts.final})
            </Button>
          </div>
        </div>
      </div>

      {displayNodes.length === 0 ? (
        <div className="px-5 pb-5 text-sm text-muted-foreground">
          No items are available for this network view.
        </div>
      ) : (
        <svg
          ref={svgRef}
          viewBox={`${-pad} ${-pad} ${W + pad * 2} ${H + pad * 2}`}
          className="w-full"
          style={{ minHeight: 400 }}
          aria-label="Item network graph"
        >
          {edges.map((edge, index) => (
            <line
              key={index}
              x1={edge.x1}
              y1={edge.y1}
              x2={edge.x2}
              y2={edge.y2}
              stroke="currentColor"
              strokeOpacity={0.15}
              strokeWidth={1}
            />
          ))}

          {centroids.map((centroid) => (
            <g key={`centroid-${centroid.label}`}>
              <circle cx={centroid.x} cy={centroid.y} r={10} fill="currentColor" fillOpacity={0.08} />
              <text
                x={centroid.x}
                y={centroid.y}
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-muted-foreground text-[10px] font-medium pointer-events-none select-none"
              >
                {centroid.label}
              </text>
            </g>
          ))}

          {positions.map((position) => {
            const { item, constructIndex, communityId } = position
            const isRemovedByUva = item.removalStage === "uva"
            const isRemovedByBoot = item.removalStage === "boot_ega"
            const isProblematic = isRemovedByUva || isRemovedByBoot
            const isLeaking =
              isMulti &&
              communityId !== 0 &&
              constructCommunityMap.has(item.constructId) &&
              communityId !== constructCommunityMap.get(item.constructId)

            return (
              <circle
                key={item.id}
                cx={position.x}
                cy={position.y}
                r={isProblematic ? 4 : 6}
                fill={isRemovedByUva ? "hsl(0 84% 60%)" : constructColor(constructIndex)}
                stroke={isLeaking ? "hsl(38 92% 50%)" : "white"}
                strokeWidth={isLeaking ? 2 : 1}
                strokeDasharray={isRemovedByBoot ? "2 2" : undefined}
                className="cursor-pointer transition-opacity hover:opacity-80"
                onMouseEnter={(event) => handleMouseEnter(position, event)}
                onMouseLeave={handleMouseLeave}
                onClick={() => onItemClick(item.id)}
                aria-label={item.stem.slice(0, 60)}
              />
            )
          })}
        </svg>
      )}

      <div className="px-5 pb-4 space-y-2">
        {stage === "initial" && (
          <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-full bg-primary inline-block" />
              Survived filtering
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-full inline-block" style={{ background: "hsl(0 84% 60%)" }} />
              Removed in UVA
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-full border border-dashed border-foreground/60 inline-block" />
              Removed in bootEGA
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-full border-2 inline-block" style={{ borderColor: "hsl(38 92% 50%)" }} />
              Cross-construct leakage
            </span>
          </div>
        )}

        {stage === "final" && (
          <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-full bg-primary inline-block" />
              Retained item
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-full border-2 inline-block" style={{ borderColor: "hsl(38 92% 50%)" }} />
              Cross-construct leakage
            </span>
          </div>
        )}

        {isMulti && (
          <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
            {constructIds.map((id, index) => (
              <span key={id} className="flex items-center gap-1.5">
                <span
                  className="size-2.5 rounded-full inline-block shrink-0"
                  style={{ background: constructColor(index) }}
                />
                {constructNameMap.get(id) ?? id}
              </span>
            ))}
          </div>
        )}
      </div>

      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 max-w-xs rounded-lg bg-popover text-popover-foreground border border-border shadow-md px-3 py-2 text-xs"
          style={{
            left: Math.min(tooltip.x + 12, W - 220),
            top: Math.max(tooltip.y - 76, 0),
          }}
        >
          <p className="font-medium line-clamp-3">{tooltip.item.stem}</p>
          <div className="mt-1.5 space-y-0.5 text-muted-foreground">
            {tooltip.item.wtoMax !== undefined && <p>wTO: {tooltip.item.wtoMax.toFixed(3)}</p>}
            {tooltip.item.bootStability !== undefined && <p>Stability: {tooltip.item.bootStability.toFixed(3)}</p>}
            {tooltip.item.initialCommunityId !== undefined && <p>Initial community: {tooltip.item.initialCommunityId}</p>}
            {tooltip.item.finalCommunityId !== undefined && <p>Final community: {tooltip.item.finalCommunityId}</p>}
            {tooltip.item.removalStage && tooltip.item.removalStage !== "kept" && (
              <p>
                Removed in {tooltip.item.removalStage === "uva" ? "UVA" : "bootEGA"}
                {tooltip.item.removalSweep ? ` (sweep ${tooltip.item.removalSweep})` : ""}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
