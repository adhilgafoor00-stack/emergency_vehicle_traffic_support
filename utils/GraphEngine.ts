// Define Types
export type NodeId = string;
export type Edge = { to: NodeId; weight: number };
export type Graph = Record<NodeId, Edge[]>;
export type Coordinates = { lat: number; lng: number };

// 1. Define the Eranjipalam Road Network Nodes (Coordinates)
export const CITY_GRAPH: Record<NodeId, Coordinates> = {
  "START": { lat: 11.2750, lng: 75.7900 },   // Start Point
  "J1":    { lat: 11.2730, lng: 75.7895 },   // Road Segment 1
  "J2":    { lat: 11.2710, lng: 75.7890 },   // Eranjipalam Junction (Main)
  "J3":    { lat: 11.2690, lng: 75.7885 },   // Road Segment 2
  "END":   { lat: 11.2670, lng: 75.7880 },   // Hospital
  "ALT1":  { lat: 11.2730, lng: 75.7920 },   // Bypass Road A
  "ALT2":  { lat: 11.2690, lng: 75.7920 },   // Bypass Road B
};

// 2. Define Initial Roads (Connections between nodes)
// Weight = "Cost" to travel. Higher weight = Slower road.
export const INITIAL_CONNECTIONS: Graph = {
  "START": [{ to: "J1", weight: 1 }],
  "J1":    [{ to: "J2", weight: 2 }, { to: "ALT1", weight: 4 }], // ALT1 is longer (weight 4)
  "J2":    [{ to: "J3", weight: 2 }, { to: "J1", weight: 2 }],
  "J3":    [{ to: "END", weight: 1 }, { to: "J2", weight: 2 }, { to: "ALT2", weight: 4 }],
  "ALT1":  [{ to: "ALT2", weight: 3 }, { to: "J1", weight: 4 }],
  "ALT2":  [{ to: "J3", weight: 4 }, { to: "ALT1", weight: 3 }, { to: "END", weight: 3 }],
  "END":   [{ to: "J3", weight: 1 }, { to: "ALT2", weight: 3 }]
};

// 3. Dijkstra's Algorithm (The "Brain")
export function findShortestPath(graph: Graph, startNode: NodeId, endNode: NodeId): NodeId[] {
  const distances: Record<NodeId, number> = {};
  const previous: Record<NodeId, NodeId | null> = {};
  const queue: NodeId[] = [];

  // Initialize
  for (const node in graph) {
    distances[node] = Infinity;
    previous[node] = null;
    queue.push(node);
  }
  distances[startNode] = 0;

  while (queue.length > 0) {
    // Sort queue to find the node with the smallest distance
    queue.sort((a, b) => distances[a] - distances[b]);
    const u = queue.shift();

    if (!u || u === endNode) break; // Reached destination or trapped
    if (distances[u] === Infinity) break;

    // Check neighbors
    if (graph[u]) {
      graph[u].forEach(neighbor => {
        const alt = distances[u] + neighbor.weight;
        if (alt < distances[neighbor.to]) {
          distances[neighbor.to] = alt;
          previous[neighbor.to] = u;
        }
      });
    }
  }

  // Reconstruct the path backwards
  const path: NodeId[] = [];
  let u: NodeId | null = endNode;
  
  if (distances[endNode] === Infinity) return []; // No path found

  while (u) {
    path.unshift(u);
    u = previous[u];
  }
  
  return path;
}