"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

// 1. Dynamically import the AmbulancePlayer component
// Make sure you saved the previous AmbulancePlayer code in 'components/AmbulancePlayer.tsx'
const AmbulancePlayer = dynamic(() => import("@/Components/AmbulancePlayer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center bg-slate-100 text-slate-500">
      <div className="text-center">
        <div className="animate-pulse text-5xl mb-4">🚑</div>
        <p className="font-bold">Initializing Emergency Systems...</p>
      </div>
    </div>
  ),
});

export default function HomePage() {
  return (
    <main className="h-screen w-full relative overflow-hidden">
      {/* The Simulation Component */}
      <AmbulancePlayer />

      {/* Admin Link (Floating Button) */}
      <div className="absolute bottom-6 right-6 z-[1000]">
        <Link 
          href="/admin" 
          className="flex items-center gap-2 px-4 py-3 bg-white text-gray-800 rounded-full shadow-xl border border-gray-200 hover:bg-gray-50 transition-transform hover:scale-105 font-bold text-sm"
        >
          <span>⚙️</span>
          <span>Open Map Builder</span>
        </Link>
      </div>
    </main>
  );
}