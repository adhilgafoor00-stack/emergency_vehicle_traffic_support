"use client";
import { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LatLngTuple } from "leaflet";
const START_POS: LatLngTuple = [11.3550, 75.9100]; // Koduvally];
const END_POS: LatLngTuple = [11.2650, 75.8350];


// A known "safe" waypoint to bypass the main highway (Kunnamangalam)
const BYPASS_POINT = [11.3056, 75.8753]; 

// Icons
const AmbIcon = L.icon({ iconUrl: '/images/ambulance.png', iconSize: [50, 50], iconAnchor: [25, 25] });
const StartIcon = L.divIcon({ className: '', html: '🟢', iconSize: [20, 20] });
const EndIcon = L.divIcon({ className: '', html: '🏁', iconSize: [30, 30] });
const BlockIcon = L.divIcon({ className: '', html: '⛔', iconSize: [25, 25] });

export default function AmbulanceCockpit() {
  const [route, setRoute] = useState<[number, number][]>([]);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [ambulancePos, setAmbulancePos] = useState<[number, number] | null>(null);
  const [status, setStatus] = useState("Initializing Navigation...");
  const [isRerouting, setIsRerouting] = useState(false);

  // Animation Ref
  const progressRef = useRef(0);

  // 1. Fetch Blocks from API (Polling)
  useEffect(() => {
    const fetchBlocks = async () => {
      const res = await fetch('/api/traffic');
      const data = await res.json();
      setBlocks(data.blocks);
    };
    fetchBlocks();
    const interval = setInterval(fetchBlocks, 2000); // Check for blocks every 2s
    return () => clearInterval(interval);
  }, []);

  // 2. Intelligent Routing Engine (Calculates Route based on Blocks)
  useEffect(() => {
    const calculateRoute = async () => {
      const startStr = `${START_POS[1]},${START_POS[0]}`;
      const endStr = `${END_POS[1]},${END_POS[0]}`;
      let url = `https://router.project-osrm.org/route/v1/driving/${startStr};${endStr}?overview=full&geometries=geojson`;

      // LOGIC: Check if any block is "near" the main highway center (approximate)
      // In a real app, we check if the block intersects the Polyline.
      // Here, simple logic: If a block exists, assume main road is blocked -> Use Bypass.
      if (blocks.length > 0) {
        setIsRerouting(true);
        setStatus("⚠️ Block Reported! Recalculating via Bypass...");
        const bypassStr = `${BYPASS_POINT[1]},${BYPASS_POINT[0]}`;
        url = `https://router.project-osrm.org/route/v1/driving/${startStr};${bypassStr};${endStr}?overview=full&geometries=geojson`;
      } else {
        setIsRerouting(false);
        setStatus("✅ Main Route Clear. Proceeding.");
      }

      try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.routes?.[0]) {
          const coords = data.routes[0].geometry.coordinates;
          const path = coords.map((p: any) => [p[1], p[0]] as [number, number]);
          setRoute(path);
          
          // If initializing, set ambulance at start
          if (!ambulancePos) setAmbulancePos(path[0]);
        }
      } catch (e) {
        console.error("Routing error", e);
      }
    };

    calculateRoute();
  }, [blocks.length]); // Re-run whenever number of blocks changes

  // 3. Driving Simulation (Follow the Line)
  useEffect(() => {
    if (route.length < 2) return;
    
    const interval = setInterval(() => {
      // Move index forward
      progressRef.current += 1; // Speed factor
      
      if (progressRef.current >= route.length) {
        setStatus("🏁 Arrived at Medical College");
        return; 
      }

      setAmbulancePos(route[Math.floor(progressRef.current)]);
    }, 100); // 100ms update rate

    return () => clearInterval(interval);
  }, [route]);

  return (
    <div className="h-screen w-full flex flex-col font-sans">
      {/* Driver HUD */}
      <div className={`p-4 text-white shadow-lg z-[1000] relative flex justify-between items-center transition-colors duration-500 ${isRerouting ? 'bg-orange-600' : 'bg-blue-600'}`}>
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            🚑 Ambulance Cockpit
          </h2>
          <p className="font-mono text-sm uppercase tracking-wide opacity-90">{status}</p>
        </div>
        <div className="text-right">
          <div className="text-xs opacity-75">DESTINATION</div>
          <div className="font-bold text-lg">Medical College</div>
        </div>
      </div>

      <MapContainer center={[11.3000, 75.8700]} zoom={12} style={{ height: "100%", width: "100%" }}>
        <TileLayer url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" subdomains={['mt0','mt1','mt2','mt3']} />
        
        {/* The Route Line */}
        {route.length > 0 && (
          <Polyline 
            positions={route} 
            color={isRerouting ? "#f97316" : "#2563eb"} // Orange if rerouting, Blue if normal
            weight={6} 
            opacity={0.8} 
          />
        )}

        {/* Dynamic Blocks from API */}
        {blocks.map((b) => (
          <Marker key={b.id} position={[b.lat, b.lng]} icon={BlockIcon}>
             <Popup>⛔ Road Blocked Here</Popup>
          </Marker>
        ))}

        {/* The Ambulance */}
        {ambulancePos && <Marker position={ambulancePos} icon={AmbIcon} zIndexOffset={1000} />}

        {/* Landmarks */}
        <Marker position={START_POS} icon={StartIcon} />
        <Marker position={END_POS} icon={EndIcon} />

      </MapContainer>
    </div>
  );
}