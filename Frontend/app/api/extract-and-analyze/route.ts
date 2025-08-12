import { NextResponse } from "next/server";

export async function POST(req: Request) {
  console.log("🔍 DEBUG: /api/extract-and-analyze called");

  try {
    const { fileUrl, fileType, moduleId } = await req.json();
    console.log("🔍 DEBUG: Received parameters:");
    console.log("🔍 DEBUG: fileUrl:", fileUrl);
    console.log("🔍 DEBUG: fileType:", fileType);
    console.log("🔍 DEBUG: moduleId:", moduleId);

    const extractedText = `Mock extracted text for ${fileType} file at ${fileUrl}`;
    return NextResponse.json({ extractedText });
  } catch (err) {
    console.error("🔍 DEBUG: API error:", err);
    return NextResponse.json({ error: "Extraction failed", detail: err }, { status: 500 });
  }
}
