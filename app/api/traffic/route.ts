import { NextResponse } from "next/server";

// In-memory storage for blocked coordinates (Resets on server restart)
let blockedPoints: { lat: number; lng: number; id: string }[] = [];

export async function GET() {
  return NextResponse.json({ blocks: blockedPoints });
}

export async function POST(req: Request) {
  const body = await req.json();
  
  if (body.action === 'BLOCK') {
    const newBlock = { lat: body.lat, lng: body.lng, id: Date.now().toString() };
    blockedPoints.push(newBlock);
  } 
  else if (body.action === 'CLEAR') {
    blockedPoints = []; // Clear all blocks
  }

  return NextResponse.json({ success: true, blocks: blockedPoints });
}