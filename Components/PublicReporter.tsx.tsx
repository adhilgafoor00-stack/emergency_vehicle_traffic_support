"use client";
import { useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Icons
const BlockIcon = L.divIcon({ className: '', html: '<div style="font-size:30px;">⛔</div>', iconSize: [30, 30], iconAnchor: [15, 15] });

export default function PublicReporter() {
  const [blocks, setBlocks] = useState<any[]>([]);

  // Click Handler to Report Block
  const MapEvents = () => {
    useMapEvents({
      click(e) {
        const confirmBlock = confirm("Report road blockage here?");
        if (confirmBlock) {
          addBlock(e.latlng.lat, e.latlng.lng);
        }
      }
    });
    return null;
  };

  const addBlock = async (lat: number, lng: number) => {
    // 1. Optimistic UI update
    const newBlock = { lat, lng, id: Date.now().toString() };
    setBlocks(prev => [...prev, newBlock]);

    // 2. Send to API
    await fetch('/api/traffic', {
      method: 'POST',
      body: JSON.stringify({ action: 'BLOCK', lat, lng })
    });
  };

  return (
    <div className="h-screen w-full flex flex-col">
      <div className="bg-red-600 text-white p-4 flex justify-between items-center z-[1000] relative shadow-md">
        <div>
          <h1 className="font-bold text-xl">📢 Public Traffic Reporter</h1>
          <p className="text-sm opacity-90">Tap anywhere on the map to report a blocked road.</p>
        </div>
        <button 
          onClick={() => {
            fetch('/api/traffic', { method: 'POST', body: JSON.stringify({ action: 'CLEAR' }) });
            setBlocks([]);
          }}
          className="bg-white text-red-600 px-4 py-2 rounded font-bold text-sm"
        >
          Reset All
        </button>
      </div>

      <MapContainer center={[11.3000, 75.8500]} zoom={13} style={{ height: "100%", width: "100%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapEvents />
        {blocks.map((b) => (
          <Marker key={b.id} position={[b.lat, b.lng]} icon={BlockIcon}>
            <Popup>⛔ Reported Blockage</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}