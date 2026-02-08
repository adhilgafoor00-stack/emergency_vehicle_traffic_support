"use client";
import { MapContainer, TileLayer, Marker, Polyline, Circle } from "react-leaflet";
import "leaflet-rotatedmarker";
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
  const stoppedAtLightRef = useRef<string | null>(null);
  const tornadoStartPosRef = useRef<Point | null>(null);

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
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (points.length < 2) return;

    const NORMAL_SPEED = 2000;
    const DETECTION_DISTANCE = 50; // meters

    let startTime: number;
    let lastFrameTime: number;
    let animationFrame: number;
    const fps = 60;
    const frameInterval = 1000 / fps;

    const animate = (timestamp: number) => {
      // TORNADO SPIN MODE
      if (isTornado && tornadoStartPosRef.current) {
        const timeSinceLastFrame = timestamp - lastFrameTime;
        if (timeSinceLastFrame < frameInterval) {
          animationFrame = requestAnimationFrame(animate);
          return;
        }
        lastFrameTime = timestamp;

        // Spin in circle
        const spinSpeed = 3; // rotations per second
        const angle = (timestamp / 1000) * spinSpeed * 360;
        currentRotationRef.current = angle;
        setRotation(angle);

        // Move in small circle (tornado effect)
        const center = tornadoStartPosRef.current;
        const radius = 0.0002; // small circle in degrees
        const circleAngle = (timestamp / 1000) * spinSpeed * 2 * Math.PI;
        
        const lat = center[0] + radius * Math.cos(circleAngle);
        const lng = center[1] + radius * Math.sin(circleAngle);
        setCurrentPos([lat, lng]);

        animationFrame = requestAnimationFrame(animate);
        return;
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
          // Check for tornado zones
          let inTornadoZone = false;
          congestionZones.forEach((zone) => {
            const distToZone = calculateDistance(start, zone.center);
            if (distToZone <= zone.radius) {
              inTornadoZone = true;
              setIsTornado(true);
              tornadoStartPosRef.current = zone.center;
              setStatusMessage(`🌀 ${zone.name} - Tornado Spin!`);
              setCountdown(10);
              
              // Countdown timer
              const countInterval = setInterval(() => {
                setCountdown(prev => {
                  if (prev <= 1) {
                    clearInterval(countInterval);
                    setIsTornado(false);
                    tornadoStartPosRef.current = null;
                    setStatusMessage("🟢 Exiting Tornado Zone");
                    return 0;
                  }
                  return prev - 1;
                });
              }, 1000);
              
              // Resume after 10 seconds
              setTimeout(() => {
                setIsTornado(false);
                tornadoStartPosRef.current = null;
              }, 10000);
            }
          });

          if (inTornadoZone) {
            animationFrame = requestAnimationFrame(animate);
            return;
          }

          // Check for RED traffic lights
          let blockedByRedLight = false;
          trafficLights.forEach((light, index) => {
            if (!light.isGreen && stoppedAtLightRef.current !== light.id) {
              const distToLight = calculateDistance(start, light.position);
              
              if (distToLight < DETECTION_DISTANCE) {
                blockedByRedLight = true;
                stoppedAtLightRef.current = light.id;
                setIsWaiting(true);
                setStatusMessage(`🔴 Stopped at Light #${index + 1} - Waiting for Green`);
                
                // Check every second if light turned green
                const checkInterval = setInterval(() => {
                  fetch("/api/route")
                    .then(res => res.json())
                    .then(data => {
                      const lights = data.trafficLights || [];
                      const currentLight = lights.find((l: any) => l.id === light.id);
                      
                      if (currentLight && currentLight.isGreen) {
                        clearInterval(checkInterval);
                        setIsWaiting(false);
                        stoppedAtLightRef.current = null;
                        setStatusMessage("🟢 Light Turned Green - Moving!");
                        
                        // Go back one segment to restart movement
                        if (indexRef.current > 0) {
                          indexRef.current--;
                        }
                        startTime = 0;
                      }
                    });
                }, 1000);
              }
            }
          });

          if (blockedByRedLight) {
            animationFrame = requestAnimationFrame(animate);
            return;
          }

          // Normal movement
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
    return () => cancelAnimationFrame(animationFrame);
  }, [points, trafficLights, congestionZones, isWaiting, isTornado]);

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
              isTornado ? 'text-purple-600 animate-spin' : 
              isWaiting ? 'text-red-600 animate-pulse' : 
              'text-green-600'
            }`}>
              {isTornado ? '🌀 SPIN' : isWaiting ? '⏸️ STOP' : '✓ GO'}
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
            <div className="text-3xl mt-2 animate-pulse">{countdown}s</div>
          )}
        </div>
      </div>
    </div>
  );
}