"use client";

import { useState } from "react";

export default function ControlPage() {
  const [lat, setLat] = useState("11.2588");
  const [lng, setLng] = useState("75.7804");

  async function sendLocation() {
    await fetch("/api/location", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ lat, lng })
    });

    alert("Location Updated!");
  }

  function moveNorth() {
    setLat((Number(lat) + 0.0005).toString());
  }

  function moveSouth() {
    setLat((Number(lat) - 0.0005).toString());
  }

  function moveEast() {
    setLng((Number(lng) + 0.0005).toString());
  }

  function moveWest() {
    setLng((Number(lng) - 0.0005).toString());
  }

  return (
    <div className="p-8 max-w-md mx-auto bg-white shadow rounded">

      <h1 className="text-xl font-bold mb-4">
        Traffic Device Control
      </h1>

      <input
        className="border p-2 w-full mb-3"
        value={lat}
        onChange={(e) => setLat(e.target.value)}
        placeholder="Latitude"
      />

      <input
        className="border p-2 w-full mb-4"
        value={lng}
        onChange={(e) => setLng(e.target.value)}
        placeholder="Longitude"
      />

      <div className="grid grid-cols-3 gap-2 mb-4">
        <button onClick={moveNorth} className="bg-blue-500 text-white p-2">↑</button>
        <div></div>
        <button onClick={moveSouth} className="bg-blue-500 text-white p-2">↓</button>

        <button onClick={moveWest} className="bg-blue-500 text-white p-2">←</button>
        <button onClick={sendLocation} className="bg-green-500 text-white p-2">SEND</button>
        <button onClick={moveEast} className="bg-blue-500 text-white p-2">→</button>
      </div>

    </div>
  );
}
