"use client";
import { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Circle, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Custom Icons
const AmbulanceIcon = L.icon({
  iconUrl: "/images/ambulance.png", // Ensure you have this in /public/images/
  iconSize: [40, 40],
  iconAnchor: [20, 20]
});

export default function AmbulancePlayer() {
  // Data State
  const [route, setRoute] = useState<[number, number][]>([]);
  const [signals, setSignals] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<any[]>([]);
  
  // Simulation State
  const [currentPos, setCurrentPos] = useState<[number, number] | null>(null);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [status, setStatus] = useState("Initializing...");
  
  // Animation Refs
  const indexRef = useRef(0);
  const progressRef = useRef(0);
  const reqRef = useRef<number>(null);

  // 1. Fetch Data & Sync
  const syncData = async () => {
    const res = await fetch("/api/simulation");
    const data = await res.json();
    setRoute(data.points || []);
    setSignals(data.signals || []);
    setBlocks(data.blocks || []);
    if (!currentPos && data.points?.[0]) setCurrentPos(data.points[0]);
  };

  useEffect(() => {
    syncData();
    const interval = setInterval(syncData, 2000); // Poll for blocks/signals
    return () => clearInterval(interval);
  }, []);

  // 2. Toggle Emergency Mode (API)
  const toggleEmergency = async () => {
    const newMode = !emergencyMode;
    setEmergencyMode(newMode);
    await fetch("/api/simulation", {
      method: "POST",
      body: JSON.stringify({ emergencyMode: newMode })
    });
  };

  // 3. Movement Logic
  useEffect(() => {
    if (route.length < 2) return;

    const animate = () => {
      const start = route[indexRef.current];
      const end = route[indexRef.current + 1];

      if (!start || !end) return;

      const currentLatLng = L.latLng(currentPos || start);

      // --- LOGIC: Check for Blocks ---
      const nearestBlock = blocks.find(b => currentLatLng.distanceTo(L.latLng(b.pos)) < 30);
      if (nearestBlock) {
        setStatus("⛔ BLOCKED! Rerouting...");
        // Logic: In a real app, A* alg would run here. 
        // For simulation, we stop and wait for the user to remove the block in Admin
        reqRef.current = requestAnimationFrame(animate); 
        return; 
      }

      // --- LOGIC: Check for Signals ---
      const nearestSignal = signals.find(s => currentLatLng.distanceTo(L.latLng(s.pos)) < 40);
      
      let speed = 0.005; // Normal Speed

      if (nearestSignal) {
        // AUTOMATIC PRIORITY: If Emergency Mode is ON, turn signal Green
        if (emergencyMode && nearestSignal.state === 'RED') {
           // We optimistic update here, real app would call API
           nearestSignal.state = 'GREEN'; 
           setStatus("🚑 PRIORITY: Signal overridden to GREEN");
        }

        if (nearestSignal.state === 'RED' && !emergencyMode) {
          speed = 0; // Stop
          setStatus("🔴 Waiting at Red Light...");
        } else {
          setStatus(emergencyMode ? "🚨 EMERGENCY RUN" : "🟢 Moving");
        }
      } else {
        setStatus(emergencyMode ? "🚨 EMERGENCY RUN" : "🟢 Moving");
      }

      // --- Movement Interpolation ---
      progressRef.current += speed;
      
      if (progressRef.current >= 1) {
        progressRef.current = 0;
        indexRef.current++;
      }

      if (indexRef.current < route.length - 1) {
        const lat = start[0] + (end[0] - start[0]) * progressRef.current;
        const lng = start[1] + (end[1] - start[1]) * progressRef.current;
        setCurrentPos([lat, lng]);
        reqRef.current = requestAnimationFrame(animate);
      } else {
        setStatus("✅ Destination Reached");
      }
    };

    reqRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(reqRef.current!);
  }, [route, signals, blocks, emergencyMode, currentPos]);

  if (!currentPos) return <div>Loading Simulation...</div>;

  return (
    <div className="relative h-full">
      {/* Dashboard */}
      <div className="absolute top-4 right-4 z-[1000] bg-white p-4 rounded-xl shadow-xl border w-80">
        <h2 className="text-xl font-bold mb-2">Ambulance Control</h2>
        <div className={`text-center font-mono font-bold p-2 rounded mb-4 ${status.includes('RED') || status.includes('BLOCK') ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
          {status}
        </div>
        
        <button 
          onClick={toggleEmergency}
          className={`w-full py-3 rounded-lg font-bold text-white transition-all ${emergencyMode ? 'bg-red-600 animate-pulse' : 'bg-gray-400'}`}
        >
          {emergencyMode ? "🚨 EMERGENCY MODE: ON" : "⚪ EMERGENCY MODE: OFF"}
        </button>
        <p className="text-xs text-gray-500 mt-2 text-center">
          When ON, traffic lights turn green automatically.
        </p>
      </div>

      <MapContainer center={[11.2702, 75.7892]} zoom={16} style={{ height: "100vh" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        
        <Polyline positions={route} color={emergencyMode ? "red" : "blue"} weight={6} opacity={0.6} />
        
        <Marker position={currentPos} icon={AmbulanceIcon} />

        {signals.map(s => (
          <Circle 
            key={s.id} 
            center={s.pos} 
            radius={15} 
            pathOptions={{
              color: s.state === 'RED' ? 'red' : 'green', 
              fillColor: s.state === 'RED' ? 'red' : 'green', 
              fillOpacity: 0.8 
            }} 
          />
        ))}

        {blocks.map(b => (
          <Circle key={b.id} center={b.pos} radius={25} pathOptions={{color: 'black', fillColor: 'black', dashArray: '5,5'}} />
        ))}

      </MapContainer>
    </div>
  );
}