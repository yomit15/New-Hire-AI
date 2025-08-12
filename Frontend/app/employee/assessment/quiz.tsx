// Quiz component for adaptive baseline assessment
"use client";

import React, { useState } from "react";

interface QuizQuestion {
  id: string;
  question: string;
  module: string;
}

interface QuizProps {
  questions: QuizQuestion[];
  onSubmit: (answers: { [id: string]: string }) => void;
}

const Quiz: React.FC<QuizProps> = ({ questions, onSubmit }) => {
  const [answers, setAnswers] = useState<{ [id: string]: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    onSubmit(answers);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {questions.map((q, idx) => (
        <div key={q.id} className="mb-4">
          <label className="block font-medium mb-2">
            {idx + 1}. {q.question}
          </label>
          <textarea
            className="w-full border rounded p-2"
            rows={3}
            value={answers[q.id] || ""}
            onChange={(e) => handleChange(q.id, e.target.value)}
            required
          />
        </div>
      ))}
      <button
        type="submit"
        className="bg-blue-600 text-white px-4 py-2 rounded"
        disabled={submitting}
      >
        {submitting ? "Submitting..." : "Submit Answers"}
      </button>
    </form>
  );
};

export default Quiz;
