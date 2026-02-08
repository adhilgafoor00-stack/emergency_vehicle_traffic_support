"use client";

import { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Circle, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// --- CUSTOM ICONS ---
const Icons = {
  Ambulance: L.icon({ iconUrl: '/images/ambulance.png', iconSize: [45, 45], iconAnchor: [22, 22] }),
  Start: L.divIcon({ className: '', html: '<div style="background:#22c55e; width:16px; height:16px; border:3px solid white; border-radius:50%; box-shadow:0 0 8px #22c55e"></div>' }),
  End: L.divIcon({ className: '', html: '<div style="background:#ef4444; width:16px; height:16px; border:3px solid white; border-radius:50%; box-shadow:0 0 8px #ef4444"></div>' }),
  SignalRed: L.divIcon({ className: '', html: '<div style="background:#ef4444; width:24px; height:24px; border:3px solid white; border-radius:50%; box-shadow:0 0 10px red"></div>', iconSize: [24,24] }),
  SignalGreen: L.divIcon({ className: '', html: '<div style="background:#22c55e; width:24px; height:24px; border:3px solid white; border-radius:50%; box-shadow:0 0 10px green"></div>', iconSize: [24,24] }),
};

// --- TYPES ---
type Point = [number, number];
type Signal = { id: string; lat: number; lng: number; state: 'RED' | 'GREEN' };
type Junction = { id: string; lat: number; lng: number; mode: 'REROUTE' | 'SLOWDOWN' };
type Obstacle = { id: string; lat: number; lng: number };

export default function TrafficCommandCenter() {
  // --- STATE ---
  const [startPos, setStartPos] = useState<Point | null>(null);
  const [endPos, setEndPos] = useState<Point | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [junctions, setJunctions] = useState<Junction[]>([]);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [routePath, setRoutePath] = useState<Point[]>([]);
  
  // Simulation State
  const [ambulancePos, setAmbulancePos] = useState<Point | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [toolMode, setToolMode] = useState<'NONE' | 'START' | 'END' | 'SIGNAL' | 'JUNCTION' | 'OBSTACLE'>('NONE');
  const [log, setLog] = useState<string>("System Ready. Build Map.");

  // Refs for Animation Loop
  const progressRef = useRef(0);
  const speedRef = useRef(0.0005); // Base Speed
  const reqRef = useRef<number>(null);
  const signalsRef = useRef<Signal[]>([]); // Ref to access latest signals in loop
  const junctionsRef = useRef<Junction[]>([]);

  // Sync State to Refs for Animation Loop
  useEffect(() => { signalsRef.current = signals; }, [signals]);
  useEffect(() => { junctionsRef.current = junctions; }, [junctions]);

  // --- 1. ROUTING ENGINE (OSRM) ---
  const calculateRoute = async (start: Point, end: Point) => {
    setLog("🔄 Calculating Route...");
    try {
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`);
      const data = await res.json();
      if (data.routes?.[0]) {
        const path: Point[] = data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]]);
        setRoutePath(path);
        setAmbulancePos(path[0]);
        setLog("✅ Route Generated.");
        return path;
      }
    } catch (e) {
      setLog("❌ Routing Failed.");
    }
    return [];
  };

  // --- 2. API ACTIONS ---
  const toggleSignal = async (id: string) => {
    // Optimistic Update
    setSignals(prev => prev.map(s => s.id === id ? { ...s, state: s.state === 'RED' ? 'GREEN' : 'RED' } : s));
    
    // API Call
    await fetch('/api/simulation', {
      method: 'POST',
      body: JSON.stringify({ action: 'toggle_signal', id })
    });
  };

  const updateJunctionMode = async (id: string, mode: 'REROUTE' | 'SLOWDOWN') => {
    setJunctions(prev => prev.map(j => j.id === id ? { ...j, mode } : j));
    // In a real app, send this to API too
  };

  // --- 3. BUILDER LOGIC ---
  const handleMapClick = (e: L.LeafletMouseEvent) => {
    const { lat, lng } = e.latlng;
    
    if (toolMode === 'START') {
      setStartPos([lat, lng]);
      setAmbulancePos([lat, lng]);
      if (endPos) calculateRoute([lat, lng], endPos);
    }
    else if (toolMode === 'END') {
      setEndPos([lat, lng]);
      if (startPos) calculateRoute(startPos, [lat, lng]);
    }
    else if (toolMode === 'SIGNAL') {
      const newSig: Signal = { id: `sig_${Date.now()}`, lat, lng, state: 'RED' };
      setSignals(prev => [...prev, newSig]);
    }
    else if (toolMode === 'JUNCTION') {
      const newJunc: Junction = { id: `junc_${Date.now()}`, lat, lng, mode: 'SLOWDOWN' };
      setJunctions(prev => [...prev, newJunc]);
    }
    else if (toolMode === 'OBSTACLE') {
      const newObs: Obstacle = { id: `obs_${Date.now()}`, lat, lng };
      setObstacles(prev => [...prev, newObs]);
      // Trigger Reroute immediately if simulating
      if (isSimulating && ambulancePos && endPos) {
        setLog("⚠️ Road Blocked! Rerouting...");
        calculateRoute(ambulancePos, endPos);
      }
    }
  };

  // --- 4. SIMULATION LOOP (The Brain) ---
  useEffect(() => {
    if (!isSimulating || routePath.length < 2) return;

    const animate = () => {
      // 1. Get Current Position
      const currentIndex = Math.floor(progressRef.current);
      const nextIndex = currentIndex + 1;

      if (nextIndex >= routePath.length) {
        setLog("🏁 Destination Reached!");
        setIsSimulating(false);
        return;
      }

      const currentLoc = routePath[currentIndex];
      const nextLoc = routePath[nextIndex];
      const currentLatLng = L.latLng(currentLoc[0], currentLoc[1]);

      // 2. CHECK SIGNALS (Stop Logic)
      const nearbyRedSignal = signalsRef.current.find(s => 
        s.state === 'RED' && currentLatLng.distanceTo(L.latLng(s.lat, s.lng)) < 30
      );

      if (nearbyRedSignal) {
        setLog("🔴 Stopped at Red Light.");
        // We do NOT increment progressRef, effectively stopping the car
        reqRef.current = requestAnimationFrame(animate);
        return;
      }

      // 3. CHECK JUNCTIONS (Behavior Logic)
      const nearbyJunction = junctionsRef.current.find(j => 
        currentLatLng.distanceTo(L.latLng(j.lat, j.lng)) < 40
      );

      let currentSpeed = 0.05; // Base Speed

      if (nearbyJunction) {
        if (nearbyJunction.mode === 'SLOWDOWN') {
          currentSpeed = 0.01; // Slow down
          // Only log once to avoid spam
          if (Math.random() > 0.9) setLog("⚠️ Junction: Slowing Down...");
        } else if (nearbyJunction.mode === 'REROUTE') {
          // If we haven't already rerouted for this junction...
          // (In a real system we'd flag this junction as 'handled')
          setLog("🔄 Junction: Intelligent Reroute Triggered");
          // Here we would typically trigger A*, for simulation we just continue
        }
      }

      // 4. Move
      progressRef.current += currentSpeed;
      
      // Interpolate for smooth visual
      const p = progressRef.current % 1;
      const lat = currentLoc[0] + (nextLoc[0] - currentLoc[0]) * p;
      const lng = currentLoc[1] + (nextLoc[1] - currentLoc[1]) * p;
      
      setAmbulancePos([lat, lng]);
      reqRef.current = requestAnimationFrame(animate);
    };

    reqRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(reqRef.current!);
  }, [isSimulating, routePath]);


  // --- COMPONENT RENDER ---
  const MapEvents = () => {
    useMapEvents({ click: handleMapClick });
    return null;
  };

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 font-sans">
      
      {/* SIDEBAR CONTROLS */}
      <div className="w-80 bg-gray-800 p-4 flex flex-col gap-4 border-r border-gray-700 shadow-2xl z-10">
        <h1 className="text-xl font-bold text-blue-400 border-b border-gray-700 pb-2">
           🚑 EMS Commander
        </h1>

        {/* Status Log */}
        <div className="bg-black p-2 rounded text-xs font-mono text-green-400 h-16 overflow-y-auto border border-gray-700">
          {'>'} {log}
        </div>

        {/* Builder Tools */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase">Map Tools</p>
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => setToolMode('START')}
              className={`p-2 rounded text-xs font-bold ${toolMode === 'START' ? 'bg-green-600' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
              📍 Set Start
            </button>
            <button 
              onClick={() => setToolMode('END')}
              className={`p-2 rounded text-xs font-bold ${toolMode === 'END' ? 'bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
              🏁 Set End
            </button>
            <button 
              onClick={() => setToolMode('SIGNAL')}
              className={`p-2 rounded text-xs font-bold ${toolMode === 'SIGNAL' ? 'bg-orange-500' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
              🚦 Add Signal
            </button>
            <button 
              onClick={() => setToolMode('JUNCTION')}
              className={`p-2 rounded text-xs font-bold ${toolMode === 'JUNCTION' ? 'bg-purple-500' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
              🌀 Add Junction
            </button>
             <button 
              onClick={() => setToolMode('OBSTACLE')}
              className={`p-2 rounded text-xs font-bold ${toolMode === 'OBSTACLE' ? 'bg-yellow-600' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
              🚧 Add Block
            </button>
          </div>
        </div>

        {/* Simulation Controls */}
        <div className="mt-4">
           <p className="text-xs font-bold text-gray-500 uppercase mb-2">Simulation</p>
           <button 
              onClick={() => { setIsSimulating(!isSimulating); }}
              className={`w-full py-3 rounded font-bold text-sm transition-all ${isSimulating ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'}`}
            >
              {isSimulating ? "STOP SIMULATION" : "START SIMULATION"}
           </button>
        </div>

        {/* Manual Signal Control List */}
        <div className="flex-grow overflow-y-auto mt-4">
          <p className="text-xs font-bold text-gray-500 uppercase mb-2">Signal Controls</p>
          {signals.map((sig, i) => (
            <div key={sig.id} className="flex items-center justify-between bg-gray-700 p-2 rounded mb-2">
              <span className="text-xs">Signal #{i+1}</span>
              <button 
                onClick={() => toggleSignal(sig.id)}
                className={`px-3 py-1 rounded text-xs font-bold ${sig.state === 'GREEN' ? 'bg-green-500 text-black' : 'bg-red-500 text-white'}`}
              >
                {sig.state}
              </button>
            </div>
          ))}
          {signals.length === 0 && <p className="text-xs text-gray-500 italic">No signals placed.</p>}
        </div>
      </div>

      {/* MAP AREA */}
      <div className="flex-grow relative">
        <MapContainer center={[11.2702, 75.7892]} zoom={16} style={{ height: "100%", width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapEvents />

          {/* Render Route */}
          {routePath.length > 0 && <Polyline positions={routePath} color="#3b82f6" weight={6} opacity={0.6} />}

          {/* Render Start/End */}
          {startPos && <Marker position={startPos} icon={Icons.Start} />}
          {endPos && <Marker position={endPos} icon={Icons.End} />}

          {/* Render Signals */}
          {signals.map(s => (
            <Marker key={s.id} position={[s.lat, s.lng]} icon={s.state === 'GREEN' ? Icons.SignalGreen : Icons.SignalRed}>
               <Popup>
                 <div className="text-center font-bold">Signal {s.state}</div>
               </Popup>
            </Marker>
          ))}

          {/* Render Junctions */}
          {junctions.map(j => (
            <Circle key={j.id} center={[j.lat, j.lng]} radius={40} pathOptions={{ color: 'purple', fillColor: 'purple', fillOpacity: 0.2 }}>
              <Popup>
                <div className="flex flex-col gap-2">
                  <span className="font-bold text-xs">Junction Behavior</span>
                  <button onClick={() => updateJunctionMode(j.id, 'REROUTE')} className={`text-xs px-2 py-1 rounded ${j.mode === 'REROUTE' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Opt A: Intelligent Reroute</button>
                  <button onClick={() => updateJunctionMode(j.id, 'SLOWDOWN')} className={`text-xs px-2 py-1 rounded ${j.mode === 'SLOWDOWN' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Opt B: Slow Down</button>
                </div>
              </Popup>
            </Circle>
          ))}

          {/* Render Obstacles */}
          {obstacles.map(o => (
             <Marker key={o.id} position={[o.lat, o.lng]}>
                <Popup>🚧 Road Block</Popup>
             </Marker>
          ))}

          {/* Render Ambulance */}
          {ambulancePos && <Marker position={ambulancePos} icon={Icons.Ambulance} zIndexOffset={1000} />}

        </MapContainer>
      </div>
    </div>
  );
}