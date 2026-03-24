"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { GraphPayload } from "@/lib/graph-types";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

type GraphPanelProps = {
  graph: GraphPayload;
  highlightedNodeIds: string[];
  isLoading: boolean;
  error: string | null;
};

export function GraphPanel({ graph, highlightedNodeIds, isLoading, error }: GraphPanelProps) {
  const highlightedSet = useMemo(() => new Set(highlightedNodeIds), [highlightedNodeIds]);

  if (error) {
    return <div className="flex h-[70vh] items-center justify-center p-6 text-sm text-red-700">{error}</div>;
  }

  if (isLoading && graph.nodes.length === 0) {
    return <div className="flex h-[70vh] items-center justify-center p-6 text-sm text-[var(--muted)]">Loading graph…</div>;
  }

  return (
    <div className="h-[70vh] w-full">
      <ForceGraph2D
        graphData={graph}
        backgroundColor="rgba(0,0,0,0)"
        nodeRelSize={6}
        cooldownTicks={120}
        linkColor={() => "rgba(74, 54, 35, 0.18)"}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const graphNode = node as GraphPayload["nodes"][number];
          const highlighted = highlightedSet.has(graphNode.id);
          const label = graphNode.label;
          const fontSize = highlighted ? 14 / globalScale : 11 / globalScale;
          const radius = highlighted ? 9 : 6;

          ctx.beginPath();
          ctx.fillStyle = highlighted ? "#111827" : graphNode.color;
          ctx.arc(graphNode.x ?? 0, graphNode.y ?? 0, radius, 0, 2 * Math.PI, false);
          ctx.fill();

          ctx.font = `600 ${fontSize}px ui-sans-serif`;
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "#201810";
          ctx.fillText(label, (graphNode.x ?? 0) + radius + 4, graphNode.y ?? 0);

          if (highlighted) {
            ctx.beginPath();
            ctx.strokeStyle = "#f59e0b";
            ctx.lineWidth = 2 / globalScale;
            ctx.arc(graphNode.x ?? 0, graphNode.y ?? 0, radius + 4, 0, 2 * Math.PI, false);
            ctx.stroke();
          }
        }}
      />
    </div>
  );
}
