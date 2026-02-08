"use client";
import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Circle, useMapEvents, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// --- Icons ---
const SignalGreen = L.divIcon({
  className: 'signal-green',
  html: '<div style="background:#22c55e; width:24px; height:24px; border-radius:50%; border:3px solid white; box-shadow:0 0 10px #22c55e;"></div>',
  iconSize: [24, 24]
});

const SignalRed = L.divIcon({
  className: 'signal-red',
  html: '<div style="background:#ef4444; width:24px; height:24px; border-radius:50%; border:3px solid white; box-shadow:0 0 10px #ef4444;"></div>',
  iconSize: [24, 24]
});

// --- Types ---
type Signal = { id: string; pos: [number, number]; state: 'RED' | 'GREEN' };
type Block = { id: string; pos: [number, number]; type: 'REROUTE' | 'CONTINUE' };

export default function MapBuilder() {
  const [points, setPoints] = useState<[number, number][]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  
  // UI State for Congestion Modal
  const [pendingBlock, setPendingBlock] = useState<[number, number] | null>(null);

  // 1. Toggle Signal Logic
  const toggleSignal = async (id: string) => {
    const updatedSignals = signals.map(s => 
      s.id === id ? { ...s, state: (s.state === 'RED' ? 'GREEN' : 'RED') as 'RED'|'GREEN' } : s
    );
    setSignals(updatedSignals);

    // Immediate API Call
    await fetch("/api/simulation/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_signal", signals: updatedSignals }),
    });
  };

  // 2. Add Congestion Logic
  const confirmBlock = (type: 'REROUTE' | 'CONTINUE') => {
    if (pendingBlock) {
      const newBlock: Block = { 
        id: `blk_${Date.now()}`, 
        pos: pendingBlock, 
        type: type 
      };
      setBlocks([...blocks, newBlock]);
      setPendingBlock(null);
    }
  };

  const MapEvents = () => {
    useMapEvents({
      click(e) {
        // Left Click: Add Route Point
        setPoints(prev => [...prev, [e.latlng.lat, e.latlng.lng]]);
      },
      contextmenu(e) {
        // Right Click: Add Signal
        const newSignal: Signal = { 
          id: `sig_${Date.now()}`, 
          pos: [e.latlng.lat, e.latlng.lng], 
          state: 'RED' 
        };
        setSignals(prev => [...prev, newSignal]);
      },
      keypress(e) {
        // Press 'b' key + mouse hover (simulated here via Shift+Click for ease)
      }
    });
    // Custom handler for Shift+Click to add Block
    useMapEvents({
      click(e) {
        if (e.originalEvent.shiftKey) {
          // SHIFT + CLICK = Add Congestion
          setPendingBlock([e.latlng.lat, e.latlng.lng]);
          L.DomEvent.stopPropagation(e.originalEvent); // Stop road creation
        }
      }
    });
    return null;
  };

  const saveMap = async () => {
    await fetch("/api/simulation/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points, signals, blocks }),
    });
    alert("Map Layout Saved!");
  };

  return (
    <div className="h-full relative">
      {/* --- Controls Header --- */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white px-6 py-3 rounded-full shadow-xl flex gap-6 items-center border border-gray-200">
        <div className="flex flex-col items-center">
          <span className="text-xs font-bold text-gray-400">ADD ROAD</span>
          <span className="text-sm font-bold">Left Click</span>
        </div>
        <div className="w-px h-8 bg-gray-300"></div>
        <div className="flex flex-col items-center">
          <span className="text-xs font-bold text-gray-400">ADD SIGNAL</span>
          <span className="text-sm font-bold text-orange-600">Right Click</span>
        </div>
        <div className="w-px h-8 bg-gray-300"></div>
        <div className="flex flex-col items-center">
          <span className="text-xs font-bold text-gray-400">ADD BLOCK</span>
          <span className="text-sm font-bold text-red-600">Shift + Click</span>
        </div>
        <button onClick={saveMap} className="ml-4 bg-blue-600 text-white px-6 py-2 rounded-full font-bold hover:bg-blue-700 transition">
          SAVE ALL
        </button>
      </div>

      {/* --- Congestion Decision Modal --- */}
      {pendingBlock && (
        <div className="absolute inset-0 z-[2000] bg-black/40 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-sm w-full text-center animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🚧</span>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Congestion Detected</h3>
            <p className="text-gray-500 mb-6 text-sm">How should the ambulance handle this blockage?</p>
            
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => confirmBlock('CONTINUE')}
                className="px-4 py-3 bg-yellow-100 text-yellow-700 font-bold rounded-xl hover:bg-yellow-200 transition border border-yellow-200"
              >
                🐢 Slow Down
                <div className="text-[10px] font-normal opacity-70">Continue Journey</div>
              </button>
              
              <button 
                onClick={() => confirmBlock('REROUTE')}
                className="px-4 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition shadow-lg shadow-red-200"
              >
                🔀 Reroute
                <div className="text-[10px] font-normal opacity-80">Find Alt Path</div>
              </button>
            </div>
            <button onClick={() => setPendingBlock(null)} className="mt-4 text-gray-400 text-xs hover:text-gray-600 underline">Cancel</button>
          </div>
        </div>
      )}

      {/* --- Map --- */}
      <MapContainer center={[11.2702, 75.7892]} zoom={17} style={{ height: "100%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapEvents />

        {/* Route */}
        <Polyline positions={points} color="#3b82f6" weight={6} opacity={0.6} />

        {/* Signals */}
        {signals.map(s => (
          <Marker 
            key={s.id} 
            position={s.pos} 
            icon={s.state === 'GREEN' ? SignalGreen : SignalRed}
            eventHandlers={{ 
              click: (e) => {
                L.DomEvent.stopPropagation(e); // Prevent adding road point
                toggleSignal(s.id); 
              } 
            }}
          >
            <Popup>
              <div className="text-center">
                <div className="font-bold">Signal {s.id.slice(-4)}</div>
                <div className={`text-sm font-bold ${s.state === 'GREEN' ? 'text-green-600' : 'text-red-600'}`}>
                  {s.state}
                </div>
                <div className="text-xs text-gray-400 mt-1">Click marker to toggle</div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Blocks/Congestion */}
        {blocks.map(b => (
          <Circle 
            key={b.id} 
            center={b.pos} 
            radius={25} 
            pathOptions={{
              color: b.type === 'REROUTE' ? '#dc2626' : '#eab308', 
              fillColor: b.type === 'REROUTE' ? '#dc2626' : '#eab308', 
              fillOpacity: 0.5,
              dashArray: '5, 10'
            }} 
          >
            <Popup>
              <div className="text-center font-bold">
                {b.type === 'REROUTE' ? '⛔ ROAD BLOCKED' : '⚠️ CONGESTION'}
                <div className="text-xs font-normal text-gray-500">
                  Action: {b.type}
                </div>
              </div>
            </Popup>
          </Circle>
        ))}
      </MapContainer>
    </div>
  );
}