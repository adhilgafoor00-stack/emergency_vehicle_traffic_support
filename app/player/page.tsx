"use client";

import { MapContainer, TileLayer, Marker, Polyline } from "react-leaflet";
import "leaflet-rotatedmarker";
import { useEffect, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// 1. Define the Point type
type Point = [number, number];

// 2. Fix the Marker type to include rotationAngle
// This interface allows the Marker to accept the extra prop added by the plugin
interface RotatedMarkerProps extends React.ComponentProps<typeof Marker> {
  rotationAngle?: number;
  rotationOrigin?: string;
}

const RotatedMarker = Marker as React.FC<RotatedMarkerProps>;

const ambulanceIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/2967/2967350.png",
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

function getAngle(p1: Point | undefined, p2: Point | undefined): number {
  if (!p1 || !p2) return 0;
  // Leaflet uses [lat, lng], but math for rotation usually expects [y, x]
  const dy = p2[0] - p1[0];
  const dx = p2[1] - p1[1];
  return Math.atan2(dx, dy) * (180 / Math.PI); 
}

export default function RoutePlayer() {
  // 3. Type the state correctly to avoid 'never'
  const [points, setPoints] = useState<Point[]>([]);
  const [index, setIndex] = useState<number>(0);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    fetchRoute();
  }, []);

  async function fetchRoute() {
    try {
      const res = await fetch("/api/route");
      const data = await res.json();
      if (data?.points) {
        setPoints(data.points as Point[]);
      }
    } catch (err) {
      console.error("Failed to fetch route", err);
    }
  }

  useEffect(() => {
    if (points.length === 0) return;

    const interval = setInterval(() => {
      setIndex((prev) => {
        if (prev < points.length - 1) return prev + 1;
        return prev;
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [points]);

  if (!isMounted) return null;

  const current = points[index];
  const next = points[index + 1];
  const rotation = getAngle(current, next);

  return (
    <div className="p-4">
      <h2 className="font-bold mb-2">Emergency Vehicle Simulation 🚑</h2>

      <div className="border rounded-lg overflow-hidden shadow-sm">
        <MapContainer
          center={current || [11.2588, 75.7804]}
          zoom={15}
          style={{ height: "500px" }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {points.length > 1 && (
            <Polyline positions={points} color="red" weight={3} />
          )}

          {current && (
            <RotatedMarker
              position={current}
              icon={ambulanceIcon}
              rotationAngle={rotation}
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
}