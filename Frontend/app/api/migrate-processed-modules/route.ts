import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// This API migrates ai_modules from training_modules to processed_modules
export async function POST(req: NextRequest) {
  try {
    const { moduleId } = await req.json();
    
    // If moduleId is provided, process only that module, otherwise process all
    let query = supabase
      .from("training_modules")
      .select("id, ai_modules, company_id");
    
    if (moduleId) {
      query = query.eq('id', moduleId);
    }
    
    const { data: modules, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

  let inserted = 0;
  let skipped = 0;
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
      const learningStyles = ["CS", "CR", "AS", "AR"];
      const rows = learningStyles.map(style => ({
        original_module_id: mod.id,
        title: title || `Module ${i + 1}`,
        content: content || "",
        section_type: section_type || null,
        order_index: i,
        learning_style: style,
      }));
      // Use upsert to avoid duplicates once DB constraint exists
      const { data: upsertData, error: upsertError } = await supabase
        .from("processed_modules")
        .upsert(rows, { onConflict: 'original_module_id,order_index,learning_style', ignoreDuplicates: true })
        .select();
      if (upsertError) {
        console.error('Upsert error processed_modules', upsertError);
        continue;
      }
      if (upsertData) {
        inserted += upsertData.length; // rows actually inserted or updated
        // We can't directly know skipped count unless we re-query; optional
      }
    }
  }
  return NextResponse.json({ message: `Upserted ${inserted} processed modules (idempotent).` });
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json({ error: "Migration failed" }, { status: 500 });
  }
}
