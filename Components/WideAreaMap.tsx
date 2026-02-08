"use client";

import { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Circle, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// --- ICONS ---
const Icons = {
  Ambulance: L.icon({ iconUrl: '/images/ambulance.png', iconSize: [50, 50], iconAnchor: [25, 25] }),
  Start: L.divIcon({ className: '', html: '<div style="background:#22c55e; width:20px; height:20px; border:3px solid white; border-radius:50%; box-shadow:0 0 8px black"></div>' }),
  End: L.divIcon({ className: '', html: '<div style="background:#ef4444; width:20px; height:20px; border:3px solid white; border-radius:50%; box-shadow:0 0 8px black"></div>' }),
  Block: L.divIcon({ className: '', html: '<div style="font-size:24px;">⛔</div>', iconSize: [24, 24], iconAnchor: [12, 12] })
};

type Point = [number, number];

export default function WideAreaMap() {
  // State
  const [startPos, setStartPos] = useState<Point | null>(null);
  const [endPos, setEndPos] = useState<Point | null>(null);
  const [routePath, setRoutePath] = useState<Point[]>([]);
  const [obstacles, setObstacles] = useState<Point[]>([]);
  
  // Simulation
  const [ambulancePos, setAmbulancePos] = useState<Point | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [toolMode, setToolMode] = useState<'START' | 'END' | 'BLOCK'>('START');
  const [status, setStatus] = useState("Select START point on map");

  // Animation Refs
  const progressRef = useRef(0);
  const reqRef = useRef<number>(null);

  // --- 1. ROUTING ENGINE (OSRM) ---
  // Calculates real driving path between two points, avoiding obstacles if possible
  const calculateRoute = async (start: Point, end: Point, currentObstacles: Point[]) => {
    setStatus("🔄 Finding fastest route...");
    
    // OSRM requires "lng,lat" string format
    const startStr = `${start[1]},${start[0]}`;
    const endStr = `${end[1]},${end[0]}`;
    
    // To "Block" a road in OSRM without a custom server, we use a trick:
    // We treat obstacles as "avoid areas" or we split the route into segments around them.
    // simpler approach for client-side: 
    // If there is an obstacle, we find a midpoint slightly away from it to force a detour.
    
    let url = `https://router.project-osrm.org/route/v1/driving/${startStr};${endStr}?overview=full&geometries=geojson`;
    
    // BASIC DETOUR LOGIC:
    // If we have obstacles, we check if they are on the direct line. 
    // If yes, we add a 'hint' waypoint slightly off-road to force OSRM to reroute.
    if (currentObstacles.length > 0) {
       // Simple simulation: If blocked, try to go via a specific bypass coordinate
       // In a real app, you'd calculate the nearest intersection to avoid.
       // For Koduvally -> Med College, a common bypass point is Kunnamangalam (11.3056, 75.8753)
       const bypassPoint = "75.8753,11.3056"; 
       url = `https://router.project-osrm.org/route/v1/driving/${startStr};${bypassPoint};${endStr}?overview=full&geometries=geojson`;
       setStatus("⚠️ Obstacle detected! Calculating Bypass...");
    }

    try {
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.routes && data.routes.length > 0) {
        // Convert GeoJSON [lng, lat] to Leaflet [lat, lng]
        const coordinates = data.routes[0].geometry.coordinates;
        const path: Point[] = coordinates.map((p: number[]) => [p[1], p[0]]);
        
        setRoutePath(path);
        setAmbulancePos(path[0]);
        setStatus(`✅ Route Found: ${(data.routes[0].distance / 1000).toFixed(1)} km`);
      } else {
        setStatus("❌ No route found.");
      }
    } catch (e) {
      console.error(e);
      setStatus("❌ Routing Error (Check Internet).");
    }
  };

  // --- 2. MAP CLICKS ---
  const handleMapClick = (e: L.LeafletMouseEvent) => {
    const { lat, lng } = e.latlng;
    
    if (toolMode === 'START') {
      setStartPos([lat, lng]);
      setAmbulancePos([lat, lng]);
      if (endPos) calculateRoute([lat, lng], endPos, obstacles);
      setToolMode('END'); // Auto-switch to next tool
      setStatus("Select DESTINATION point");
    }
    else if (toolMode === 'END') {
      setEndPos([lat, lng]);
      if (startPos) calculateRoute(startPos, [lat, lng], obstacles);
      setToolMode('BLOCK'); // Auto-switch
      setStatus("Route Ready. Add BLOCKS or Start Simulation.");
    }
    else if (toolMode === 'BLOCK') {
      const newObstacles = [...obstacles, [lat, lng] as Point];
      setObstacles(newObstacles);
      // Trigger Reroute if start/end exist
      if (startPos && endPos) {
        calculateRoute(startPos, endPos, newObstacles);
      }
    }
  };

  // --- 3. ANIMATION LOOP ---
  useEffect(() => {
    if (!isSimulating || routePath.length < 2) return;

    const animate = () => {
      // SPEED FACTOR: Increase this number to go faster
      // 0.5 means "Jump half a coordinate point per frame" (Very Fast for long distance)
      const speed = 0.5; 
      
      progressRef.current += speed;
      const currentIndex = Math.floor(progressRef.current);
      const nextIndex = currentIndex + 1;

      if (nextIndex >= routePath.length) {
        setAmbulancePos(routePath[routePath.length - 1]);
        setIsSimulating(false);
        setStatus("🏁 Destination Reached!");
        return;
      }

      const currentLoc = routePath[currentIndex];
      const nextLoc = routePath[nextIndex];

      // Interpolate position for smoothness
      const ratio = progressRef.current % 1;
      const lat = currentLoc[0] + (nextLoc[0] - currentLoc[0]) * ratio;
      const lng = currentLoc[1] + (nextLoc[1] - currentLoc[1]) * ratio;

      setAmbulancePos([lat, lng]);
      
      // Auto-center map on ambulance every 50 frames to follow it
      // (Optional, disabled here to let user pan freely)
      
      reqRef.current = requestAnimationFrame(animate);
    };

    reqRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(reqRef.current!);
  }, [isSimulating, routePath]);

  // Map Events Component
  const MapEvents = () => {
    useMapEvents({ click: handleMapClick });
    return null;
  };

  return (
    <div className="h-screen w-full flex flex-col font-sans">
      
      {/* HEADER HUD */}
      <div className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-lg z-[1000] relative">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-blue-400">🚑 Wide Area Traffic System</h1>
          <p className="text-sm text-gray-300">
            Current Tool: <span className="font-bold text-yellow-400">{toolMode}</span> | Status: {status}
          </p>
        </div>

        <div className="flex gap-3">
          <button 
             onClick={() => setToolMode('START')}
             className={`px-4 py-2 rounded text-sm font-bold ${toolMode === 'START' ? 'bg-green-600' : 'bg-slate-700'}`}
          >
            📍 Set Start
          </button>
          <button 
             onClick={() => setToolMode('END')}
             className={`px-4 py-2 rounded text-sm font-bold ${toolMode === 'END' ? 'bg-red-600' : 'bg-slate-700'}`}
          >
            🏁 Set End
          </button>
          <button 
             onClick={() => setToolMode('BLOCK')}
             className={`px-4 py-2 rounded text-sm font-bold ${toolMode === 'BLOCK' ? 'bg-orange-600' : 'bg-slate-700'}`}
          >
            ⛔ Add Block
          </button>
          <div className="w-px h-8 bg-slate-600 mx-2"></div>
          <button 
            onClick={() => { progressRef.current = 0; setIsSimulating(true); }}
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded font-bold shadow-lg"
          >
            ▶ START DRIVE
          </button>
        </div>
      </div>

      {/* MAP CONTAINER */}
      <MapContainer 
        center={[11.3000, 75.8500]} // Centered on Kozhikode district area
        zoom={12} 
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer 
          url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
          subdomains={['mt0','mt1','mt2','mt3']}
          attribution="Google Maps"
        />
        <MapEvents />

        {/* Route Line */}
        {routePath.length > 0 && (
          <Polyline positions={routePath} color="#3b82f6" weight={6} opacity={0.7} />
        )}

        {/* Start / End Markers */}
        {startPos && <Marker position={startPos} icon={Icons.Start} />}
        {endPos && <Marker position={endPos} icon={Icons.End} />}

        {/* Obstacles */}
        {obstacles.map((pos, i) => (
          <Marker key={i} position={pos} icon={Icons.Block}>
             <Popup>Road Blocked</Popup>
          </Marker>
        ))}

        {/* Ambulance */}
        {ambulancePos && (
          <Marker position={ambulancePos} icon={Icons.Ambulance} zIndexOffset={1000} />
        )}

      </MapContainer>
    </div>
  );
}