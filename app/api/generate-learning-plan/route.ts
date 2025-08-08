import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const { employee_id } = await req.json();
  if (!employee_id) return NextResponse.json({ error: "Missing employee_id" }, { status: 400 });

  // Fetch all assessments for this employee
  const { data: assessments, error: assessError } = await supabase
    .from("employee_assessments")
    .select("score, feedback, assessment_id, assessments(type, questions)")
    .eq("employee_id", employee_id);
  if (assessError) return NextResponse.json({ error: assessError.message }, { status: 500 });

  // Fetch all modules/objectives
  const { data: modules, error: modError } = await supabase
    .from("processed_modules")
    .select("id, title, content, order_index");
  if (modError) return NextResponse.json({ error: modError.message }, { status: 500 });

  // Compose prompt for GPT
  const prompt = `You are an expert corporate trainer. Given the following assessment results and feedback for an employee, and the available training modules, generate a personalized JSON learning plan. The plan should:
- Identify weak areas based on scores and feedback
- Match module objectives to weaknesses
- Specify what to study, in what order, and how much time for each
- Output a JSON object with: modules (ordered), objectives, recommended time (hours), and any tips or recommendations

Assessment Results:
${JSON.stringify(assessments, null, 2)}

Available Modules:
${JSON.stringify(modules, null, 2)}

Output only the JSON plan.`;

  // Call GPT-4.1
  const completion = await openai.chat.completions.create({
    model: "gpt-4-turbo",
    messages: [
      { role: "system", content: "You are an expert corporate trainer and instructional designer." },
      { role: "user", content: prompt },
    ],
    max_tokens: 2048,
    temperature: 0.7,
  });
  const planJsonRaw = completion.choices[0]?.message?.content?.trim() || "";

  let planJson;
  try {
    planJson = JSON.parse(planJsonRaw);
  } catch {
    planJson = { raw: planJsonRaw };
  }

  // Store in learning_plan table
  const { error: lpError } = await supabase
    .from("learning_plan")
    .insert({
      employee_id,
      plan_json: planJson,
      status: "assigned"
    });
  if (lpError) return NextResponse.json({ error: lpError.message }, { status: 500 });

  return NextResponse.json({ plan: planJson });
}
