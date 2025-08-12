// Scorecard component for displaying assessment results
"use client";

import React from "react";

interface ScorecardProps {
  score: number;
  maxScore: number;
  weakTopics: string[];
}

const Scorecard: React.FC<ScorecardProps> = ({ score, maxScore, weakTopics }) => {
  return (
    <div className="border rounded p-6 bg-white shadow">
      <h2 className="text-2xl font-bold mb-2">Assessment Scorecard</h2>
      <p className="mb-4 text-lg">Score: <span className="font-semibold">{score} / {maxScore}</span></p>
      <h3 className="font-semibold mb-1">Topics to Review:</h3>
      {weakTopics.length > 0 ? (
        <ul className="list-disc ml-6 text-red-600">
          {weakTopics.map((topic, idx) => (
            <li key={idx}>{topic}</li>
          ))}
        </ul>
      ) : (
        <p className="text-green-600">No weak topics detected. Great job!</p>
      )}
    </div>
  );
};

export default Scorecard;
