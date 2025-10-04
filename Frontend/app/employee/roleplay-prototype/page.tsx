"use client"

import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import EmployeeNavigation from "@/components/employee-navigation"
import { Camera, CameraOff, Activity, Loader2, Mic, MicOff } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function RoleplayPrototypePage() {
  // Video states
  const [isWebcamActive, setIsWebcamActive] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
  const [latestFeedback, setLatestFeedback] = useState<string | null>(null)
  const [feedbackHistory, setFeedbackHistory] = useState<Array<{ timestamp: string; feedback: string }>>([])
  const [sessionId, setSessionId] = useState<string>("")
  const [employeeId, setEmployeeId] = useState<string | null>(null)
  const [employeeEmail, setEmployeeEmail] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Audio states
  const [isAudioActive, setIsAudioActive] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0) // 0-100 for visualization
  const [audioChunks, setAudioChunks] = useState<Blob[]>([])
  
  // Video refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // Audio refs
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()

  // Fetch employee ID
  useEffect(() => {
    async function fetchEmployeeId() {
      if (authLoading || !user?.email) return
      setEmployeeEmail(user.email)
      const res = await fetch(`/api/get-employee-id?email=${encodeURIComponent(user.email)}`)
      const data = await res.json()
      if (data.employee_id) {
        setEmployeeId(data.employee_id)
      } else {
        setEmployeeId(null)
      }
      setLoadingId(false)
    }
    fetchEmployeeId()
  }, [user, authLoading])

  // Generate session ID on mount
  useEffect(() => {
    setSessionId(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
  }, [])

  // Start webcam
  const startWebcam = async () => {
    try {
      console.log("Requesting webcam access...")
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 }, 
          height: { ideal: 480 },
          facingMode: "user"
        } 
      })
      
      console.log("Webcam stream obtained:", stream)
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        
        // Wait for video to load metadata and start playing
        videoRef.current.onloadedmetadata = () => {
          console.log("Video metadata loaded")
          videoRef.current?.play().then(() => {
            console.log("Video playing")
            setIsWebcamActive(true)
            
            toast({
              title: "Webcam Started",
              description: "Your webcam is now active. Click 'Start Capturing' to begin analysis.",
            })
          }).catch(err => {
            console.error("Error playing video:", err)
            toast({
              title: "Video Playback Error",
              description: "Unable to start video playback.",
              variant: "destructive",
            })
          })
        }
      }
    } catch (error) {
      console.error("Error accessing webcam:", error)
      toast({
        title: "Webcam Error",
        description: `Unable to access webcam: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      })
    }
  }

  // Stop webcam
  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsWebcamActive(false)
    stopCapturing()
    
    toast({
      title: "Webcam Stopped",
      description: "Your webcam has been turned off.",
    })
  }

  // Start audio capture with Web Audio API
  const startAudio = async () => {
    try {
      console.log("🎤 Requesting microphone access...")
      
      // Get audio stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000 // 16kHz for speech recognition
        }
      })
      
      audioStreamRef.current = stream
      console.log("✅ Microphone stream obtained:", stream)
      
      // Set up Web Audio API for level monitoring
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      audioContextRef.current = audioContext
      
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser
      
      source.connect(analyser)
      
      // Start audio level monitoring
      monitorAudioLevel()
      
      // Set up MediaRecorder for audio chunks (5-10 sec)
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus' // Will convert to WAV later
      })
      mediaRecorderRef.current = mediaRecorder
      
      const chunks: Blob[] = []
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
          console.log(`📦 Audio chunk captured: ${(event.data.size / 1024).toFixed(2)} KB`)
          
          // Process audio chunk
          processAudioChunk(event.data)
        }
      }
      
      // Record in 8-second chunks
      mediaRecorder.start(8000)
      console.log("🎙️ MediaRecorder started with 8-second chunks")
      
      setIsAudioActive(true)
      
      toast({
        title: "Microphone Started",
        description: "Audio capture is now active.",
      })
      
    } catch (error) {
      console.error("❌ Error accessing microphone:", error)
      toast({
        title: "Microphone Error",
        description: `Unable to access microphone: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      })
    }
  }

  // Stop audio capture
  const stopAudio = () => {
    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
    }
    
    // Stop audio stream
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop())
      audioStreamRef.current = null
    }
    
    // Close AudioContext
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    
    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    
    setIsAudioActive(false)
    setAudioLevel(0)
    
    toast({
      title: "Microphone Stopped",
      description: "Audio capture has been turned off.",
    })
  }

  // Monitor audio levels for visualization
  const monitorAudioLevel = () => {
    if (!analyserRef.current) return
    
    const analyser = analyserRef.current
    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    
    const checkLevel = () => {
      analyser.getByteFrequencyData(dataArray)
      
      // Calculate average volume (0-100)
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length
      const normalizedLevel = Math.min(100, (average / 255) * 100)
      
      setAudioLevel(normalizedLevel)
      
      animationFrameRef.current = requestAnimationFrame(checkLevel)
    }
    
    checkLevel()
  }

  // Store latest audio chunk for synchronization
  const latestAudioChunkRef = useRef<string | null>(null)

  // Process audio chunk and store for next video frame
  const processAudioChunk = async (audioBlob: Blob) => {
    try {
      console.log("🎵 Processing audio chunk...")
      
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64Audio = reader.result as string
        console.log(`📊 Audio chunk: ${(audioBlob.size / 1024).toFixed(2)} KB, base64 length: ${base64Audio.length}`)
        
        // Store for next video frame capture
        latestAudioChunkRef.current = base64Audio
        console.log(`✅ Audio stored in latestAudioChunkRef, will be sent with next video frame`)
      }
      reader.readAsDataURL(audioBlob)
      
    } catch (error) {
      console.error("❌ Error processing audio chunk:", error)
    }
  }

  // Send multimodal data (audio + video) to backend
  const sendMultimodalData = async (videoBase64: string, audioBase64: string | null) => {
    try {
      const videoSize = videoBase64 ? (videoBase64.length / 1024).toFixed(2) : '0'
      const audioSize = audioBase64 ? (audioBase64.length / 1024).toFixed(2) : '0'
      console.log(`🎬 Sending multimodal data: video=${videoSize}KB, audio=${audioSize}KB`)
      
      setIsProcessing(true)
      
      const response = await fetch('http://localhost:3001/api/stream-roleplay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          employeeId,
          timestamp: new Date().toISOString(),
          video: videoBase64,
          audio: audioBase64
        }),
      })

      if (response.ok) {
        const data = await response.json()
        console.log('✅ Received multimodal feedback:', {
          score: data.overallScore,
          transcript: data.transcript?.substring(0, 50),
          quickFeedback: data.quickFeedback
        })
        
        // Update UI with comprehensive feedback
        const feedbackText = data.quickFeedback || data.feedback || "Processing..."
        const detailedFeedback = `
📊 Score: ${data.overallScore || 'N/A'}/100
🗣️ Voice: ${data.voiceAnalysis?.feedback || 'N/A'}
👤 Body: ${data.bodyLanguage?.feedback || 'N/A'}
💬 "${data.transcript || ''}"
        `.trim()
        
        setLatestFeedback(detailedFeedback)
        setFeedbackHistory(prev => [
          { 
            timestamp: new Date().toISOString(), 
            feedback: feedbackText 
          },
          ...prev.slice(0, 9)
        ])
      } else {
        console.error("❌ Failed to send multimodal data:", response.status, response.statusText)
        setLatestFeedback("⚠️ Error: Failed to get feedback")
      }
    } catch (error) {
      console.error("❌ Error sending multimodal data:", error)
      setLatestFeedback("⚠️ Error: Connection failed")
    } finally {
      setIsProcessing(false)
    }
  }

  // Capture frame and send to backend
  const captureFrame = async () => {
    if (!videoRef.current || !canvasRef.current || !isWebcamActive) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    if (!ctx) return

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Convert canvas to blob (JPEG, quality 0.7 to keep size ~100KB)
    canvas.toBlob(async (blob) => {
      if (!blob) return

      // Check blob size
      const sizeKB = blob.size / 1024
      console.log(`Frame size: ${sizeKB.toFixed(2)} KB`)

      // Convert to base64
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64VideoData = reader.result as string
        
        // Get latest audio chunk (if available)
        const audioChunk = latestAudioChunkRef.current
        
        console.log(`🚀 Sending frame to worker: session=${sessionId}, size=${sizeKB.toFixed(2)}KB, hasAudio=${!!audioChunk}`)
        
        // ALWAYS send multimodal data (video + optional audio) to new endpoint
        await sendMultimodalData(base64VideoData, audioChunk)
        
        // Clear audio chunk after sending
        if (audioChunk) {
          console.log(`🎤 Audio chunk sent and cleared`)
          latestAudioChunkRef.current = null
        }
      }
      reader.readAsDataURL(blob)
    }, 'image/jpeg', 0.7)
  }

  // Start capturing frames at 1 FPS
  const startCapturing = () => {
    if (loadingId) {
      toast({
        title: "Loading Profile",
        description: "Still loading your employee profile. Please wait a moment.",
        variant: "destructive",
      })
      return
    }

    if (!employeeId) {
      toast({
        title: "Employee Profile Missing",
        description: "We couldn't find your employee record. Please contact an administrator.",
        variant: "destructive",
      })
      return
    }

    if (!isWebcamActive) {
      toast({
        title: "Webcam Not Active",
        description: "Please start the webcam first.",
        variant: "destructive",
      })
      return
    }

    setIsCapturing(true)
    
    // Capture first frame immediately
    captureFrame()
    
    // Then capture every 1 second
    captureIntervalRef.current = setInterval(() => {
      captureFrame()
    }, 1000)

    toast({
      title: "Capture Started",
      description: "Analyzing your expressions at 1 frame per second.",
    })
  }

  // Stop capturing
  const stopCapturing = () => {
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current)
      captureIntervalRef.current = null
    }
    setIsCapturing(false)
    
    if (isWebcamActive) {
      toast({
        title: "Capture Stopped",
        description: "Frame analysis has been paused.",
      })
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopWebcam()
      stopAudio()
    }
  }, [])

  if (authLoading || loadingId) {
    return <div className="max-w-3xl mx-auto py-10 px-4 text-center">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-100">
      <EmployeeNavigation showForward={false} />
      
      <div 
        className="transition-all duration-300 ease-in-out py-10"
        style={{ 
          marginLeft: 'var(--sidebar-width, 0px)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4">
          
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center bg-purple-100 text-purple-800 px-4 py-2 rounded-full text-sm font-semibold mb-4">
              <Activity className="w-4 h-4 mr-2" />
              PROTOTYPE - Live Presentation Skills Analysis
            </div>
            <h1 className="text-3xl font-bold mb-2">Audio + Video Analysis</h1>
            <p className="text-gray-600">Testing real-time feedback: Voice (70%) + Body Language (30%) • 1 FPS video + 8-sec audio chunks</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Left: Webcam Feed */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Webcam Feed</span>
                  {isWebcamActive && (
                    <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                      Live
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {isWebcamActive 
                    ? "Your webcam is active and ready" 
                    : "Click 'Start Webcam' to begin"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video flex items-center justify-center">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted
                    className={`w-full h-full object-cover ${!isWebcamActive ? 'hidden' : ''}`}
                  />
                  {!isWebcamActive && (
                    <div className="text-gray-400 text-center">
                      <Camera className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p>Webcam not started</p>
                    </div>
                  )}
                  
                  {/* Capturing indicator */}
                  {isCapturing && (
                    <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center">
                      <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>
                      Capturing
                    </div>
                  )}
                  
                  {/* Compact Status Indicator on Video */}
                  {isWebcamActive && (
                    <div className="absolute top-4 left-4">
                      {isProcessing ? (
                        <div className="bg-blue-600/90 backdrop-blur-sm text-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="font-medium">Analyzing...</span>
                        </div>
                      ) : latestFeedback && (
                        <div className="bg-green-600/90 backdrop-blur-sm text-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm max-w-[200px]">
                          <Activity className="w-4 h-4 flex-shrink-0" />
                          <span className="font-medium truncate">Active</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Hidden canvas for frame capture */}
                <canvas ref={canvasRef} className="hidden" />

                {/* Controls */}
                <div className="mt-4 space-y-2">
                  {!isWebcamActive ? (
                    <Button 
                      onClick={startWebcam} 
                      className="w-full"
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Start Webcam
                    </Button>
                  ) : (
                    <>
                      {!isCapturing ? (
                        <>
                          <Button 
                            onClick={startCapturing} 
                            className="w-full bg-green-600 hover:bg-green-700"
                            disabled={!employeeId || loadingId}
                          >
                            <Activity className="w-4 h-4 mr-2" />
                            Start Capturing (1 FPS)
                          </Button>
                          {(!employeeId || loadingId) && (
                            <p className="mt-1 text-xs text-red-600">
                              {loadingId
                                ? "Loading your employee profile..."
                                : "Employee profile not found. Capture disabled."}
                            </p>
                          )}
                        </>
                      ) : (
                        <Button 
                          onClick={stopCapturing} 
                          className="w-full bg-orange-600 hover:bg-orange-700"
                        >
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Stop Capturing
                        </Button>
                      )}
                      <Button 
                        onClick={stopWebcam} 
                        variant="outline"
                        className="w-full"
                      >
                        <CameraOff className="w-4 h-4 mr-2" />
                        Stop Webcam
                      </Button>
                    </>
                  )}
                </div>

                {/* Session Info */}
                <div className="mt-4 p-3 bg-gray-50 rounded text-xs text-gray-600">
                  <div><strong>Session ID:</strong> {sessionId}</div>
                  <div><strong>Employee ID:</strong> {employeeId || "Not found"}</div>
                  <div><strong>Employee Email:</strong> {employeeEmail || "Not found"}</div>
                </div>
              </CardContent>
            </Card>

            {/* Audio Control Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Microphone</span>
                  {isAudioActive && (
                    <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
                      <div className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></div>
                      Recording
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {isAudioActive 
                    ? "Audio capture is active" 
                    : "Enable microphone for voice analysis"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Audio Level Meter */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-600">Audio Level</span>
                    <span className="font-mono text-gray-800">{Math.round(audioLevel)}%</span>
                  </div>
                  
                  {/* Visual Audio Level Bar */}
                  <div className="w-full h-8 bg-gray-200 rounded-lg overflow-hidden">
                    <div 
                      className="h-full transition-all duration-100 ease-out"
                      style={{
                        width: `${audioLevel}%`,
                        backgroundColor: audioLevel > 70 ? '#ef4444' : audioLevel > 40 ? '#f59e0b' : '#10b981'
                      }}
                    />
                  </div>
                  
                  {/* Audio Level Indicator */}
                  {isAudioActive && (
                    <div className="flex gap-1 mt-2">
                      {[...Array(10)].map((_, i) => (
                        <div 
                          key={i} 
                          className={`flex-1 h-2 rounded-full transition-colors duration-150 ${
                            audioLevel > (i * 10) 
                              ? (audioLevel > 70 ? 'bg-red-500' : audioLevel > 40 ? 'bg-yellow-500' : 'bg-green-500')
                              : 'bg-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Audio Controls */}
                <div className="space-y-2">
                  {!isAudioActive ? (
                    <Button 
                      onClick={startAudio} 
                      className="w-full bg-purple-600 hover:bg-purple-700"
                    >
                      <Mic className="w-4 h-4 mr-2" />
                      Start Microphone
                    </Button>
                  ) : (
                    <Button 
                      onClick={stopAudio} 
                      variant="outline"
                      className="w-full"
                    >
                      <MicOff className="w-4 h-4 mr-2" />
                      Stop Microphone
                    </Button>
                  )}
                </div>

                {/* Audio Info */}
                {isAudioActive && (
                  <div className="mt-4 p-3 bg-purple-50 rounded text-xs text-gray-600">
                    <div className="font-semibold text-purple-800 mb-1">Audio Settings</div>
                    <div>• Sample Rate: 16kHz (optimized for speech)</div>
                    <div>• Chunk Size: 8 seconds</div>
                    <div>• Format: WebM/Opus → WAV conversion</div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Right: Live Feedback */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Live Feedback</span>
                  {isProcessing && (
                    <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Processing...
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>Real-time analysis from Gemini API</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Latest Feedback */}
                {latestFeedback ? (
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-l-4 border-blue-500 p-4 rounded-lg mb-6 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-blue-700 font-bold tracking-wide">LATEST FEEDBACK</div>
                      <div className="text-xs text-gray-500">Just now</div>
                    </div>
                    <div className="text-gray-900 font-medium text-base leading-relaxed">
                      {latestFeedback}
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 border-2 border-dashed border-gray-300 p-6 rounded-lg mb-6 text-center">
                    <Activity className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-gray-500 font-medium">No feedback yet</p>
                    <p className="text-gray-400 text-sm mt-1">Start capturing to see AI analysis</p>
                  </div>
                )}

                {/* Feedback History Timeline */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm text-gray-700">Feedback Timeline</h3>
                    {feedbackHistory.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {feedbackHistory.length} {feedbackHistory.length === 1 ? 'entry' : 'entries'}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {feedbackHistory.length > 0 ? (
                      feedbackHistory.map((item, idx) => (
                        <div 
                          key={idx} 
                          className="bg-white border border-gray-200 rounded-lg p-3 text-sm hover:shadow-md transition-shadow duration-200"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <div className="text-xs text-gray-500 font-mono">
                              {new Date(item.timestamp).toLocaleTimeString('en-US', { 
                                hour: '2-digit', 
                                minute: '2-digit', 
                                second: '2-digit' 
                              })}
                            </div>
                          </div>
                          <div className="text-gray-700 leading-relaxed pl-4">
                            {item.feedback}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-400 text-center text-sm py-12 border-2 border-dashed border-gray-200 rounded-lg">
                        <div className="text-gray-300 mb-2">📋</div>
                        <p>Timeline will appear here</p>
                        <p className="text-xs mt-1">once feedback starts coming in</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Back Button */}
          <div className="text-center mt-8">
            <Button 
              variant="outline"
              onClick={() => router.push('/employee/welcome')}
            >
              Back to Dashboard
            </Button>
          </div>

        </div>
      </div>
      
      {/* Custom Scrollbar Styles */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  )
}
