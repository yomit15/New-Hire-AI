// MCQQuiz component for employee assessment
"use client";

import React, { useState } from "react";

interface MCQQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

interface MCQQuizProps {
  questions: MCQQuestion[];
  onSubmit: (result: { score: number; answers: number[]; feedback: string[] }) => void;
}

const MCQQuiz: React.FC<MCQQuizProps> = ({ questions, onSubmit }) => {
  const [selected, setSelected] = useState<(number | null)[]>(Array(questions.length).fill(null));
  const [feedback, setFeedback] = useState<string[]>(Array(questions.length).fill(""));
  const [score, setScore] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSelect = (qIdx: number, optIdx: number) => {
    if (submitted) return;
    const newSelected = [...selected];
    newSelected[qIdx] = optIdx;
    setSelected(newSelected);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let sc = 0;
    const fb: string[] = [];
    questions.forEach((q, i) => {
      if (selected[i] === q.correctIndex) {
        sc++;
        fb.push("Correct");
      } else {
        fb.push(q.explanation ? `Incorrect. ${q.explanation}` : "Incorrect");
      }
    });
    setScore(sc);
    setFeedback(fb);
    setSubmitted(true);
    onSubmit({ score: sc, answers: selected as number[], feedback: fb });
    console.log("Quiz submitted with score:", sc, "/", questions.length);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {questions.map((q, idx) => (
        <div key={idx} className="mb-6">
          <div className="font-medium mb-2">{idx + 1}. {q.question}</div>
          <div className="space-y-2">
            {q.options.map((opt, oidx) => (
              <label key={oidx} className={`block p-2 border rounded cursor-pointer ${selected[idx] === oidx ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}` }>
                <input
                  type="radio"
                  name={`q${idx}`}
                  value={oidx}
                  checked={selected[idx] === oidx}
                  onChange={() => handleSelect(idx, oidx)}
                  disabled={submitted}
                  className="mr-2"
                />
                {opt}
              </label>
            ))}
          </div>
          {submitted && (
            <div className={feedback[idx].startsWith("Correct") ? "text-green-600 mt-2" : "text-red-600 mt-2"}>
              {feedback[idx]}
            </div>
          )}
        </div>
      ))}
      {!submitted && (
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Submit Quiz</button>
      )}
      {submitted && (
        <div className="text-lg font-semibold mt-4">Score: {score} / {questions.length}</div>
      )}
    </form>
  );
};

export default MCQQuiz;
