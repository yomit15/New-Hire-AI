import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// This API migrates ai_modules from training_modules to processed_modules
export async function POST(req: NextRequest) {
  // Fetch all training modules
  const { data: modules, error } = await supabase
    .from("training_modules")
    .select("id, ai_modules");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let inserted = 0;
  for (const mod of modules || []) {
    if (!mod.ai_modules) continue;
    let aiModulesArr;
    try {
      aiModulesArr = Array.isArray(mod.ai_modules)
        ? mod.ai_modules
        : JSON.parse(mod.ai_modules);
    } catch (e) {
      continue;
    }
    for (let i = 0; i < aiModulesArr.length; i++) {
      const aiMod = aiModulesArr[i];
      const { title, content, section_type } = aiMod;
      const { error: insertError } = await supabase
        .from("processed_modules")
        .insert({
          original_module_id: mod.id,
          title: title || `Module ${i + 1}`,
          content: content || "",
          section_type: section_type || null,
          order_index: i,
        });
      if (!insertError) inserted++;
    }
  }
  return NextResponse.json({ message: `Inserted ${inserted} processed modules.` });
}
