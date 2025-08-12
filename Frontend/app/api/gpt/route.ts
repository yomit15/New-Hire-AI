import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { content, contentType } = await request.json();

    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    const prompt = `
You are an instructional designer. You are given an HR training document. Your task:
1. Read and understand the document.
2. Summarize its actual content (not the file structure or how it was extracted).
3. Break the content into 5–6 learning modules.
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
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{ role: 'system', content: prompt }],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.error?.message || 'OpenAI API error' },
        { status: response.status }
      );
    }

    const data = await response.json();
    let analysis;
    try {
      analysis = JSON.parse(data.choices[0].message.content);
    } catch (e) {
      analysis = { raw: data.choices[0].message.content };
    }

    return NextResponse.json(analysis);

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 