// utils/cityGraph.ts

export type TrafficLevel = 'CLEAR' | 'MODERATE' | 'HEAVY' | 'BLOCKED';

export type Road = { 
  id: string; 
  name: string; 
  to: string; 
  baseDistance: number; 
  trafficLevel: TrafficLevel;
};

export type CityGraph = Record<string, Road[]>;

// Coordinates for the Map
export const MAP_NODES: Record<string, [number, number]> = {
  "Koduvally":      [11.3550, 75.9100], 
  "Thamarassery_Rd": [11.3300, 75.8800], 
  "Karanthur":      [11.3000, 75.8500], // Main Highway
  "Kunnamangalam":  [11.3100, 75.8700], // Bypass
  "Vellimadukunnu": [11.2800, 75.8300],
  "Medical_College":[11.2650, 75.8350], 
};

// Initial State: All Roads Clear
export const INITIAL_ROADS: CityGraph = {
  "Koduvally": [
    { id: "r1", name: "NH 766", to: "Thamarassery_Rd", baseDistance: 3, trafficLevel: 'CLEAR' }
  ],
  "Thamarassery_Rd": [
    { id: "r1_rev", name: "NH 766", to: "Koduvally", baseDistance: 3, trafficLevel: 'CLEAR' },
    // Main Road (Faster but prone to traffic)
    { id: "r2_main", name: "Karanthur Highway", to: "Karanthur", baseDistance: 4, trafficLevel: 'CLEAR' }, 
    // Bypass (Slower distance, but reliable)
    { id: "r2_alt", name: "Kunnamangalam Bypass", to: "Kunnamangalam", baseDistance: 6, trafficLevel: 'CLEAR' }
  ],
  "Karanthur": [
    { id: "r2_main_rev", name: "Karanthur Highway", to: "Thamarassery_Rd", baseDistance: 4, trafficLevel: 'CLEAR' },
    { id: "r3_main", name: "City Road", to: "Vellimadukunnu", baseDistance: 3, trafficLevel: 'CLEAR' }
  ],
  "Kunnamangalam": [
    { id: "r2_alt_rev", name: "Kunnamangalam Bypass", to: "Thamarassery_Rd", baseDistance: 6, trafficLevel: 'CLEAR' },
    { id: "r3_alt", name: "Ring Road", to: "Vellimadukunnu", baseDistance: 5, trafficLevel: 'CLEAR' }
  ],
  "Vellimadukunnu": [
    { id: "r3_main_rev", name: "City Road", to: "Karanthur", baseDistance: 3, trafficLevel: 'CLEAR' },
    { id: "r3_alt_rev", name: "Ring Road", to: "Kunnamangalam", baseDistance: 5, trafficLevel: 'CLEAR' },
    { id: "r4", name: "MCH Road", to: "Medical_College", baseDistance: 2, trafficLevel: 'CLEAR' }
  ],
  "Medical_College": [
    { id: "r4_rev", name: "MCH Road", to: "Vellimadukunnu", baseDistance: 2, trafficLevel: 'CLEAR' }
  ]
};

// Helper: Get cost multiplier based on traffic
const getTrafficCost = (level: TrafficLevel) => {
  switch(level) {
    case 'CLEAR': return 1;
    case 'MODERATE': return 2; // Takes 2x longer
    case 'HEAVY': return 5;    // Takes 5x longer
    case 'BLOCKED': return Infinity;
    default: return 1;
  }
};

// AI Routing Engine (Dijkstra with Traffic Weights)
export function calculateSmartRoute(graph: CityGraph, start: string, end: string) {
  const costs: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  const queue: string[] = [];

  for (const node in graph) {
    costs[node] = Infinity;
    prev[node] = null;
    queue.push(node);
  }
  costs[start] = 0;

  while (queue.length > 0) {
    queue.sort((a, b) => costs[a] - costs[b]);
    const u = queue.shift()!;
    if (u === end) break;

    if (graph[u]) {
      graph[u].forEach(road => {
        // AI LOGIC: Real Cost = Distance * Traffic Multiplier
        const currentCost = road.baseDistance * getTrafficCost(road.trafficLevel);
        const newTotalCost = costs[u] + currentCost;

        if (newTotalCost < costs[road.to]) {
          costs[road.to] = newTotalCost;
          prev[road.to] = u;
        }
      });
    }
  }

  const path: string[] = [];
  let u: string | null = end;
  while (u) {
    path.unshift(u);
    u = prev[u];
  }
  return path[0] === start ? path : [];
}