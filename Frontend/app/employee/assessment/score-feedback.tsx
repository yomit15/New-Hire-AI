// ScoreFeedbackCard: Shows score and GPT feedback for assessment
"use client";

import React from "react";

interface ScoreFeedbackCardProps {
  score: number;
  maxScore: number;
  feedback: string;
}

const ScoreFeedbackCard: React.FC<ScoreFeedbackCardProps> = ({ score, maxScore, feedback }) => {
  return (
    <div className="border rounded-lg p-6 bg-white shadow space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-1">Assessment Results</h2>
          <p className="text-lg">Score: <span className="font-semibold">{score} / {maxScore}</span></p>
        </div>
        <div className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg font-semibold text-xl">
          {Math.round((score / maxScore) * 100)}%
        </div>
      </div>
      <div>
        <h3 className="font-semibold mb-1">AI Feedback</h3>
        <div className="bg-gray-50 border rounded p-4 text-gray-700 whitespace-pre-line">
          {feedback}
        </div>
      </div>
    </div>
  );
};

export default ScoreFeedbackCard;
