/**
 * GCE Worker: Live Frame Analysis
 * Receives webcam frames and sends them to Gemini Live API for real-time analysis
 */

const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Initialize clients
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

/**
 * Process a frame from the frontend
 * @param {Object} frameData - { sessionId, employeeId, timestamp, frame }
 * @returns {Object} - { success, feedback, timestamp }
 */
async function processFrame(frameData) {
  const { sessionId, employeeId, timestamp, frame } = frameData;

  try {
    console.log(`📸 Processing frame for session ${sessionId} at ${timestamp}`);

    // Remove base64 prefix if present
    const base64Data = frame.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Send to Gemini Vision API for analysis
    // Using gemini-pro-vision (stable model that supports image analysis)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    const prompt = `Analyze this person's facial expression and body language for a role-play training scenario. Provide a brief assessment of:
    - Engagement level (engaged, neutral, distracted)
    - Emotional state (confident, uncertain, nervous, calm)
    - Non-verbal cues (eye contact, posture, facial expressions)
    Respond in few word 8-10 words short sentences with actionable feedback.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Data
        }
      }
    ]);

    const response = await result.response;
    const feedback = response.text();

    console.log(`✅ Gemini analysis complete: ${feedback.substring(0, 50)}...`);

    // Store frame metadata and feedback in Supabase
    const { data: insertedData, error: insertError } = await supabase
      .from('roleplay_frames')
      .insert({
        session_id: sessionId,
        employee_id: employeeId,
        timestamp: timestamp,
        feedback: feedback,
        frame_size_kb: Math.round(imageBuffer.length / 1024)
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Error storing frame metadata:', insertError);
      // Continue anyway - feedback is still returned
    } else {
      console.log(`💾 Stored frame metadata with id: ${insertedData.id}`);
    }

    return {
      success: true,
      feedback: feedback,
      timestamp: timestamp,
      sessionId: sessionId
    };

  } catch (error) {
    console.error('❌ Error processing frame:', error);
    
    // Log error to database
    try {
      await supabase
        .from('roleplay_frames')
        .insert({
          session_id: sessionId,
          employee_id: employeeId,
          timestamp: timestamp,
          feedback: null,
          error_message: error.message
        });
    } catch (dbError) {
      console.error('Failed to log error to database:', dbError);
    }

    throw error;
  }
}

/**
 * Get session summary
 * @param {string} sessionId
 * @returns {Object} - Session statistics and aggregated feedback
 */
async function getSessionSummary(sessionId) {
  try {
    const { data, error } = await supabase
      .from('roleplay_frames')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true });

    if (error) throw error;

    return {
      sessionId,
      totalFrames: data.length,
      frames: data,
      startTime: data[0]?.timestamp,
      endTime: data[data.length - 1]?.timestamp
    };

  } catch (error) {
    console.error('❌ Error getting session summary:', error);
    throw error;
  }
}

module.exports = {
  processFrame,
  getSessionSummary
};
