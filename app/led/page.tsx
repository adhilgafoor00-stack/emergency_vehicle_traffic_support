"use client";

import { useState } from "react";

export default function Home() {
  const [led, setLed] = useState(false);

  const toggleLed = async () => {
    const res = await fetch("/api/led", {
      method: "POST",
    });

    const data = await res.json();
    setLed(data.led);
  };

  return (
    <div style={{ padding: "40px" }}>
      <button
        onClick={toggleLed}
        style={{
          padding: "15px 30px",
          fontSize: "18px",
          borderRadius: "10px",
          border: "none",
          cursor: "pointer",
          backgroundColor: led ? "#22c55e" : "#ef4444",
          color: "white",
          transition: "0.3s",
        }}
      >
        {led ? "LED ON" : "LED OFF"}
      </button>
    </div>
  );
}
