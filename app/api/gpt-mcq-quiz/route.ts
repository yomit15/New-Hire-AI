import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Helper to call OpenAI for MCQ quiz generation
async function generateMCQQuiz(summary: string, modules: any[], objectives: any[]): Promise<any[]> {
  const prompt = `You are an expert instructional designer. Given the following training content summary, modules, and objectives, generate a 10-12 question multiple-choice quiz. Each question should have 4 options, only one correct answer, and cover a range of topics. Return as JSON array with: {question, options, correctIndex, explanation (optional)}.

Summary: ${summary}
Modules: ${JSON.stringify(modules)}
Objectives: ${JSON.stringify(objectives)}
`;
  console.log("[gpt-mcq-quiz] Calling OpenAI with prompt:", prompt.slice(0, 500));

  // Call OpenAI API (replace with your actual API call)
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
  const data = await response.json();
  let quiz;
  try {
    quiz = JSON.parse(data.choices[0].message.content);
  } catch {
    quiz = [];
  }
  return quiz;
}


export async function POST(request: NextRequest) {
  const body = await request.json();
  console.log("[gpt-mcq-quiz] POST body:", body);
  // Per-module quiz generation
  if (body.moduleId) {
    const moduleId = body.moduleId;
    console.log("[gpt-mcq-quiz] Per-module quiz requested for moduleId:", moduleId);
    // 1. Try to fetch existing quiz for this module
    const { data: assessment, error: fetchError } = await supabase
      .from('assessments')
      .select('id, questions')
      .eq('type', 'module')
      .eq('module_id', moduleId)
      .maybeSingle();
    console.log("[gpt-mcq-quiz] Assessment fetch result:", assessment, fetchError);
    if (assessment && assessment.questions) {
      try {
        console.log("[gpt-mcq-quiz] Returning existing quiz for moduleId:", moduleId);
        return NextResponse.json({ quiz: JSON.parse(assessment.questions) });
      } catch (e) {
        console.log("[gpt-mcq-quiz] Failed to parse existing quiz:", e);
        // If parse fails, treat as missing and regenerate below
      }
    }
    // 2. If not found, generate and insert quiz
    const { data: moduleData, error: moduleError } = await supabase
      .from('processed_modules')
      .select('id, title, content')
      .eq('id', moduleId)
      .maybeSingle();
    console.log("[gpt-mcq-quiz] Processed module fetch result:", moduleData, moduleError);
    if (moduleError || !moduleData) return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    // 3. Feed content to GPT for quiz generation
    const summary = moduleData.title || '';
    const modules = [moduleData.title];
    const objectives = [moduleData.content];
    const quiz = await generateMCQQuiz(summary, modules, objectives);
    // 4. Double-check again before insert (race condition protection)
    const { data: existingQuiz } = await supabase
      .from('assessments')
      .select('id')
      .eq('type', 'module')
      .eq('module_id', moduleId)
      .maybeSingle();
    if (!existingQuiz) {
      const insertResult = await supabase
        .from('assessments')
        .insert({ type: 'module', module_id: moduleId, questions: JSON.stringify(quiz) });
      console.log("[gpt-mcq-quiz] Inserted quiz for moduleId:", moduleId, insertResult);
    } else {
      console.log("[gpt-mcq-quiz] Quiz already exists for moduleId, not inserting again.");
    }
    return NextResponse.json({ quiz });
  }
  // Baseline (multi-module) quiz generation (existing logic)
  const { moduleIds } = body;
  if (!moduleIds || !Array.isArray(moduleIds) || moduleIds.length === 0) {
    return NextResponse.json({ error: 'moduleIds (array) required' }, { status: 400 });
  }
  // 1. Get all selected modules' content
  const { data, error } = await supabase
    .from('training_modules')
    .select('id, gpt_summary, ai_modules, ai_objectives')
    .in('id', moduleIds);
  console.log("[gpt-mcq-quiz] Baseline modules fetch result:", data, error);
  if (error || !data || data.length === 0) return NextResponse.json({ error: 'Modules not found' }, { status: 404 });
  // 2. Check if a baseline assessment already exists in the assessments table
  const { data: assessment, error: assessmentError } = await supabase
    .from('assessments')
    .select('id, questions')
    .eq('type', 'baseline')
    .limit(1)
    .maybeSingle();
  console.log("[gpt-mcq-quiz] Baseline assessment fetch result:", assessment, assessmentError);
  if (assessment && assessment.questions) {
    try {
      console.log("[gpt-mcq-quiz] Returning existing baseline quiz");
      return NextResponse.json({ quiz: JSON.parse(assessment.questions) });
    } catch (e) {
      console.log("[gpt-mcq-quiz] Failed to parse existing baseline quiz:", e);
      // If parse fails, treat as missing and regenerate below
    }
  }
  // 3. If not found, generate and insert baseline quiz
  const combinedSummary = data.map((mod) => mod.gpt_summary).filter(Boolean).join('\n');
  const combinedModules = data.flatMap((mod) => mod.ai_modules ? JSON.parse(mod.ai_modules) : []);
  const combinedObjectives = data.flatMap((mod) => mod.ai_objectives ? JSON.parse(mod.ai_objectives) : []);
  // 4. Generate quiz using GPT
  const quiz = await generateMCQQuiz(
    combinedSummary,
    combinedModules,
    combinedObjectives
  );
  // 5. Double-check again before insert (race condition protection)
  const { data: existingBaseline } = await supabase
    .from('assessments')
    .select('id')
    .eq('type', 'baseline')
    .limit(1)
    .maybeSingle();
  if (!existingBaseline) {
    const insertResult = await supabase
      .from('assessments')
      .insert({ type: 'baseline', questions: JSON.stringify(quiz) });
    console.log("[gpt-mcq-quiz] Inserted baseline quiz:", insertResult);
  } else {
    console.log("[gpt-mcq-quiz] Baseline quiz already exists, not inserting again.");
  }
  return NextResponse.json({ quiz });
}
