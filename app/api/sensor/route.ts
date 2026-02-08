import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    console.log("📡 Sensor Data Received:", body);

    return NextResponse.json({
      status: "success",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { status: "error" },
      { status: 500 }
    );
  }
}

