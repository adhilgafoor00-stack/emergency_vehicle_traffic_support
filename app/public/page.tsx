"use client";

import dynamic from "next/dynamic";

const LeafletMap = dynamic(
  () => import("../../Components/PublicMap"),
  { ssr: false }
);

export default function PublicMap() {
  return <LeafletMap />;
}
