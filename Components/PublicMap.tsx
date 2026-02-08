"use client";
import { MapContainer, TileLayer, Marker, Polyline, Circle } from "react-leaflet";
import { useEffect, useState, useRef } from "react";
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

interface RotatedMarkerProps extends React.ComponentProps<typeof Marker> {
  rotationAngle?: number;
}

const RotatedMarker = Marker as React.FC<RotatedMarkerProps>;

const ambulanceIcon = new L.Icon({
  iconUrl: "/images/ambulance.png",
  iconSize: [80, 65],
  iconAnchor: [40, 32],
});

const GreenLightIcon = L.divIcon({
  className: 'custom-traffic-light',
  html: `<div style="width: 36px; height: 36px; background: #22c55e; border: 4px solid white; border-radius: 50%; box-shadow: 0 0 20px rgba(34, 197, 94, 1);"></div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const RedLightIcon = L.divIcon({
  className: 'custom-traffic-light',
  html: `<div style="width: 36px; height: 36px; background: #ef4444; border: 4px solid white; border-radius: 50%; box-shadow: 0 0 20px rgba(239, 68, 68, 1); animation: blink 1s infinite;"></div>
  <style>
    @keyframes blink {
      0%, 50%, 100% { opacity: 1; }
      25%, 75% { opacity: 0.4; }
    }
  </style>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const easeInOutCubic = (t: number): number => {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

const smoothAngle = (current: number, target: number, factor: number): number => {
  let diff = target - current;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return current + diff * factor;
};

const calculateDistance = (p1: Point, p2: Point): number => {
  const R = 6371000; // meters
  const dLat = (p2[0] - p1[0]) * Math.PI / 180;
  const dLon = (p2[1] - p1[1]) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export default function SmoothRoutePlayer() {
  const [points, setPoints] = useState<Point[]>([]);
  const [trafficLights, setTrafficLights] = useState<TrafficLight[]>([]);
  const [congestionZones, setCongestionZones] = useState<CongestionZone[]>([]);
  const [currentPos, setCurrentPos] = useState<Point | null>(null);
  const [rotation, setRotation] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  const [statusMessage, setStatusMessage] = useState("🟢 Normal Speed");
  const [isWaiting, setIsWaiting] = useState(false);
  const [isTornado, setIsTornado] = useState(false);
  const [countdown, setCountdown] = useState(0);
  
  const indexRef = useRef(0);
  const currentRotationRef = useRef(0);
  const targetRotationRef = useRef(0);
  const previousValidPositionRef = useRef<Point | null>(null);
  const previousValidIndexRef = useRef(0);
  const stoppedAtLightRef = useRef<string | null>(null);
  const tornadoStateRef = useRef<'entry' | 'spinning' | null>(null);
  const tornadoStartTimeRef = useRef(0);
  const lightCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fix 1: Separate leaflet-rotatedmarker import into its own effect
  useEffect(() => {
    if (typeof window !== 'undefined') {
      import("leaflet-rotatedmarker").catch(() => {
        console.warn("leaflet-rotatedmarker not available");
      });
    }
  }, []);

  // Fix 2: Configure Leaflet icons properly
  useEffect(() => {
    if (typeof window !== 'undefined') {
      delete (L.Icon.Default.prototype as any)._getIconUrl;

      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "/leaflet/marker-icon-2x.png",
        iconUrl: "/leaflet/marker-icon.png",
        shadowUrl: "/leaflet/marker-shadow.png",
      });
    }
  }, []);

  // Fix 3: Main data fetching effect with proper dependency
  useEffect(() => {
    setIsMounted(true);
    
    const fetchData = () => {
      fetch("/api/route")
        .then(res => res.json())
        .then(data => {
          if (data?.points?.length) {
            setPoints(data.points);
            
            if (!currentPos) {
              setCurrentPos(data.points[0]);
              previousValidPositionRef.current = data.points[0];
            }
            
            setTrafficLights(data.trafficLights || []);
            setCongestionZones(data.congestionZones || []);
            
            if (data.points.length >= 2 && rotation === 0) {
              const [start, end] = data.points;
              const dy = end[0] - start[0];
              const dx = end[1] - start[1];
              const initialAngle = Math.atan2(dx, dy) * (180 / Math.PI);
              setRotation(initialAngle);
              currentRotationRef.current = initialAngle;
              targetRotationRef.current = initialAngle;
            }
          }
        })
        .catch(err => console.error("Fetch error:", err));
    };

    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => {
      clearInterval(interval);
      if (lightCheckIntervalRef.current) {
        clearInterval(lightCheckIntervalRef.current);
      }
    };
  }, []); // Fix: Remove currentPos and rotation from dependencies to avoid infinite loop

  // Fix 4: Animation effect with proper dependencies
  useEffect(() => {
    if (points.length < 2) return;

    const NORMAL_SPEED = 2000;
    const DETECTION_DISTANCE = 60; // 60 meters detection range

    let startTime = 0;
    let lastFrameTime = 0;
    let animationFrame: number;
    const fps = 60;
    const frameInterval = 1000 / fps;

    const animate = (timestamp: number) => {
      // TORNADO SPIN MODE - Two phases: Entry (5s) + Spinning (10s)
      if (isTornado) {
        const timeSinceLastFrame = timestamp - lastFrameTime || 0;
        if (timeSinceLastFrame < frameInterval) {
          animationFrame = requestAnimationFrame(animate);
          return;
        }
        lastFrameTime = timestamp;

        const elapsed = (timestamp - tornadoStartTimeRef.current) / 1000; // seconds

        // Find the zone we're in
        const currentZone = congestionZones.find(zone => {
          if (!currentPos) return false;
          const dist = calculateDistance(currentPos, zone.center);
          return dist <= zone.radius;
        });

        if (currentZone) {
          const center = currentZone.center;
          const zoneRadius = currentZone.radius;

          // PHASE 1: Entry circle (0-5 seconds) - Move TO the center
          if (elapsed < 5) {
            tornadoStateRef.current = 'entry';
            const entryProgress = elapsed / 5;
            const circleRadius = (zoneRadius * 0.6 / 111000); // 60% of zone radius in degrees
            const angle = entryProgress * Math.PI * 4; // 2 full circles
            
            const lat = center[0] + circleRadius * Math.cos(angle);
            const lng = center[1] + circleRadius * Math.sin(angle);
            setCurrentPos([lat, lng]);

            // Rotation follows the circle
            const rotationAngle = (angle * 180 / Math.PI) + 90;
            currentRotationRef.current = rotationAngle;
            setRotation(rotationAngle);

            setCountdown(Math.ceil(15 - elapsed));
          }
          // PHASE 2: Tornado spin (5-15 seconds) - Fast spinning at center
          else if (elapsed < 15) {
            tornadoStateRef.current = 'spinning';
            const spinProgress = (elapsed - 5) / 10;
            const tightRadius = (zoneRadius * 0.2 / 111000); // Very tight circle
            const spinSpeed = 6; // Fast rotation
            const angle = spinProgress * spinSpeed * Math.PI * 10;
            
            const lat = center[0] + tightRadius * Math.cos(angle);
            const lng = center[1] + tightRadius * Math.sin(angle);
            setCurrentPos([lat, lng]);

            // Super fast rotation
            const rotationAngle = (angle * 180 / Math.PI) * 2;
            currentRotationRef.current = rotationAngle % 360;
            setRotation(currentRotationRef.current);

            setCountdown(Math.ceil(15 - elapsed));
          }
          // PHASE 3: Exit (15+ seconds)
          else {
            setIsTornado(false);
            tornadoStateRef.current = null;
            setStatusMessage("🟢 Exiting Tornado Zone");
            setCountdown(0);
          }

          animationFrame = requestAnimationFrame(animate);
          return;
        }
      }

      // WAITING AT RED LIGHT
      if (isWaiting) {
        animationFrame = requestAnimationFrame(animate);
        return;
      }

      if (!startTime) {
        startTime = timestamp;
        lastFrameTime = timestamp;
        
        const start = points[indexRef.current];
        const end = points[indexRef.current + 1];
        
        if (start && end) {
          // Save valid position before checking obstacles
          previousValidPositionRef.current = start;
          previousValidIndexRef.current = indexRef.current;

          // Check for tornado zones ENTRY
          let enteringTornadoZone = false;
          congestionZones.forEach((zone) => {
            const distToZoneStart = calculateDistance(start, zone.center);
            const distToZoneEnd = calculateDistance(end, zone.center);
            
            // Check if we're entering the zone
            if (distToZoneStart > zone.radius && distToZoneEnd <= zone.radius) {
              enteringTornadoZone = true;
              setIsTornado(true);
              tornadoStateRef.current = 'entry';
              tornadoStartTimeRef.current = timestamp;
              setStatusMessage(`🌀 ${zone.name} - Entering Tornado!`);
              setCountdown(15);
            }
          });

          if (enteringTornadoZone) {
            animationFrame = requestAnimationFrame(animate);
            return;
          }

          // Check for RED traffic lights BEFORE moving
          let violatedRedLight = false;
          trafficLights.forEach((light, index) => {
            const distToLight = calculateDistance(start, light.position);
            
            // If we're approaching a red light
            if (distToLight < DETECTION_DISTANCE) {
              if (!light.isGreen && stoppedAtLightRef.current !== light.id) {
                // STOP - we haven't passed yet
                violatedRedLight = true;
                stoppedAtLightRef.current = light.id;
                setIsWaiting(true);
                setStatusMessage(`🔴 Stopped at Light #${index + 1} - Waiting for Green`);
                
                // Return to previous valid position
                if (previousValidPositionRef.current) {
                  setCurrentPos(previousValidPositionRef.current);
                  indexRef.current = previousValidIndexRef.current;
                }
                
                // Poll for green light
                if (lightCheckIntervalRef.current) {
                  clearInterval(lightCheckIntervalRef.current);
                }
                
                lightCheckIntervalRef.current = setInterval(() => {
                  fetch("/api/route")
                    .then(res => res.json())
                    .then(data => {
                      const lights = data.trafficLights || [];
                      const currentLight = lights.find((l: any) => l.id === light.id);
                      
                      if (currentLight && currentLight.isGreen) {
                        if (lightCheckIntervalRef.current) {
                          clearInterval(lightCheckIntervalRef.current);
                          lightCheckIntervalRef.current = null;
                        }
                        setIsWaiting(false);
                        stoppedAtLightRef.current = null;
                        setStatusMessage("🟢 Light Turned Green - Moving!");
                        startTime = 0;
                      }
                    })
                    .catch(err => console.error("Light check error:", err));
                }, 1000);
              } else if (light.isGreen && stoppedAtLightRef.current === light.id) {
                // Light turned green, clear the stopped state
                stoppedAtLightRef.current = null;
              }
            }
          });

          if (violatedRedLight) {
            animationFrame = requestAnimationFrame(animate);
            return;
          }

          // Normal movement - no obstacles
          setStatusMessage("🟢 Normal Speed");
        }
      }

      const timeSinceLastFrame = timestamp - lastFrameTime;
      if (timeSinceLastFrame < frameInterval) {
        animationFrame = requestAnimationFrame(animate);
        return;
      }
      lastFrameTime = timestamp;

      const start = points[indexRef.current];
      const end = points[indexRef.current + 1];

      if (!start || !end) {
        animationFrame = requestAnimationFrame(animate);
        return;
      }

      const elapsed = timestamp - startTime;
      const rawProgress = Math.min(elapsed / NORMAL_SPEED, 1);
      const progress = easeInOutCubic(rawProgress);

      const lat = start[0] + (end[0] - start[0]) * progress;
      const lng = start[1] + (end[1] - start[1]) * progress;
      setCurrentPos([lat, lng]);

      const dy = end[0] - start[0];
      const dx = end[1] - start[1];
      const targetAngle = Math.atan2(dx, dy) * (180 / Math.PI);
      targetRotationRef.current = targetAngle;

      currentRotationRef.current = smoothAngle(
        currentRotationRef.current,
        targetRotationRef.current,
        0.15
      );
      
      setRotation(currentRotationRef.current);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else if (indexRef.current < points.length - 2) {
        indexRef.current++;
        startTime = 0;
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(animationFrame);
      if (lightCheckIntervalRef.current) {
        clearInterval(lightCheckIntervalRef.current);
      }
    };
  }, [points, trafficLights, congestionZones, isWaiting, isTornado, currentPos]);

  if (!isMounted || !currentPos) return null;

  return (
    <div className="p-4">
      <div className="rounded-xl overflow-hidden shadow-2xl border border-gray-200">
        <MapContainer
          center={points[0] || [11.2588, 75.7804]}
          zoom={16}
          style={{ height: "650px" }}
          zoomControl={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap'
          />
          
          <Polyline
            positions={points}
            color="#93c5fd"
            weight={6}
            opacity={0.5}
          />
          
          {indexRef.current > 0 && (
            <Polyline
              positions={points.slice(0, indexRef.current + 1)}
              color="#1e40af"
              weight={6}
              opacity={0.9}
            />
          )}

          {/* Tornado Zones */}
          {congestionZones.map((zone) => (
            <Circle
              key={zone.id}
              center={zone.center}
              radius={zone.radius}
              pathOptions={{
                color: '#a855f7',
                fillColor: '#a855f7',
                fillOpacity: 0.3,
                weight: 5,
                dashArray: '15, 10'
              }}
            />
          ))}

          {/* Traffic Lights */}
          {trafficLights.map((light) => (
            <Marker
              key={light.id}
              position={light.position}
              icon={light.isGreen ? GreenLightIcon : RedLightIcon}
              zIndexOffset={500}
            />
          ))}
          
          <RotatedMarker
            position={currentPos}
            icon={ambulanceIcon}
            rotationAngle={rotation}
            zIndexOffset={1000}
          />
        </MapContainer>
      </div>
      
      {/* Status Dashboard */}
      <div className="mt-4 bg-white p-5 rounded-lg shadow-lg">
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">Progress</div>
            <div className="text-2xl font-bold text-blue-600">
              {Math.round((indexRef.current / Math.max(points.length - 1, 1)) * 100)}%
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">Status</div>
            <div className={`text-xl font-bold ${
              isTornado && tornadoStateRef.current === 'spinning' ? 'text-purple-600 animate-spin' :
              isTornado ? 'text-purple-600' :
              isWaiting ? 'text-red-600 animate-pulse' :
              'text-green-600'
            }`}>
              {isTornado 
                ? (tornadoStateRef.current === 'entry' ? '🌀 ENTER' : '🌪️ SPIN') 
                : isWaiting ? '⏸️ STOP' : '✓ GO'}
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">Red Lights</div>
            <div className="text-2xl font-bold text-red-600">
              {trafficLights.filter(l => !l.isGreen).length} 🔴
            </div>
          </div>

          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">Tornado Zones</div>
            <div className="text-2xl font-bold text-purple-600">
              {congestionZones.length} 🌀
            </div>
          </div>
        </div>

        <div className="bg-gray-200 rounded-full h-4 overflow-hidden mb-3">
          <div
            className="bg-gradient-to-r from-blue-500 to-blue-600 h-4 rounded-full transition-all duration-500"
            style={{ width: `${(indexRef.current / Math.max(points.length - 1, 1)) * 100}%` }}
          />
        </div>
        
        <div className={`text-center p-4 rounded-lg font-bold text-lg transition-all ${
          isTornado
            ? 'bg-purple-100 border-2 border-purple-500 text-purple-800' :
          isWaiting
            ? 'bg-red-100 border-2 border-red-500 text-red-800'
            : 'bg-green-100 border-2 border-green-500 text-green-800'
        }`}>
          {statusMessage}
          {isTornado && countdown > 0 && (
            <div className="mt-2">
              <div className="text-3xl animate-pulse">{countdown}s</div>
              <div className="text-sm mt-1">
                {tornadoStateRef.current === 'entry' ? '(Entry Circle)' : '(Tornado Spin)'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}