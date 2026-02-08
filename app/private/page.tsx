"use client";
import dynamic from "next/dynamic";

// Disable SSR for Leaflet
const AmbulanceDashboard = dynamic(() => import("@/Components/AmbulanceCockpit"), {
  ssr: false,
  loading: () => <p>Loading Map...</p>
});

export default function Page() {
  return <AmbulanceDashboard />;
}