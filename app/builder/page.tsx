"use client";

import { useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Circle,
  useMapEvents,
  Popup
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type Point = [number, number];

interface TrafficLight {
  id: string;
  position: Point;
  isGreen: boolean;
  nearestPointIndex: number;
}

interface CongestionZone {
  id: string;
  center: Point;
  radius: number;
  name: string;
}

interface ClickHandlerProps {
  addPoint: (point: Point) => void;
  addTrafficLight: (point: Point) => void;
  addCongestion: (point: Point) => void;
  mode: 'route' | 'traffic' | 'congestion';
}

const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const GreenLightIcon = L.divIcon({
  className: 'custom-traffic-light',
  html: `<div style="width: 28px; height: 28px; background: #22c55e; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 12px rgba(34, 197, 94, 0.9);"></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const RedLightIcon = L.divIcon({
  className: 'custom-traffic-light',
  html: `<div style="width: 28px; height: 28px; background: #ef4444; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 12px rgba(239, 68, 68, 0.9);"></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

L.Marker.prototype.options.icon = DefaultIcon;

function ClickHandler({ addPoint, addTrafficLight, addCongestion, mode }: ClickHandlerProps) {
  useMapEvents({
    click(e) {
      if (mode === 'route') {
        addPoint([e.latlng.lat, e.latlng.lng]);
      } else if (mode === 'traffic') {
        addTrafficLight([e.latlng.lat, e.latlng.lng]);
      } else if (mode === 'congestion') {
        addCongestion([e.latlng.lat, e.latlng.lng]);
      }
    },
  });
  return null;
}

export default function RouteBuilder() {
  const [points, setPoints] = useState<Point[]>([]);
  const [trafficLights, setTrafficLights] = useState<TrafficLight[]>([]);
  const [congestionZones, setCongestionZones] = useState<CongestionZone[]>([]);
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [mode, setMode] = useState<'route' | 'traffic' | 'congestion'>('route');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return <div className="p-4">Loading Map...</div>;

  const findNearestPointIndex = (pos: Point): number => {
    if (points.length === 0) return 0;
    
    let minDist = Infinity;
    let nearestIndex = 0;

    points.forEach((point, index) => {
      const dist = Math.sqrt(
        Math.pow(point[0] - pos[0], 2) + 
        Math.pow(point[1] - pos[1], 2)
      );
      if (dist < minDist) {
        minDist = dist;
        nearestIndex = index;
      }
    });

    return nearestIndex;
  };

  async function saveRoute(): Promise<void> {
    try {
      const response = await fetch("/api/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points, trafficLights, congestionZones }),
      });
      if (response.ok) alert("✅ Route, Traffic Lights & Congestion Zones Saved!");
    } catch (error) {
      console.error("Save failed", error);
    }
  }

  const addPoint = (point: Point): void => {
    setPoints((prev) => [...prev, point]);
  };

  const addTrafficLight = (point: Point): void => {
    const newLight: TrafficLight = {
      id: `light-${Date.now()}`,
      position: point,
      isGreen: true,
      nearestPointIndex: findNearestPointIndex(point)
    };
    setTrafficLights((prev) => [...prev, newLight]);
  };

  const addCongestion = (point: Point): void => {
    const zoneNumber = congestionZones.length + 1;
    const newZone: CongestionZone = {
      id: `congestion-${Date.now()}`,
      center: point,
      radius: 100, // BIGGER - 100 meters
      name: `Tornado Zone ${zoneNumber}`
    };
    setCongestionZones((prev) => [...prev, newZone]);
  };

  const toggleTrafficLight = async (lightId: string): Promise<void> => {
    const updatedLights = trafficLights.map(light =>
      light.id === lightId ? { ...light, isGreen: !light.isGreen } : light
    );
    
    setTrafficLights(updatedLights);

    const light = updatedLights.find(l => l.id === lightId);
    if (light) {
      try {
        await fetch("/api/route", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            type: 'traffic-light',
            lightId: light.id, 
            isGreen: light.isGreen 
          }),
        });
      } catch (error) {
        console.error("Toggle failed", error);
      }
    }
  };

  const deleteLight = (lightId: string): void => {
    setTrafficLights(prev => prev.filter(light => light.id !== lightId));
  };

  const deleteCongestion = (zoneId: string): void => {
    setCongestionZones(prev => prev.filter(zone => zone.id !== zoneId));
  };

  const clearAll = (): void => {
    setPoints([]);
    setTrafficLights([]);
    setCongestionZones([]);
  };

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <h2 className="text-3xl font-bold mb-4 text-gray-800">
        🚑 Kozhikode Traffic Management System
      </h2>

      <div className="flex gap-3 mb-4 flex-wrap">
        <button
          onClick={() => setMode('route')}
          className={`px-5 py-2.5 rounded-lg font-semibold transition-all ${
            mode === 'route'
              ? 'bg-blue-600 text-white shadow-lg scale-105'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          📍 Add Route Points
        </button>

        <button
          onClick={() => setMode('traffic')}
          className={`px-5 py-2.5 rounded-lg font-semibold transition-all ${
            mode === 'traffic'
              ? 'bg-amber-600 text-white shadow-lg scale-105'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          🚦 Add Traffic Light
        </button>

        <button
          onClick={() => setMode('congestion')}
          className={`px-5 py-2.5 rounded-lg font-semibold transition-all ${
            mode === 'congestion'
              ? 'bg-purple-600 text-white shadow-lg scale-105'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          🌀 Add Tornado Zone
        </button>

        <button
          onClick={saveRoute}
          className="bg-green-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-green-700 transition-all shadow-md ml-auto"
        >
          💾 Save Route
        </button>

        <button
          onClick={clearAll}
          className="bg-gray-700 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-gray-800 transition-all"
        >
          🗑️ Clear All
        </button>
      </div>

      <div className="bg-white p-4 rounded-lg shadow mb-4">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="font-semibold">Route Points:</span> {points.length}
          </div>
          <div>
            <span className="font-semibold">Traffic Lights:</span> {trafficLights.length}
          </div>
          <div>
            <span className="font-semibold">Tornado Zones:</span> {congestionZones.length}
          </div>
        </div>
      </div>

      {trafficLights.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow mb-4">
          <h3 className="font-bold text-lg mb-3">🚦 Traffic Light Controls (Click to Toggle)</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {trafficLights.map((light, index) => (
              <div key={light.id} className="flex gap-2">
                <button
                  onClick={() => toggleTrafficLight(light.id)}
                  className={`flex-1 p-3 rounded-lg font-medium transition-all ${
                    light.isGreen
                      ? 'bg-green-100 text-green-800 border-2 border-green-400 hover:bg-green-200'
                      : 'bg-red-100 text-red-800 border-2 border-red-400 hover:bg-red-200'
                  }`}
                >
                  <span className="text-xl mr-2">
                    {light.isGreen ? '🟢' : '🔴'}
                  </span>
                  Light #{index + 1}
                </button>
                <button
                  onClick={() => deleteLight(light.id)}
                  className="bg-red-600 text-white px-3 rounded-lg hover:bg-red-700"
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {congestionZones.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow mb-4">
          <h3 className="font-bold text-lg mb-3">🌀 Tornado Zones (Ambulance spins for 10 sec)</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {congestionZones.map((zone) => (
              <div key={zone.id} className="bg-purple-50 border-2 border-purple-400 rounded-lg p-3 flex justify-between items-center">
                <div>
                  <div className="font-semibold text-purple-800">{zone.name}</div>
                  <div className="text-xs text-purple-600">{zone.radius}m radius</div>
                </div>
                <button
                  onClick={() => deleteCongestion(zone.id)}
                  className="bg-red-600 text-white px-2 py-1 rounded text-sm hover:bg-red-700"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-4 border-gray-300 rounded-xl overflow-hidden shadow-2xl">
        <MapContainer
          center={[11.2588, 75.7804] as [number, number]}
          zoom={15}
          style={{ height: "650px", width: "100%" }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {points.map((p, i) => (
            <Marker key={`point-${i}`} position={p}>
              <Popup>Point {i + 1}</Popup>
            </Marker>
          ))}

          {points.length > 1 && (
            <Polyline positions={points} color="#3b82f6" weight={5} opacity={0.7} />
          )}

          {trafficLights.map((light, index) => (
            <Marker
              key={light.id}
              position={light.position}
              icon={light.isGreen ? GreenLightIcon : RedLightIcon}
              eventHandlers={{
                click: () => toggleTrafficLight(light.id)
              }}
            >
              <Popup>
                <div className="text-center">
                  <div className="font-semibold">Light #{index + 1}</div>
                  <div className={light.isGreen ? "text-green-600" : "text-red-600"}>
                    {light.isGreen ? "🟢 GREEN" : "🔴 RED"}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {congestionZones.map((zone) => (
            <Circle
              key={zone.id}
              center={zone.center}
              radius={zone.radius}
              pathOptions={{
                color: '#a855f7',
                fillColor: '#a855f7',
                fillOpacity: 0.25,
                weight: 4,
                dashArray: '10, 10'
              }}
            >
              <Popup>
                <div className="text-center">
                  <div className="font-semibold text-purple-800">{zone.name}</div>
                  <div className="text-sm text-purple-600">🌀 Spins for 10 seconds</div>
                </div>
              </Popup>
            </Circle>
          ))}

          <ClickHandler 
            addPoint={addPoint} 
            addTrafficLight={addTrafficLight}
            addCongestion={addCongestion}
            mode={mode}
          />
        </MapContainer>
      </div>

      <div className="mt-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
        <p className="text-sm text-gray-800">
          <strong>📋 How to Use:</strong>
        </p>
        <ul className="text-sm text-gray-700 mt-2 space-y-1 list-disc list-inside">
          <li><strong>Route Mode:</strong> Click map to add route waypoints</li>
          <li><strong>Traffic Light Mode:</strong> Click map to add lights - ambulance STOPS at red, goes at green</li>
          <li><strong>Tornado Zone:</strong> Click map to add zone - ambulance spins inside for 10 seconds</li>
          <li><strong>Toggle Lights:</strong> Click buttons to change red/green instantly</li>
        </ul>
      </div>
    </div>
  );
}