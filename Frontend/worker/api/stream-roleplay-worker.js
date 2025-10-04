/**
 * Gemini Live API Streaming Worker
 * Handles real-time audio + video streaming to Gemini API
 * Returns: transcripts, confidence cues, presentation feedback
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Initialize clients
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

/**
 * Process audio + video stream for presentation analysis
 * @param {Object} streamData - { sessionId, employeeId, audioChunk, videoFrame }
 * @returns {Object} - { transcript, voiceFeedback, visualFeedback, confidenceScore }
 */
async function processMultimodalStream(streamData) {
  const { sessionId, employeeId, timestamp, audioChunk, videoFrame } = streamData;

  try {
    console.log(`🎬 [STREAM] Processing multimodal data for session ${sessionId}`);
    console.log(`   📊 Audio: ${audioChunk ? 'present' : 'missing'}`);
    console.log(`   📸 Video: ${videoFrame ? 'present' : 'missing'}`);

    // Use Gemini 1.5 Pro for multimodal analysis (supports audio + image)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    // Prepare multimodal prompt
    const prompt = `You are analyzing a presentation for training purposes. Provide real-time feedback on:

VOICE ANALYSIS (70% weight):
- Speech clarity and articulation
- Speaking pace (too fast/slow/good)
- Vocal confidence and tone
- Filler words or hesitations
- Professional language use

BODY LANGUAGE (30% weight):
- Posture and stance
- Eye contact (facing camera)
- Facial expressions
- Confidence signals

RESPOND IN THIS EXACT JSON FORMAT:
{
  "transcript": "transcribed speech if audio present",
  "voiceAnalysis": {
    "clarity": "clear/unclear/muffled",
    "pace": "good/too fast/too slow",
    "confidence": "high/medium/low",
    "fillerWords": ["um", "uh", "like"],
    "feedback": "brief actionable voice feedback"
  },
  "bodyLanguage": {
    "posture": "good/slouching/stiff",
    "eyeContact": "good/avoiding/staring",
    "expressiveness": "appropriate/too much/too little",
    "feedback": "brief actionable body language feedback"
  },
  "overallScore": 85,
  "quickFeedback": "One-sentence immediate feedback"
}

Be concise and actionable. Focus on improvement areas.`;

    // Utility to extract base64 + mime type from data URLs
    const parseDataUrl = (dataUrl, fallbackMime) => {
      if (!dataUrl) return null;
      if (!dataUrl.startsWith('data:')) {
        return { mimeType: fallbackMime, data: dataUrl };
      }
      const [header, base64Data] = dataUrl.split(',', 2);
      const mimeMatch = header.match(/^data:([^;]+)(;.*)?$/);
      const mimeType = mimeMatch ? mimeMatch[1] : fallbackMime;
      return { mimeType, data: base64Data || '' };
    };

    // Build multimodal content array
    const content = [{ text: prompt }];

    // Add video frame if present
    if (videoFrame) {
      const parsedVideo = parseDataUrl(videoFrame, 'image/jpeg');
      if (parsedVideo?.data) {
        content.push({
          inlineData: {
            mimeType: parsedVideo.mimeType,
            data: parsedVideo.data
          }
        });
      }
    }

    // Add audio chunk if present
    if (audioChunk) {
      const parsedAudio = parseDataUrl(audioChunk, 'audio/webm');
      if (parsedAudio?.data) {
        content.push({
          inlineData: {
            mimeType: parsedAudio.mimeType,
            data: parsedAudio.data
          }
        });
      }
    }

    // Call Gemini API
    console.log(`🤖 [GEMINI] Sending multimodal request...`);
    const result = await model.generateContent(content);
    const response = await result.response;
    const feedbackText = response.text();

    console.log(`✅ [GEMINI] Response received: ${feedbackText.substring(0, 100)}...`);

    // Parse JSON response
    let parsedFeedback;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = feedbackText.match(/```json\n?([\s\S]*?)\n?```/);
      const jsonText = jsonMatch ? jsonMatch[1] : feedbackText;
      parsedFeedback = JSON.parse(jsonText);
    } catch (parseError) {
      console.warn('⚠️ [GEMINI] Failed to parse JSON, using raw text');
      parsedFeedback = {
        transcript: "",
        voiceAnalysis: { feedback: feedbackText.substring(0, 200) },
        bodyLanguage: { feedback: "" },
        overallScore: 50,
        quickFeedback: feedbackText.substring(0, 100)
      };
    }

    // Store in database
    const { data: insertedData, error: insertError } = await supabase
      .from('roleplay_frames')
      .insert({
        session_id: sessionId,
        employee_id: employeeId,
        timestamp: timestamp,
        feedback: parsedFeedback.quickFeedback,
        frame_size_kb: videoFrame ? Math.round(videoFrame.length / 1024) : 0,
        // Store additional audio/voice data in JSON
        metadata: {
          transcript: parsedFeedback.transcript,
          voiceAnalysis: parsedFeedback.voiceAnalysis,
          bodyLanguage: parsedFeedback.bodyLanguage,
          overallScore: parsedFeedback.overallScore,
          hasAudio: !!audioChunk,
          hasVideo: !!videoFrame
        }
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ [DB] Error storing stream data:', insertError);
    } else {
      console.log(`💾 [DB] Stored multimodal data with id: ${insertedData.id}`);
    }

    return {
      success: true,
      sessionId,
      timestamp,
      ...parsedFeedback
    };

  } catch (error) {
    console.error('❌ [STREAM] Error processing multimodal stream:', error);
    
    // Log error to database
    try {
      await supabase
        .from('roleplay_frames')
        .insert({
          session_id: sessionId,
          employee_id: employeeId,
          timestamp: timestamp,
          feedback: null,
          error_message: error.message,
          metadata: { hasAudio: !!audioChunk, hasVideo: !!videoFrame }
        });
    } catch (dbError) {
      console.error('❌ [DB] Failed to log error:', dbError);
    }

    throw error;
  }
}

/**
 * Get streaming session analytics
 * @param {string} sessionId
 * @returns {Object} - Aggregated statistics and feedback
 */
async function getStreamingSessionSummary(sessionId) {
  try {
    const { data, error } = await supabase
      .from('roleplay_frames')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true });

    if (error) throw error;

    // Calculate aggregated metrics
    const scores = data
      .filter(f => f.metadata?.overallScore)
      .map(f => f.metadata.overallScore);
    
    const avgScore = scores.length > 0 
      ? scores.reduce((a, b) => a + b, 0) / scores.length 
      : 0;

    const transcripts = data
      .filter(f => f.metadata?.transcript)
      .map(f => f.metadata.transcript)
      .join(' ');

    return {
      sessionId,
      totalFrames: data.length,
      duration: data.length > 1 
        ? (new Date(data[data.length - 1].timestamp) - new Date(data[0].timestamp)) / 1000 
        : 0,
      averageScore: Math.round(avgScore),
      fullTranscript: transcripts,
      frames: data.map(f => ({
        timestamp: f.timestamp,
        feedback: f.feedback,
        score: f.metadata?.overallScore,
        voiceAnalysis: f.metadata?.voiceAnalysis,
        bodyLanguage: f.metadata?.bodyLanguage
      })),
      startTime: data[0]?.timestamp,
      endTime: data[data.length - 1]?.timestamp
    };

  } catch (error) {
    console.error('❌ [SUMMARY] Error getting streaming session summary:', error);
    throw error;
  }
}

module.exports = {
  processMultimodalStream,
  getStreamingSessionSummary
};
