"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

type GraphNode = {
  id: string;
  label: string;
  group: string;
  x?: number;
  y?: number;
};

type GraphLink = {
  source: string;
  target: string;
  label?: string;
};

type GraphData = {
  nodes: GraphNode[];
  links: GraphLink[];
};

type GraphViewProps = {
  highlightedNodes: string[];
};

const GROUP_COLORS: Record<string, string> = {
  customer: "#7db7f0",
  sales_order: "#2f7fd6",
  delivery: "#f08aa3",
  billing_document: "#db607e",
};

export function GraphView({ highlightedNodes }: GraphViewProps) {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [zoomPercent, setZoomPercent] = useState(100);

  useEffect(() => {
    let ignore = false;

    async function loadGraph() {
      try {
        const response = await fetch("/api/graph");
        const payload = (await response.json()) as GraphData | { error: string };
        if (!response.ok || "error" in payload) {
          throw new Error("error" in payload ? payload.error : "Failed to fetch graph data.");
        }

        const data = payload as GraphData;
        if (!ignore) {
          setGraphData(data);
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load graph.");
        }
      }
    }

    loadGraph();

    return () => {
      ignore = true;
    };
  }, []);

  const highlightedSet = useMemo(() => new Set(highlightedNodes), [highlightedNodes]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#fcfcfb]">
      <div className="absolute left-4 top-3 z-20 flex items-center gap-2">
        <button className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-xs text-neutral-700 shadow-sm">
          Minimize
        </button>
        <button className="rounded-lg bg-black px-4 py-2 text-xs text-white shadow-sm">
          Hide Granular Overlay
        </button>
      </div>

      <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-xl bg-black/70 px-3 py-2 text-white shadow-lg backdrop-blur">
        <button className="h-8 w-8 rounded-md text-lg text-white/90">←</button>
        <button className="h-8 w-8 rounded-md text-lg text-white/90">→</button>
        <div className="mx-1 h-6 w-px bg-white/15" />
        <button className="h-8 w-8 rounded-md text-lg text-white/90">−</button>
        <span className="min-w-12 text-center text-sm">{zoomPercent}%</span>
        <button className="h-8 w-8 rounded-md text-lg text-white/90">+</button>
      </div>

      <div className="absolute right-4 top-4 z-20 rounded-lg border border-neutral-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <p className="text-[11px] uppercase tracking-[0.22em] text-neutral-400">Graph</p>
        <p className="mt-1 text-sm font-medium text-neutral-800">
          {graphData.nodes.length} nodes · {graphData.links.length} links
        </p>
      </div>

      {selectedNode ? (
        <div className="absolute left-1/2 top-6 z-20 w-[320px] -translate-x-1/2 rounded-2xl border border-neutral-200 bg-white/95 p-4 shadow-xl backdrop-blur">
          <h3 className="text-base font-semibold text-neutral-900">{selectedNode.label}</h3>
          <div className="mt-3 space-y-1 text-sm text-neutral-700">
            <p>
              <span className="text-neutral-400">Node ID:</span> {selectedNode.id}
            </p>
            <p>
              <span className="text-neutral-400">Entity Type:</span> {selectedNode.group.replaceAll("_", " ")}
            </p>
            <p>
              <span className="text-neutral-400">Connections:</span>{" "}
              {
                graphData.links.filter((link) => link.source === selectedNode.id || link.target === selectedNode.id)
                  .length
              }
            </p>
          </div>
          <button
            onClick={() => setSelectedNode(null)}
            className="mt-4 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600"
          >
            Close
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="flex h-full items-center justify-center px-6 text-sm text-red-600">{error}</div>
      ) : (
        <ForceGraph2D
          graphData={graphData}
          width={typeof window !== "undefined" ? Math.max(window.innerWidth - 360, 900) : 900}
          height={typeof window !== "undefined" ? window.innerHeight - 90 : 760}
          backgroundColor="#fcfcfb"
          linkColor={() => "rgba(127, 195, 244, 0.4)"}
          linkWidth={(link) => {
            const source = typeof link.source === "object" ? link.source.id : link.source;
            const target = typeof link.target === "object" ? link.target.id : link.target;
            return highlightedSet.has(String(source)) || highlightedSet.has(String(target)) ? 2.2 : 1;
          }}
          nodeRelSize={4}
          cooldownTicks={160}
          d3VelocityDecay={0.18}
          onZoom={({ k }) => setZoomPercent(Math.round(k * 100))}
          onNodeClick={(node) => setSelectedNode(node as GraphNode)}
          nodeCanvasObject={(node, ctx, globalScale) => {
            const currentNode = node as GraphNode;
            const isHighlighted = highlightedSet.has(currentNode.id);
            const radius = isHighlighted ? 7.5 : 3.3;
            const fontSize = isHighlighted ? 12 / globalScale : 0;
            const fill = isHighlighted ? "#1d4ed8" : (GROUP_COLORS[currentNode.group] ?? "#9ca3af");

            ctx.beginPath();
            ctx.fillStyle = fill;
            ctx.arc(currentNode.x ?? 0, currentNode.y ?? 0, radius, 0, 2 * Math.PI, false);
            ctx.fill();

            if (isHighlighted) {
              ctx.beginPath();
              ctx.strokeStyle = "#111827";
              ctx.lineWidth = 2 / globalScale;
              ctx.arc(currentNode.x ?? 0, currentNode.y ?? 0, radius + 4, 0, 2 * Math.PI, false);
              ctx.stroke();
            }

            if (isHighlighted) {
              ctx.font = `600 ${fontSize}px sans-serif`;
              ctx.textAlign = "left";
              ctx.textBaseline = "middle";
              ctx.fillStyle = "#111827";
              ctx.fillText(currentNode.label, (currentNode.x ?? 0) + radius + 6, currentNode.y ?? 0);
            }
          }}
        />
      )}
    </div>
  );
}
