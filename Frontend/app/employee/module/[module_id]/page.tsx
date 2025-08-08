// ...existing code...
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

export default function ModuleContentPage({ params }: { params: { module_id: string } }) {
  const moduleId = params.module_id;
  const [module, setModule] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchModule = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("processed_modules")
        .select("id, title, content")
        .eq("id", moduleId)
        .single();
      if (!error && data) {
        setModule(data);
      } else {
        setModule(null);
      }
      setLoading(false);
    };
    if (moduleId) fetchModule();
  }, [moduleId]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading module content...</div>;
  }

  if (!module) {
    return <div className="min-h-screen flex items-center justify-center text-red-600">Module not found.</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-100 px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{module.title}</CardTitle>
            <CardDescription>Module Content</CardDescription>
          </CardHeader>
          <CardContent>
            {module.content ? (
              <div className="prose prose-lg max-w-none" dangerouslySetInnerHTML={{ __html: formatContent(module.content) }} />
            ) : (
              <div className="text-gray-500">No content available for this module.</div>
            )}
          </CardContent>
        </Card>
        <button className="text-blue-600 underline" onClick={() => router.back()}>Back to Training Plan</button>
      </div>
    </div>
  );
}

// Helper to format content (if it's markdown or plain text)
function formatContent(content: string) {
  // If content is JSON, pretty print. If HTML, return as is. If markdown, you can add a markdown parser.
  try {
    const parsed = JSON.parse(content);
    if (typeof parsed === "object") {
      return `<pre>${JSON.stringify(parsed, null, 2)}</pre>`;
    }
  } catch {}
  // Basic: replace line breaks with <br/>
  return content.replace(/\n/g, "<br/>");
}
