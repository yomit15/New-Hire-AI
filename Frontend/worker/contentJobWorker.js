
require('dotenv').config();

// Node.js worker script for processing content generation jobs
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Import local API functions to avoid Vercel timeouts
console.log('Loading migrate-processed-modules...');
const { migrateProcessedModules } = require(path.join(__dirname, 'api/migrate-processed-modules'));
console.log('Loading start-content-generation...');
const { startContentGeneration } = require(path.join(__dirname, 'api/start-content-generation'));
console.log('Loading generate-module-content...');
const { generateModuleContent } = require(path.join(__dirname, 'api/generate-module-content'));
console.log('Loading live-frame-worker...');
const { processFrame, getSessionSummary } = require(path.join(__dirname, 'api/live-frame-worker'));
console.log('Loading stream-roleplay-worker...');
const { processMultimodalStream, getStreamingSessionSummary } = require(path.join(__dirname, 'api/stream-roleplay-worker'));
console.log('All modules loaded successfully.');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_BASE_URL = process.env.INTERNAL_API_BASE_URL;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);


async function processJobs() {
  console.log('Worker started. Polling for jobs every 5 seconds...');
  while (true) {
    console.log('Polling for pending jobs...');
    const { data: jobs, error } = await supabase
      .from('content_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1);

    if (error) {
      console.error('Supabase job fetch error:', error);
      await new Promise(r => setTimeout(r, 5000));
      continue;
    }

    if (jobs && jobs.length > 0) {
      const job = jobs[0];
      console.log(`[JOB] Found pending job: id=${job.id}, module_id=${job.module_id}`);
      // Mark as in-progress
      const { error: updateError } = await supabase.from('content_jobs').update({ status: 'in-progress', updated_at: new Date() }).eq('id', job.id);
      if (updateError) {
        console.error(`[JOB] Failed to mark job in-progress: id=${job.id}`, updateError);
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }
      try {
        console.log(`[JOB] Running migration for module_id=${job.module_id}`);
        const migrateResult = await migrateProcessedModules();
        console.log(`[JOB] Migration completed:`, migrateResult.message);
        
        console.log(`[JOB] Running content generation for module_id=${job.module_id}`);
        const genResult = await generateModuleContent();
        console.log(`[JOB] Content generation completed:`, genResult.message);
        
        await supabase.from('content_jobs').update({ status: 'completed', updated_at: new Date() }).eq('id', job.id);
        console.log(`[JOB] Job completed: id=${job.id}, module_id=${job.module_id}`);
      } catch (err) {
        await supabase.from('content_jobs').update({ status: 'failed', updated_at: new Date() }).eq('id', job.id);
        console.error(`[JOB] Job failed: id=${job.id}, module_id=${job.module_id}`, err);
      }
    } else {
      console.log('No pending jobs found.');
    }
    await new Promise(r => setTimeout(r, 5000)); // Poll every 5 seconds
  }
}

// Express server for live frame processing
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const PORT = process.env.LIVE_FRAME_PORT || 3001;

// Create HTTP server
const server = http.createServer(app);

// Enable CORS for frontend (localhost:3000)
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' })); // Increase limit for base64 images + audio

// WebSocket server for streaming
const wss = new WebSocket.Server({ server });

// Track active WebSocket connections by session
const activeSessions = new Map();

wss.on('connection', (ws) => {
  console.log('🔌 [WS] New WebSocket connection established');
  
  let sessionId = null;

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'init') {
        // Initialize session
        sessionId = data.sessionId;
        activeSessions.set(sessionId, ws);
        console.log(`✅ [WS] Session ${sessionId} initialized`);
        
        ws.send(JSON.stringify({
          type: 'init_ack',
          sessionId,
          message: 'WebSocket session initialized'
        }));
        
      } else if (data.type === 'stream') {
        // Process multimodal stream
        console.log(`📡 [WS] Receiving stream data for session ${data.sessionId}`);
        
        try {
          const result = await processMultimodalStream({
            sessionId: data.sessionId,
            employeeId: data.employeeId,
            timestamp: data.timestamp,
            audioChunk: data.audio,
            videoFrame: data.video
          });
          
          // Send result back via WebSocket
          ws.send(JSON.stringify({
            type: 'feedback',
            sessionId: data.sessionId,
            timestamp: data.timestamp,
            ...result
          }));
          
          console.log(`✅ [WS] Sent feedback for session ${data.sessionId}`);
          
        } catch (error) {
          console.error('❌ [WS] Error processing stream:', error);
          ws.send(JSON.stringify({
            type: 'error',
            error: error.message
          }));
        }
        
      } else if (data.type === 'close') {
        console.log(`👋 [WS] Closing session ${data.sessionId}`);
        activeSessions.delete(data.sessionId);
      }
      
    } catch (error) {
      console.error('❌ [WS] Error handling message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Invalid message format'
      }));
    }
  });

  ws.on('close', () => {
    console.log('🔌 [WS] Connection closed');
    if (sessionId) {
      activeSessions.delete(sessionId);
    }
  });

  ws.on('error', (error) => {
    console.error('❌ [WS] WebSocket error:', error);
  });
});

console.log('🌐 WebSocket server initialized');

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Live frame processing endpoint
app.post('/api/live-frame', async (req, res) => {
  try {
    console.log(`📸 [API] Incoming POST /api/live-frame`);
    const { sessionId, employeeId, timestamp, frame } = req.body;

    if (!sessionId || !timestamp || !frame) {
      console.log('❌ [API] Missing required fields:', { 
        hasSessionId: !!sessionId, 
        hasTimestamp: !!timestamp, 
        hasFrame: !!frame 
      });
      return res.status(400).json({ error: 'Missing required fields: sessionId, timestamp, or frame' });
    }

    const frameSize = frame ? (frame.length / 1024).toFixed(2) : 0;
    console.log(`📸 [API] Processing frame: session=${sessionId}, employee=${employeeId}, size=${frameSize}KB`);

    const result = await processFrame({ sessionId, employeeId, timestamp, frame });

    console.log(`✅ [API] Frame processed successfully for session ${sessionId}`);
    res.json(result);
  } catch (error) {
    console.error('❌ [API] Error processing frame:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Get session summary endpoint
app.get('/api/session-summary/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const summary = await getSessionSummary(sessionId);
    res.json(summary);
  } catch (error) {
    console.error('❌ [API] Error getting session summary:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Multimodal streaming endpoint (HTTP POST - alternative to WebSocket)
app.post('/api/stream-roleplay', async (req, res) => {
  try {
    console.log(`🎬 [API] Incoming POST /api/stream-roleplay`);
    const { sessionId, employeeId, timestamp, audio, video } = req.body;

    if (!sessionId || !timestamp) {
      return res.status(400).json({ 
        error: 'Missing required fields: sessionId or timestamp' 
      });
    }

    console.log(`🎬 [API] Processing stream: session=${sessionId}, audio=${!!audio}, video=${!!video}`);

    const result = await processMultimodalStream({
      sessionId,
      employeeId,
      timestamp,
      audioChunk: audio,
      videoFrame: video
    });

    console.log(`✅ [API] Stream processed successfully for session ${sessionId}`);
    res.json(result);
  } catch (error) {
    console.error('❌ [API] Error processing stream:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Get streaming session summary
app.get('/api/streaming-summary/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const summary = await getStreamingSessionSummary(sessionId);
    res.json(summary);
  } catch (error) {
    console.error('❌ [API] Error getting streaming summary:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Start both the job processor and the HTTP/WebSocket server
server.listen(PORT, () => {
  console.log(`🚀 Live frame API server listening on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   Live frame endpoint: http://localhost:${PORT}/api/live-frame`);
  console.log(`   🌐 WebSocket endpoint: ws://localhost:${PORT}`);
  console.log(`   🎬 Streaming endpoint: http://localhost:${PORT}/api/stream-roleplay`);
  console.log(`   📊 Session summary: http://localhost:${PORT}/api/streaming-summary/:sessionId`);
});

processJobs();
