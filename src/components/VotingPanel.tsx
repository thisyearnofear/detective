"use client";

import { useState } from "react";

type VoteStatus = "idle" | "loading" | "correct" | "incorrect" | "error";

type Props = { matchId: string; voterFid: number };

export default function VotingPanel({ matchId, voterFid }: Props) {
  const [status, setStatus] = useState<VoteStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const handleVote = async (guess: "REAL" | "BOT") => {
    setStatus("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/vote/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, voterFid, guess }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit vote.");
      }

      setStatus(data.correct ? "correct" : "incorrect");
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(err.message);
    }
  };

  const renderResult = () => {
    switch (status) {
      case "correct":
        return <p className="text-2xl font-bold text-green-400">Correct!</p>;
      case "incorrect":
        return <p className="text-2xl font-bold text-red-400">Incorrect!</p>;
      case "error":
        return <p className="text-lg text-red-500">{errorMessage}</p>;
      default:
        return null;
    }
  };

  return (
    <div className="mt-6 text-center">
      <h3 className="text-xl font-semibold mb-4">What's your verdict?</h3>
      {status === "idle" || status === "loading" ? (
        <div className="flex justify-center gap-4">
          <button
            className="w-40 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-bold py-3 px-4 rounded-lg text-lg transition-colors"
            onClick={() => handleVote("REAL")}
            disabled={status === "loading"}
          >
            Real Person
          </button>
          <button
            className="w-40 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 text-white font-bold py-3 px-4 rounded-lg text-lg transition-colors"
            onClick={() => handleVote("BOT")}
            disabled={status === "loading"}
          >
            Bot
          </button>
        </div>
      ) : (
        <div className="mt-4 h-12 flex items-center justify-center">
            {renderResult()}
        </div>
      )}
      {status === "loading" && <p className="mt-4 text-gray-400">Submitting vote...</p>}
    </div>
  );
}
