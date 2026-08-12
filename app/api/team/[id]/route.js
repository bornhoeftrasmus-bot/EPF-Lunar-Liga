import { NextResponse } from "next/server";
import { getPublicTeamInfo } from "@/lib/rankedin";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const data = await getPublicTeamInfo(id);
    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Holdoplysninger kunne ikke hentes." },
      { status: 500 }
    );
  }
}
