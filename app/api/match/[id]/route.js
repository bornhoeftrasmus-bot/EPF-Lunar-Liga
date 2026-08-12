import { NextResponse } from "next/server";
import { getTeamMatchDetails } from "@/lib/rankedin";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const data = await getTeamMatchDetails(id);
    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Kampdetaljer kunne ikke hentes." },
      { status: 500 }
    );
  }
}
