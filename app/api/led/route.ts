import { log } from "console";
import { NextResponse } from "next/server";

let ledState = false;

// Toggle LED
export async function POST() {
  ledState = !ledState;

  return NextResponse.json({
    led: ledState,
  });
}

// ESP32 checks LED status
export async function GET() {
    console.log("LED Status Requested:", ledState);
  return NextResponse.json({
    led: ledState,
  });
}
