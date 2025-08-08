import { NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs/promises";
import * as nodefs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "../../../lib/supabase";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req: Request) {
  let tempFilePath: string | undefined;

  try {
    // Parse multipart/form-data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const moduleId = formData.get("moduleId") as string | null;

    if (!file || !file.name) {
      return NextResponse.json({ error: "No file uploaded or file has no name" }, { status: 400 });
    }

    if (!moduleId || moduleId === "null") {
      return NextResponse.json({ error: "Missing or invalid moduleId" }, { status: 400 });
    }

    // Save the file temporarily
    const tempDir = process.platform === "win32"
      ? process.env.TEMP || process.env.TMP || "C:\\Windows\\Temp"
      : "/tmp";

    tempFilePath = path.join(tempDir, `${uuidv4()}_${file.name}`);
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(tempFilePath, Buffer.from(arrayBuffer));
    console.log("🟢 File written to:", tempFilePath);

    // Upload to OpenAI
    const openaiFile = await openai.files.create({
      file: nodefs.createReadStream(tempFilePath),
      purpose: "assistants",
    });

    const thread = await openai.beta.threads.create();

    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: "Summarize this document and break it into modules, topics, and objectives.",
      attachments: [{
        file_id: openaiFile.id,
        tools: [{ type: "file_search" }],
      }],
    });

    const assistantId = process.env.OPENAI_ASSISTANT_ID;
    if (!assistantId) throw new Error("OPENAI_ASSISTANT_ID is not set");

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId,
    });

    // Poll for completion
    let status = run.status;
    let result = null;
    const MAX_POLL = 40;
    let pollCount = 0;

    while (status !== "completed" && status !== "failed" && pollCount < MAX_POLL) {
      await new Promise((r) => setTimeout(r, 2000));
      pollCount++;
      const updatedRun = await openai.beta.threads.runs.retrieve(run.id, {
        thread_id: thread.id,
      });
      status = updatedRun.status;
      if (status === "completed") {
        result = await openai.beta.threads.messages.list(thread.id);
      }
    }

    if (status !== "completed") {
      throw new Error("Assistant run did not complete in time.");
    }

    await fs.unlink(tempFilePath);

    // Parse GPT Response
    const assistantMessage = result?.data?.find((msg: any) => msg.role === "assistant");
    const firstContent = assistantMessage?.content?.find((c: any) => c.type === "text");

    const message: string = (firstContent?.text?.value || firstContent?.text || "").trim();
    console.log("🟡 Raw GPT response:", message);

    let summary: string | null = null;
    let ai_modules: any[] = [];
    let ai_topics: string[] = [];
    let ai_objectives: string[] = [];

    if (message) {
      summary = message.split(/### Module \d+:/)[0].trim();

      // Find all module titles and blocks
      const moduleTitles = [...message.matchAll(/### Module \d+:\s*(.+)/gi)].map(m => m[1]?.trim());
      const moduleBlocks = message.split(/### Module \d+:/i).slice(1);

      for (let i = 0; i < moduleBlocks.length; i++) {
        const block = moduleBlocks[i];
        const title = moduleTitles[i] || `Module ${i + 1}`;
        const topics: string[] = [];
        const objectives: string[] = [];

        // Use regex to find Topics and Objectives sections (case-insensitive, plural/singular)
        // Match: Topics: ... (lines) ... Objectives: ... (lines)
        const topicsMatch = block.match(/topics?:\s*([\s\S]*?)(?=objectives?:|$)/i);
        const objectivesMatch = block.match(/objectives?:\s*([\s\S]*)/i);

        // Extract topics (lines starting with - or *)
        if (topicsMatch && topicsMatch[1]) {
          topics.push(...topicsMatch[1]
            .split(/\n/)
            .map(line => line.trim())
            .filter(line => /^[-*]/.test(line))
            .map(line => line.replace(/^[-*]\s*/, "").replace(/^\*\*?Topic:?\*\*?/i, "").trim())
            .filter(Boolean)
          );
        }

        // Extract objectives (lines starting with - or *)
        if (objectivesMatch && objectivesMatch[1]) {
          objectives.push(...objectivesMatch[1]
            .split(/\n/)
            .map(line => line.trim())
            .filter(line => /^[-*]/.test(line))
            .map(line => line.replace(/^[-*]\s*/, "").replace(/^\*\*?Objective:?\*\*?/i, "").trim())
            .filter(Boolean)
          );
        }

        ai_modules.push({ title, topics, objectives });
        ai_topics.push(...topics);
        ai_objectives.push(...objectives);
      }

      console.log("✅ Parsed summary:", summary);
      console.log("✅ Modules:", ai_modules.length);
      console.log("✅ Topics:", ai_topics.length);
      console.log("✅ Objectives:", ai_objectives.length);
    }

    // Insert into Supabase (training_modules)
    const { data, error } = await supabase
      .from("training_modules")
      .update({
        gpt_summary: summary,
        ai_modules: ai_modules,
        ai_topics: ai_topics,
        ai_objectives: ai_objectives,
        processing_status: "completed",
      })
      .eq("id", moduleId)
      .select();

    if (error) {
      console.error("❌ Supabase update error:", error);
      return NextResponse.json({ error: "Failed to update Supabase", detail: error }, { status: 500 });
    }

    // Insert each ai_module into processed_modules
    let processedCount = 0;
    for (let i = 0; i < ai_modules.length; i++) {
      const mod = ai_modules[i];
      const { title, topics, objectives } = mod;
      const content = JSON.stringify({ topics, objectives });
      const { error: procErr } = await supabase
        .from("processed_modules")
        .insert({
          original_module_id: moduleId,
          title: title || `Module ${i + 1}`,
          content,
          section_type: null,
          order_index: i,
        });
      if (!procErr) processedCount++;
    }

    return NextResponse.json({
      summary,
      ai_modules,
      ai_topics,
      ai_objectives,
      supabaseResult: data,
      processedModulesInserted: processedCount,
    });
  } catch (err) {
    console.error("❌ Fatal Error:", err);
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
      } catch {}
    }
    return NextResponse.json(
      { error: "OpenAI Assistants API failed", detail: `${err}` },
      { status: 500 }
    );
  }
}
 