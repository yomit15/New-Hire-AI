export interface OpenAIUploadResult {
  success: boolean
  data?: any
  error?: string
}

export class OpenAIUploadService {
  private static readonly OPENAI_API_KEY = process.env.OPENAI_API_KEY

  /**
   * Upload audio/video file to OpenAI Whisper API
   */
  static async uploadToWhisper(fileUrl: string, fileName: string): Promise<OpenAIUploadResult> {
    try {
      if (!this.OPENAI_API_KEY) {
        return {
          success: false,
          error: 'OpenAI API key not configured'
        }
      }

      // Download file from Supabase Storage
      const fileResponse = await fetch(fileUrl)
      if (!fileResponse.ok) {
        return {
          success: false,
          error: `Failed to download file: ${fileResponse.statusText}`
        }
      }

      const fileBlob = await fileResponse.blob()
      
      // Check file size (Whisper has 25MB limit)
      const maxSize = 25 * 1024 * 1024 // 25MB
      if (fileBlob.size > maxSize) {
        return {
          success: false,
          error: `File size (${(fileBlob.size / 1024 / 1024).toFixed(2)}MB) exceeds Whisper's 25MB limit`
        }
      }

      // Create FormData for Whisper API
      const formData = new FormData()
      formData.append('file', fileBlob, fileName)
      formData.append('model', 'whisper-1')

      // Upload to OpenAI Whisper API
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.OPENAI_API_KEY}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        return {
          success: false,
          error: `Whisper API error: ${errorData.error?.message || 'Unknown error'}`
        }
      }

      const data = await response.json()
      return {
        success: true,
        data: data.text
      }

    } catch (error) {
      console.error('Whisper upload error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Send text content to OpenAI GPT API for analysis
   */
  static async sendToGPT(content: string, contentType: string): Promise<OpenAIUploadResult> {
    try {
      if (!this.OPENAI_API_KEY) {
        return {
          success: false,
          error: 'OpenAI API key not configured'
        }
      }

      // Check content length (GPT has token limits)
      const estimatedTokens = Math.ceil(content.length / 4) // Rough estimate
      const maxTokens = 8000 // Conservative limit for GPT-4
      
      if (estimatedTokens > maxTokens) {
        // Truncate content if too long
        content = content.substring(0, maxTokens * 4)
        console.warn(`Content truncated to ${maxTokens} estimated tokens`)
      }

      const prompt = `
You are an instructional designer. You are given an HR training document. Your task:
1. Read and understand the document.
2. Summarize its actual content (not the file structure or how it was extracted).
3. Break the content into 3–5 learning modules.
4. For each module, list key topics and learning objectives.

Now begin. Here is the content:
${content}

Return your answer as JSON with this structure:
{
  "summary": "...",
  "modules": [
    {
      "title": "...",
      "topics": ["..."],
      "objectives": ["..."]
    }
  ]
}
`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 2000,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        return {
          success: false,
          error: `GPT API error: ${errorData.error?.message || 'Unknown error'}`
        }
      }

      const data = await response.json()
      const analysis = JSON.parse(data.choices[0].message.content)
      
      return {
        success: true,
        data: analysis
      }

    } catch (error) {
      console.error('GPT API error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Upload image to OpenAI Vision API (for future use)
   */
  static async uploadToVision(fileUrl: string, fileName: string, prompt: string): Promise<OpenAIUploadResult> {
    try {
      if (!this.OPENAI_API_KEY) {
        return {
          success: false,
          error: 'OpenAI API key not configured'
        }
      }

      // Download image from Supabase Storage
      const imageResponse = await fetch(fileUrl)
      if (!imageResponse.ok) {
        return {
          success: false,
          error: `Failed to download image: ${imageResponse.statusText}`
        }
      }

      const imageBlob = await imageResponse.blob()
      const base64Image = await this.blobToBase64(imageBlob)

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4-vision-preview',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Image}`
                  }
                }
              ]
            }
          ],
          max_tokens: 1000,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        return {
          success: false,
          error: `Vision API error: ${errorData.error?.message || 'Unknown error'}`
        }
      }

      const data = await response.json()
      return {
        success: true,
        data: data.choices[0].message.content
      }

    } catch (error) {
      console.error('Vision API error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Convert blob to base64 for image uploads
   */
  private static async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        const base64 = result.split(',')[1]
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }
} 