
"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import MCQQuiz from "./mcq-quiz";
import ScoreFeedbackCard from "./score-feedback";
import { useAuth } from "@/contexts/auth-context";

interface TrainingModule {
  id: string;
  title: string;
  ai_modules: string | null;
}

const AssessmentPage = () => {
  const { user } = useAuth();
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [mcqQuestions, setMcqQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const fetchModules = async () => {
      setLoading(true);
      setError("");
      try {
        // Get employee's company modules
        const { data, error } = await supabase
          .from("training_modules")
          .select("id, title, ai_modules")
          .order("created_at", { ascending: true });
        if (error) throw error;
        setModules(data || []);
      } catch (err: any) {
        setError("Failed to load modules: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchModules();
  }, []);

  useEffect(() => {
    const getMCQQuiz = async () => {
      if (modules.length === 0) return;
      setLoading(true);
      setError("");
      try {
        // Use all module IDs for baseline assessment
        const moduleIds = modules.map((m) => m.id);
        const res = await fetch("/api/gpt-mcq-quiz", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ moduleIds }),
        });
        const data = await res.json();
        if (data.quiz) setMcqQuestions(data.quiz);
        else setError("No quiz generated.");
      } catch (err: any) {
        setError("Failed to get quiz: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    if (modules.length > 0) getMCQQuiz();
  }, [modules]);

  const handleMCQSubmit = async (result: { score: number; answers: number[]; feedback: string[] }) => {
    console.log("handleMCQSubmit called with result successfully.");
    setScore(result.score);
    setLoading(true);
    try {
      // 1. Fetch employee UUID from employees table using user.email
      let employeeId: string | null = null;
      if (user?.email) {
        const { data: empData, error: empError } = await supabase
          .from("employees")
          .select("id")
          .eq("email", user.email)
          .maybeSingle();
        if (empData?.id) {
          employeeId = empData.id;
        } else {
          setError("Could not find employee record for this user.");
          setLoading(false);
          return;
        }
      } else {
        setError("User email not found.");
        setLoading(false);
        return;
      }

      // 2. Find or create a baseline assessment for this employee
      let assessmentId: string | null = null;
      const { data: assessmentDef } = await supabase
        .from("assessments")
        .select("id")
        .eq("type", "baseline")
        .limit(1)
        .maybeSingle();
      if (assessmentDef?.id) {
        assessmentId = assessmentDef.id;
      } else {
        const { data: newDef, error: newDefError } = await supabase
          .from("assessments")
          .insert({ type: "baseline", questions: JSON.stringify(mcqQuestions) })
          .select()
          .single();
        assessmentId = newDef?.id || null;
      }

      // Log score in terminal
      console.log("Employee ID:", employeeId);
      console.log("Employee Name:", user?.email);
      console.log("Employee Score:", result.score, "/", mcqQuestions.length);
      console.log("Employee Feedback:", result.feedback.join("\n"));

      // Call GPT feedback API for AI-generated feedback and store in Supabase
      const res = await fetch("/api/gpt-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score: result.score,
          maxScore: mcqQuestions.length,
          answers: result.answers,
          feedback: result.feedback,
          modules,
          employee_id: employeeId,
          employee_name: user?.email,
          assessment_id: assessmentId,
        }),
      });
      const data = await res.json();
      setFeedback(data.feedback || "");
    } catch (err: any) {
      setFeedback("Could not generate feedback.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-10">
      <h1 className="text-3xl font-bold mb-4">Baseline Assessment</h1>
      <p className="mb-6 text-gray-700">
        Welcome! This adaptive assessment will help us understand your current knowledge. Please answer the following questions to the best of your ability.
      </p>
      {error && <div className="mb-4 text-red-600">{error}</div>}
      {loading && <div className="mb-4 text-gray-500">Loading...</div>}
      {!loading && score === null && mcqQuestions.length > 0 && (
        <MCQQuiz questions={mcqQuestions} onSubmit={handleMCQSubmit} />
      )}
      {!loading && score !== null && (
        <ScoreFeedbackCard score={score!} maxScore={mcqQuestions.length} feedback={feedback} />
      )}
    </div>
  );
};

export default AssessmentPage;
