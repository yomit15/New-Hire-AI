import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  // Fetch all processed_modules with empty or placeholder content
  const { data: modules, error } = await supabase
    .from("processed_modules")
    .select("id, title, content")
    .or("content.is.null,content.eq.'',content.eq.\"\"");

  if (error) {
    console.error("Supabase fetch error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(`Fetched ${modules?.length || 0} modules for content generation.`);

  let updated = 0;
  for (const mod of modules || []) {
    try {
      // Compose prompt
      const prompt = `Generate detailed training content for the module titled: \"${mod.title}\". The content should cover all topics from basic to advanced. Structure the content clearly, use explanations, examples, and practical tips. Make it suitable for new hires in a corporate setting.`;

      console.log(`Calling OpenAI for module: ${mod.title} (${mod.id})`);
      // Call OpenAI
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          { role: "system", content: "You are an expert corporate trainer and instructional designer." },
          { role: "user", content: prompt },
        ],
        max_tokens: 2048,
        temperature: 0.7,
      });
      const aiContent = completion.choices[0]?.message?.content?.trim() || "";
      if (!aiContent) {
        console.warn(`No content generated for module: ${mod.id}`);
        continue;
      }

      // Update processed_modules
      const { error: updateError } = await supabase
        .from("processed_modules")
        .update({ content: aiContent })
        .eq("id", mod.id);
      if (updateError) {
        console.error(`Failed to update content for module ${mod.id}:`, updateError);
      } else {
        updated++;
        console.log(`Updated module ${mod.id} with AI content.`);
      }
    } catch (err) {
      console.error(`Error processing module ${mod.id}:`, err);
    }
  }

  return NextResponse.json({ message: `Updated ${updated} modules with AI-generated content.` });
}
