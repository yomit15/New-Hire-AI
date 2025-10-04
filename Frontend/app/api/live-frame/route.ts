import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { sessionId, employeeId, timestamp, frame } = await req.json();

    // Validate inputs
    if (!sessionId || !timestamp || !frame) {
      return NextResponse.json(
        { error: "Missing required fields: sessionId, timestamp, or frame" },
        { status: 400 }
      );
    }

    // Log frame info (for debugging)
    const frameSize = Math.round((frame.length * 3) / 4 / 1024); // Approximate size in KB
    console.log(`📸 Received frame: ${frameSize}KB at ${timestamp} for session ${sessionId}`);

    // TODO: Forward frame to GCE worker with Gemini API integration
    // For now, return mock feedback
    const mockFeedback = generateMockFeedback();

    // TODO: Store in Supabase (frame metadata + feedback)
    // await supabase.from('roleplay_frames').insert({
    //   session_id: sessionId,
    //   employee_id: employeeId,
    //   timestamp,
    //   feedback: mockFeedback,
    //   frame_size_kb: frameSize
    // });

    return NextResponse.json({
      success: true,
      feedback: mockFeedback,
      timestamp,
      sessionId,
    });
  } catch (error) {
    console.error("❌ Error processing frame:", error);
    return NextResponse.json(
      { error: "Internal server error processing frame" },
      { status: 500 }
    );
  }
}

// Mock feedback generator (replace with actual Gemini API call)
function generateMockFeedback(): string {
  const feedbacks = [
    "User appears engaged and attentive",
    "Neutral expression detected",
    "Slight smile - positive engagement",
    "User looks thoughtful",
    "Looking away - possible distraction",
    "Confident posture and eye contact",
    "User seems uncertain or confused",
    "Nodding - showing agreement",
    "Focused and concentrating",
    "Relaxed and comfortable"
  ];
  
  return feedbacks[Math.floor(Math.random() * feedbacks.length)];
}
