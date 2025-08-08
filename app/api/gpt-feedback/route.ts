import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Helper to call GPT for feedback
async function generateFeedback({ score, maxScore, answers, feedback, modules }: any): Promise<string> {
  const prompt = `You are an AI learning coach. Given the following assessment results, provide concise, actionable feedback for the employee. Highlight strengths, weak areas, and suggest next steps for improvement. Use a friendly, supportive tone.\n\nScore: ${score} / ${maxScore}\n\nModule Info: ${JSON.stringify(modules)}\n\nAnswers: ${JSON.stringify(answers)}\n\nFeedback per question: ${JSON.stringify(feedback)}\n`;

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
      max_tokens: 600,
    }),
  });
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function POST(request: NextRequest) {
  console.log('[API] Received request');
  let body;
  try {
    body = await request.json();
    console.log('[API] Request body:', JSON.stringify(body));
  } catch (err) {
    console.error('[API] Error parsing request body:', err);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // Lightweight feedback for quiz page (no DB insert, just feedback)
  if (body.quiz && body.userAnswers && (!body.employee_id || !body.assessment_id)) {
    try {
      console.log('[API] Lightweight feedback mode');
      const questions = body.quiz.map((q, i) => ({
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        userAnswer: body.userAnswers[i],
      }));  
      const prompt = `You are an expert learning coach. For the following quiz, compare the user's answers to the correct answers. For each wrong answer, explain why it is wrong and give a brief tip for improvement. Be concise and supportive.\n\n${JSON.stringify(questions, null, 2)}`;
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
          max_tokens: 800,
        }),
      });
      const data = await response.json();
      let feedback = '';
      try {
        feedback = data.choices[0].message.content;
      } catch {
        feedback = 'No feedback available.';
      }
      console.log('[API] Lightweight feedback generated');
      return NextResponse.json({ feedback });
    } catch (err) {
      console.error('[API] Error in lightweight feedback:', err);
      return NextResponse.json({ error: 'Failed to generate feedback' }, { status: 500 });
    }
  }

  // Original assessment feedback logic
  const { score, maxScore, answers, feedback, modules, employee_id, employee_name, assessment_id } = body;
  console.log('[API] Assessment Submission');
  console.log('[API] Employee ID:', employee_id);
  console.log('[API] Employee Name:', employee_name);
  console.log('[API] Employee Score:', score, '/', maxScore);
  console.log('[API] Employee Feedback (per question):', Array.isArray(feedback) ? feedback.join('\n') : feedback);
  console.log('[API] Assessment ID:', assessment_id);
  console.log('[API] Modules:', JSON.stringify(modules));

  // 1. Generate feedback
  let aiFeedback = '';
  try {
    aiFeedback = await generateFeedback({ score, maxScore, answers, feedback, modules });
    console.log('[API] AI feedback generated');
  } catch (err) {
    console.error('[API] Error generating AI feedback:', err);
    aiFeedback = 'Error generating feedback.';
  }

  // Prepare data for insertion
  const assessmentRecord = {
    employee_id,
    assessment_id,
    answers: answers, // jsonb
    score,
    max_score: maxScore,
    feedback: aiFeedback, // summary feedback
    question_feedback: feedback, // question-wise feedback as array
  };
  console.log('[API] AssessmentRecord Prepared:', JSON.stringify(assessmentRecord, null, 2));

  // 2. Store in employee_assessments if employee_id and assessment_id are provided
  let insertResult = null;
  if (employee_id && assessment_id) {
    try {
      // Determine assessment type (baseline or module)
      let assessmentType = null;
      console.log('[API] Fetching assessment type from assessments table...');
      const { data: assessmentMeta, error: assessmentMetaError } = await supabase
        .from('assessments')
        .select('type')
        .eq('id', assessment_id)
        .maybeSingle();
      if (assessmentMetaError) {
        console.error('[API] Error fetching assessment type:', assessmentMetaError);
      }
      assessmentType = assessmentMeta?.type || null;
      console.log('[API] Assessment type:', assessmentType);
      if (assessmentType === 'baseline') {
        // Always insert new row for baseline (allow multiple attempts)
        console.log('[API] Inserting baseline employee_assessment...');
        insertResult = await supabase.from('employee_assessments').insert(assessmentRecord);
        console.log('[API] Inserted baseline employee_assessment:', JSON.stringify(insertResult, null, 2));
      } else {
        // For module, upsert (one record per module per employee)
        console.log('[API] Checking for existing module employee_assessment...');
        const { data: existingAssessment, error: checkError } = await supabase
          .from('employee_assessments')
          .select('id')
          .eq('assessment_id', assessment_id)
          .eq('employee_id', employee_id)
          .maybeSingle();
        if (checkError) {
          console.error('[API] Error checking existing module assessment:', checkError);
        }
        console.log('[API] Existing module employee_assessment:', existingAssessment);
        if (!existingAssessment) {
          console.log('[API] Inserting module employee_assessment...');
          insertResult = await supabase.from('employee_assessments').insert(assessmentRecord);
          console.log('[API] Inserted module employee_assessment:', JSON.stringify(insertResult, null, 2));
        } else {
          // Overwrite existing row
          console.log('[API] Updating module employee_assessment...');
          insertResult = await supabase.from('employee_assessments').update(assessmentRecord)
            .eq('assessment_id', assessment_id)
            .eq('employee_id', employee_id);
          console.log('[API] Updated module employee_assessment:', JSON.stringify(insertResult, null, 2));
        }
      }
    } catch (err) {
      console.error('[API] Supabase Insert/Update Error:', err);
    }
  } else {
    console.log('[API] Missing employee_id or assessment_id, skipping DB insert.');
  }

  return NextResponse.json({ feedback: aiFeedback, insertResult });
}
