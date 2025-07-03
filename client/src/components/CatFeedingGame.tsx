import React, { useEffect, useState } from "react";
import { GameCanvas } from "./GameCanvas";
import { useCatGame } from "../lib/stores/useCatGame";
import { useAudio } from "../lib/stores/useAudio";

export function CatFeedingGame() {
  const { score, level, gamePhase, startGame, restartGame, incrementScore } =
    useCatGame();
  const { toggleMute, isMuted } = useAudio();

  const [currentTime, setCurrentTime] = useState(60);
  const [bonusDisplay, setBonusDisplay] = useState<number>(0);

  //--------------------------------------------------
  // Sayaçları yönet
  //--------------------------------------------------
  useEffect(() => {
    if (gamePhase === "playing") setCurrentTime(60);
  }, [gamePhase]);

  useEffect(() => {
    if (gamePhase !== "playing" || currentTime <= 0) return;
    const t = setInterval(() => {
      setCurrentTime((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [gamePhase, currentTime]);

  const addBonusTime = (sec: number) => {
    setCurrentTime((p) => p + sec);
    setBonusDisplay(sec);
    setTimeout(() => setBonusDisplay(0), 2000);
  };

  //--------------------------------------------------
  return (
    <div className="w-full h-full relative bg-gradient-to-br from-purple-400 via-purple-600 to-purple-800 flex items-center justify-center overflow-hidden">
      <div
        className="relative w-full max-w-md h-full max-h-[700px] bg-amber-50 border-4 border-amber-900 rounded-lg overflow-hidden"
        style={{ aspectRatio: "400/700" }}
      >
        {/* Üst bilgi paneli */}
        <div className="absolute top-3 right-16 z-50 text-gray-800 font-bold text-sm text-right bg-white bg-opacity-80 p-2 rounded-lg">
          <div>
            Skor: <span className="text-blue-600">{score}</span>
          </div>
          <div>
            Süre: {" "}
            <span className={currentTime <= 10 ? "text-red-600 animate-pulse" : "text-red-600"}>
              {currentTime}
            </span>
            s
          </div>
          <div>
            Seviye: <span className="text-green-600">{level}</span>
          </div>
        </div>

        {/* Bonus gösterge */}
        {bonusDisplay > 0 && (
          <div className="absolute top-16 right-4 z-60 bg-green-500 text-white font-bold px-3 py-1 rounded-lg animate-bounce">
            +{bonusDisplay}s ⏰
          </div>
        )}

        {/* Ses butonu */}
        <button
          onClick={toggleMute}
          className="absolute top-3 right-3 z-50 p-2 bg-white border-2 border-gray-800 rounded-full text-sm font-bold hover:bg-gray-100"
        >
          {isMuted ? "🔇" : "🔊"}
        </button>

        {/* Oyun alanı – sadece playing/ended fazlarında render edilir */}
        {gamePhase !== "ready" && (
          <GameCanvas
            onScoreChange={incrementScore}
            onTimeBonus={addBonusTime}
            currentTime={currentTime}
            onGameEnd={() => {/* başka aksiyon eklenebilir */}}
          />
        )}

        {/* Oyun bitti ekranı */}
        {(gamePhase === "ended" || currentTime <= 0) && (
          <div className="absolute inset-0 bg-black bg-opacity-90 flex items-center justify-center z-100">
            <div className="bg-white p-6 rounded-lg text-center border-2 border-gray-800">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">🎮 Oyun Bitti!</h2>
              <div className="mb-4">
                <p className="text-lg mb-2">
                  Final Skor: <span className="font-bold text-blue-600">{score}</span>
                </p>
                <p className="text-lg mb-2">
                  Seviye: <span className="font-bold text-green-600">{level}</span>
                </p>
                <p className="text-sm text-gray-600">
                  {score >= 20 ? "🌟 Harika performans!" : score >= 10 ? "👏 İyi oynadın!" : "💪 Tekrar dene!"}
                </p>
              </div>
              <button
                onClick={() => {
                  setCurrentTime(60);
                  setBonusDisplay(0);
                  restartGame();
                }}
                className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                🔁 Tekrar Oyna
              </button>
            </div>
          </div>
        )}

        {/* Başlangıç ekranı */}
        {gamePhase === "ready" && (
          <div className="absolute inset-0 bg-amber-50 flex items-center justify-center z-100">
            <div className="text-center">
              <h1 className="text-3xl font-bold mb-6 text-gray-800">🐱 Anne, Acıktım! 🐱</h1>
              <div className="mb-6 text-gray-600 px-4">
                <p className="text-lg mb-2">Kedilerin ihtiyaçlarını karşıla!</p>
                <p className="text-sm mb-4">🍽️ Mama ve 💧 suyu doğru kediye sürükle</p>
                <div className="text-xs bg-blue-100 p-2 rounded">
                  <p>✨ Her doğru besleme = +8-15 saniye bonus!</p>
                  <p>🎯 İyi oynarsan sınırsız süre!</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setCurrentTime(60);
                  startGame();
                }}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                🚀 Oyuna Başla
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
