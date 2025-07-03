import React, { useEffect, useRef, useState } from "react";
import { useCatGame } from "../lib/stores/useCatGame";
import { useAudio } from "../lib/stores/useAudio";

interface Cat {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  currentNeed: "food" | "water" | null;
  needTimeout?: number;
  isSatisfied?: boolean;
}

interface Item {
  id:string;
  type: "food" | "water";
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  originalX: number;
  originalY: number;
  isDragging: boolean;
}

interface SpeechBubble {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  timestamp: number;
  needType?: "food" | "water" | null;
}

interface GameCanvasProps {
  onScoreChange: () => void;
  onTimeBonus: (seconds: number) => void;
  currentTime: number;
  onGameEnd: () => void;
}

const BUBBLE_OFFSET = 30; // Balonların karakterlerin ne kadar üstünde çıkacağını belirler
const BUBBLE_WIDTH = 160; // px, tahmini baloncuk genişliği
const BUBBLE_HEIGHT = 48; // px, tahmini baloncuk yüksekliği

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function GameCanvas({
  onScoreChange,
  onTimeBonus,
  currentTime,
  onGameEnd,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    score,
    level,
    gamePhase,
    endGame,
    levelUp,
  } = useCatGame();

  const { playHit, playSuccess } = useAudio();

  const [cats, setCats] = useState<Cat[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [draggedItem, setDraggedItem] = useState<Item | null>(null);
  const [speechBubbles, setSpeechBubbles] = useState<SpeechBubble[]>([]);
  const [images, setImages] = useState<{ [key: string]: HTMLImageElement }>({});
  const [imagesLoaded, setImagesLoaded] = useState(false);

  const catPositions = [
      { x: 90, y: 220 }, { x: 140, y: 220 }, { x: 240, y: 260 },
      { x: 290, y: 260 }, { x: 340, y: 260 }, { x: 60, y: 480 },
      { x: 150, y: 520 }, { x: 80, y: 440 }, { x: 200, y: 480}
  ];

  useEffect(() => {
    const imageUrls = {
      misa: "/misa.png",
      pars: "/pars.png",
      food: "/mama.png",
      water: "/su.png",
      woman: "/af.png",
      room: "/oda.svg",
    };
    let loadedCount = 0;
    const totalImages = Object.keys(imageUrls).length;
    const loadedImages: { [key: string]: HTMLImageElement } = {};
    Object.entries(imageUrls).forEach(([key, url]) => {
      const img = new Image();
      img.onload = () => {
        loadedImages[key] = img;
        loadedCount++;
        if (loadedCount === totalImages) {
          setImages(loadedImages);
          setImagesLoaded(true);
        }
      };
      img.src = url;
    });
  }, []);

  useEffect(() => {
    if (gamePhase === "playing") {
      const initialCats: Cat[] = [
        { id: "misa", name: "İstanbul", x: 50, y: 380, width: 70, height: 70, color: "#666", currentNeed: null, isSatisfied: false },
        { id: "pars", name: "Rifki", x: 150, y: 500, width: 70, height: 70, color: "#DAA520", currentNeed: null, isSatisfied: false },
      ];
      const initialItems: Item[] = [
        { id: "food", type: "food", x: 40, y: 620, width: 60, height: 60, color: "#8B4513", originalX: 40, originalY: 620, isDragging: false },
        { id: "water", type: "water", x: 120, y: 620, width: 60, height: 60, color: "#4169E1", originalX: 120, originalY: 620, isDragging: false },
      ];
      setCats(initialCats);
      setItems(initialItems);
    }
  }, [gamePhase]);

  useEffect(() => {
    if (gamePhase !== 'playing') return;

    // Zamanı takip et
    let startTime = Date.now();
    let extraDifficulty = false;

    const getElapsedSeconds = () => Math.floor((Date.now() - startTime) / 1000);

    const initialRequestTimeout = setTimeout(() => generateNewRequestForRandomCat(), 1500);
    const doubleRequestTimeout = setTimeout(() => {
        const availableCats = getAvailableCats();
        if (availableCats.length > 1) {
            generateNewRequest(availableCats[0], 'food');
            generateNewRequest(availableCats[1], 'water');
        }
    }, 10000);

    // --- ZORLUK: 1 dk sonra daha hızlı ve daha fazla baloncuk ---
    let randomRequestInterval: NodeJS.Timeout;
    let difficultyInterval: NodeJS.Timeout;
    let maxConcurrentRequests = Math.min(2, Math.floor(1 + level / 2));
    let requestIntervalMs = Math.max(2000, 5000 - level * 250);

    function updateDifficulty() {
      const elapsed = getElapsedSeconds();
      if (elapsed >= 60 && !extraDifficulty) {
        // 1 dk sonra zorluk artışı
        extraDifficulty = true;
        maxConcurrentRequests = Math.min(4, 2 + Math.floor(level / 2));
        requestIntervalMs = Math.max(900, 2000 - level * 120); // Daha hızlı
        clearInterval(randomRequestInterval);
        randomRequestInterval = setInterval(() => {
          const activeRequests = cats.filter(c => c.currentNeed).length;
          if (activeRequests < maxConcurrentRequests) {
            generateNewRequestForRandomCat();
          }
        }, requestIntervalMs);
      }
    }

    randomRequestInterval = setInterval(() => {
        const activeRequests = cats.filter(c => c.currentNeed).length;
        if (activeRequests < maxConcurrentRequests) {
            generateNewRequestForRandomCat();
        }
    }, requestIntervalMs);

    difficultyInterval = setInterval(updateDifficulty, 2000);

    const timeoutChecker = setInterval(() => {
        const now = Date.now();
        cats.forEach(cat => {
            if (cat.currentNeed && cat.needTimeout && now > cat.needTimeout) {
                moveCatToNewPosition(cat.id, true);
            }
        });
    }, 1000);

    return () => {
      clearTimeout(initialRequestTimeout);
      clearTimeout(doubleRequestTimeout);
      clearInterval(randomRequestInterval);
      clearInterval(timeoutChecker);
      clearInterval(difficultyInterval);
    };
  }, [gamePhase, level, cats]);

  useEffect(() => { if (currentTime <= 0 && gamePhase === "playing") endGame(); }, [currentTime, gamePhase, endGame]);
  useEffect(() => { if (score > 0 && score % 8 === 0) levelUp(); }, [score, levelUp]);

  const getAvailableCats = () => cats.filter(c => !c.currentNeed && !c.isSatisfied);

  const generateNewRequestForRandomCat = () => {
    const availableCats = getAvailableCats();
    if (availableCats.length > 0) {
        const catToRequest = availableCats[Math.floor(Math.random() * availableCats.length)];
        generateNewRequest(catToRequest);
    }
  };

  const moveCatToNewPosition = (catId: string, clearAll: boolean) => {
    setCats(prevCats => {
        const otherCat = prevCats.find(c => c.id !== catId);
        const availablePositions = catPositions.filter(pos => {
            if (!otherCat) return true;
            return Math.sqrt(Math.pow(pos.x - otherCat.x, 2) + Math.pow(pos.y - otherCat.y, 2)) > 80;
        });
        const finalPositions = availablePositions.length > 0 ? availablePositions : catPositions;
        const newPosition = finalPositions[Math.floor(Math.random() * finalPositions.length)];

        return prevCats.map(cat => {
            if (cat.id === catId) {
                const newState: Partial<Cat> = { x: newPosition.x, y: newPosition.y };
                if (clearAll) {
                    newState.currentNeed = null;
                    newState.needTimeout = undefined;
                    newState.isSatisfied = false;
                }
                return { ...cat, ...newState };
            }
            return cat;
        });
    });
  };

  const generateNewRequest = (catToRequest: Cat, forceNeed?: "food" | "water") => {
    if (catToRequest.currentNeed || catToRequest.isSatisfied) return;
    const randomNeed: "food" | "water" = forceNeed || (Math.random() > 0.5 ? "food" : "water");
    // --- ZORLUK: 1 dk sonra baloncuk süresi daha kısa ---
    let requestDuration = Math.max(8, 20 - level);
    if (typeof window !== 'undefined') {
      const elapsed = (window.performance?.now?.() || Date.now()) / 1000;
      if (elapsed > 60) {
        requestDuration = Math.max(5, 12 - level); // Daha kısa süre
      }
    }
    setCats(prev => prev.map(cat => cat.id === catToRequest.id ? { ...cat, currentNeed: randomNeed, needTimeout: Date.now() + requestDuration * 1000 } : cat ));
    showSpeechBubble(catToRequest, getCatMessage(catToRequest, randomNeed), "#FFE4B5", randomNeed);
    setTimeout(() => showWomanReaction(catToRequest, randomNeed), 1000);
  };

  const getCatMessage = (cat: Cat, need: "food" | "water") => {
    // --- YENİ: Daha fazla diyalog çeşidi ---
    if (cat.id === "misa") { 
        const messages = need === "food" 
            ? ["Anne, karnım acıktı 🥺", "Biraz mama alabilir miyim?", "Miyav.. Acıktım...", "Anne yemek! Lütfen?", "Karnım gurulduyor da..."] 
            : ["Anne, dilim damağım kurudu 💧", "Su verebilir misin?", "Susadım anne...", "Birazcık su lütfen?", "Mümkünse biraz su?"];
        return messages[Math.floor(Math.random() * messages.length)]; 
    } else { 
        const messages = need === "food" 
            ? ["ANNE! AÇIM! YEMEK NEREDE? 😤", "Açlıktan öleceğim, çabuk ol!", "YEMEK! YEMEK! YEMEK!", "O mama buraya gelecek!", "Miyavvv! (Açım demek bu!)"] 
            : ["ANNE! SUSADIM! 💧", "Çöl gibi oldum, su getir!", "SUUUUUUU!", "Hemen su istiyorum! Hemen!", "O su kabı dolsun artık!"];
        return messages[Math.floor(Math.random() * messages.length)]; 
    }
  };

  const showWomanReaction = (cat: Cat, need: "food" | "water") => {
    // --- YENİ: Daha fazla diyalog çeşidi ---
    let normalReactions: string[] = []; 
    if (cat.id === 'pars') { 
        normalReactions = ["Tamam oğlum, hemen getiriyorum!", "Aç mı kalmış benim aslan oğlum?", "Oğlum, Rifki, yapma annem!", `Yine mi acıktın yakışıklım?`, "Rifki! Sabret, geliyor!", "Geliyor benim kuzumun yemeği."]; 
    } else if (cat.id === 'misa') { 
        normalReactions = ["İstanbul, kızımmm, tamam.", "Geliyor prensesimin maması.", `Güzel kızım benim, susadın mı?`, "Hemen bakıyorum İstanbul'a.", "Tabii ki bebeğim, hemen."]; 
    } 
    const complaintReactions = [ "Of yine mi acıktınız!", "Daha yeni yemedin mi sen?", "Biraz da kendiniz alın şuradan!", "HusnaNur anne yoruldu ama!", "Yetişemiyorum size yahu!", "Bu kedilerin midesi dipsiz kuyu!" ]; 
    const reactionList = Math.random() < 0.8 ? normalReactions : complaintReactions; 
    const text = reactionList[Math.floor(Math.random() * reactionList.length)]; 
    const bubbleX = 240 + (135/2); 
    const bubbleY = 370 - BUBBLE_OFFSET; // HusnaNur'un y'sinden ofset kadar yukarı
    const bubble: SpeechBubble = { id: `woman_bubble_${Date.now()}`, x: bubbleX, y: bubbleY, text, color: "#FFE4E1", timestamp: Date.now() }; 
    setSpeechBubbles((prev) => [...prev, bubble]); 
    setTimeout(() => setSpeechBubbles((prev) => prev.filter((b) => b.id !== bubble.id)), 3000);
  };

  const showSpeechBubble = (cat: Cat, text: string, color: string, needType?: "food" | "water" | null) => {
    let bubbleX = cat.x + cat.width / 2;
    let bubbleY = Math.max(20, cat.y - BUBBLE_OFFSET);
    // Ekran dışına taşmayı engelle
    bubbleX = clamp(bubbleX, BUBBLE_WIDTH / 2, 400 - BUBBLE_WIDTH / 2);
    bubbleY = clamp(bubbleY, BUBBLE_HEIGHT, 700 - BUBBLE_HEIGHT);
    // Eğer baloncuk karakterin yüzünü kapatıyorsa, biraz daha yukarı kaydır
    if (bubbleY > cat.y - BUBBLE_OFFSET) {
      bubbleY = Math.max(20, cat.y - BUBBLE_OFFSET - 30);
    }
    const bubble: SpeechBubble = { id: `bubble_${Date.now()}`, x: bubbleX, y: bubbleY, text, color, timestamp: Date.now(), needType: needType || null };
    setSpeechBubbles((prev) => [...prev, bubble]);
    setTimeout(() => setSpeechBubbles((prev) => prev.filter((b) => b.id !== bubble.id)), 4000);
  };

  const handleCorrectDelivery = (cat: Cat) => {
    onScoreChange();
    playSuccess();
    onTimeBonus(Math.max(5, 12 - level));

    setCats(prev => prev.map(c => c.id === cat.id ? { ...c, currentNeed: null, needTimeout: undefined, isSatisfied: true } : c));

    const happyReactions = cat.id === 'misa' ? ["Teşekkürler anne! ❤️", "Harikaydı!"] : ["HEH ŞÖYLE! Mükemmel! 🎉", "Sonunda!"];
    showSpeechBubble(cat, happyReactions[Math.floor(Math.random() * happyReactions.length)], "#90EE90", null);

    setTimeout(() => {
        setCats(prev => prev.map(c => c.id === cat.id ? { ...c, isSatisfied: false } : c));
        moveCatToNewPosition(cat.id, false);
    }, 2000);
  };

  const handleWrongDelivery = (cat: Cat) => {
    playHit(); const wrongReactions = cat.id === 'misa' ? ["Ama ben onu istememiştim ki... 😔", "Yanlış oldu anne..."] : ["BU DEĞİL! DİĞERİ! 😠", "Anne! Dikkatini ver!"]; showSpeechBubble(cat, wrongReactions[Math.floor(Math.random()*wrongReactions.length)], "#FFB6C1", null);
  };

  const getEventPos = (e: MouseEvent | Touch): { x: number; y: number } => { const canvas = canvasRef.current; if (!canvas) return { x: 0, y: 0 }; const rect = canvas.getBoundingClientRect(); const scaleX = canvas.width / rect.width; const scaleY = canvas.height / rect.height; return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }; };
  const isPointInRect = (point: { x: number; y: number }, rect: { x: number; y: number; width: number; height: number }) => { return (point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height); };
  const handleStart = (e: MouseEvent | Touch) => { if (gamePhase !== "playing") return; const pos = getEventPos(e); for (let item of items) { if (isPointInRect(pos, item)) { setDraggedItem(item); setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isDragging: true } : i))); break; } } };
  const handleMove = (e: MouseEvent | Touch) => { if (draggedItem) { const pos = getEventPos(e); setDraggedItem({ ...draggedItem, x: pos.x - draggedItem.width / 2, y: pos.y - draggedItem.height / 2 }); } };
  const handleEnd = (e: MouseEvent | Touch) => { if (!draggedItem || gamePhase !== "playing") return; for (let cat of cats) { if (isPointInRect(draggedItem, cat)) { if (cat.currentNeed && draggedItem.type === cat.currentNeed) { handleCorrectDelivery(cat); } else { handleWrongDelivery(cat); } break; } } setItems((prev) => prev.map((item) => item.id === draggedItem.id ? { ...item, x: item.originalX, y: item.originalY, isDragging: false } : item)); setDraggedItem(null); };
  useEffect(() => { const canvas = canvasRef.current; if (!canvas) return; const handleMouseDown = (e: MouseEvent) => handleStart(e); const handleMouseMove = (e: MouseEvent) => { if(draggedItem) handleMove(e); }; const handleMouseUp = (e: MouseEvent) => handleEnd(e); window.addEventListener("mousemove", handleMouseMove); window.addEventListener("mouseup", handleMouseUp); canvas.addEventListener("mousedown", handleMouseDown); return () => { window.removeEventListener("mousemove", handleMouseMove); window.removeEventListener("mouseup", handleMouseUp); canvas.removeEventListener("mousedown", handleMouseDown); }; }, [draggedItem, items, cats, gamePhase]);
  useEffect(() => { const canvas = canvasRef.current; if (!canvas) return; const handleTouchStart = (e: TouchEvent) => { e.preventDefault(); handleStart(e.touches[0]); }; const handleTouchMove = (e: TouchEvent) => { e.preventDefault(); if(draggedItem) handleMove(e.touches[0]); }; const handleTouchEnd = (e: TouchEvent) => { e.preventDefault(); handleEnd(e.changedTouches[0]); }; canvas.addEventListener("touchstart", handleTouchStart, { passive: false }); window.addEventListener("touchmove", handleTouchMove, { passive: false }); window.addEventListener("touchend", handleTouchEnd, { passive: false }); return () => { canvas.removeEventListener("touchstart", handleTouchStart); window.removeEventListener("touchmove", handleTouchMove); window.removeEventListener("touchend", handleTouchEnd); }; }, [draggedItem, items, cats, gamePhase]);

  useEffect(() => {
    if (!imagesLoaded) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (images.room) ctx.drawImage(images.room, 0, 0, canvas.width, canvas.height);
      cats.forEach((cat) => {
        const catImage = images[cat.id];
        if (catImage) ctx.drawImage(catImage, cat.x, cat.y, cat.width, cat.height);
        ctx.fillStyle = "black"; ctx.font = "bold 14px Arial";
        ctx.textAlign = "center";
        ctx.fillText(cat.name, cat.x + cat.width / 2, cat.y + cat.height + 20);
        if (cat.currentNeed) {
          const bounce = Math.sin(Date.now() * 0.005) * 3;
          ctx.fillStyle = cat.currentNeed === "food" ? "#FF6B6B" : "#4ECDC4";
          ctx.beginPath(); ctx.arc(cat.x + cat.width - 15, cat.y + 15 + bounce, 14, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = "#FFF"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(cat.x + cat.width - 15, cat.y + 15 + bounce, 14, 0, Math.PI * 2); ctx.stroke();
          ctx.font = "bold 18px Arial";
          const emoji = cat.currentNeed === "food" ? "🍽" : "💧";
          ctx.strokeText(emoji, cat.x + cat.width - 15, cat.y + 24 + bounce);
          ctx.fillText(emoji, cat.x + cat.width - 15, cat.y + 24 + bounce);
        }
      });
      const allItems = [...items];
      if (draggedItem) allItems.push(draggedItem);
      allItems.forEach((item) => {
          ctx.save();
          if (item.isDragging) {
              ctx.globalAlpha = 0.8;
              ctx.scale(1.1, 1.1);
              ctx.translate(-(item.width*0.05), -(item.height*0.05));
          }
          const itemImage = images[item.type];
          if (itemImage) ctx.drawImage(itemImage, item.x, item.y, item.width, item.height);
          ctx.restore();
      });
      if (images.woman) {
        const womanWidth = 180;
        const womanHeight = 240;
        const womanX = 200;
        const womanY = 370;
        ctx.drawImage(images.woman, womanX, womanY, womanWidth, womanHeight);
        ctx.fillStyle = "black";
        ctx.font = "bold 18px Arial";
        ctx.textAlign = "center";
        ctx.fillText("HusnaNur", womanX + womanWidth / 2, womanY + womanHeight + 24);
      }
      if (gamePhase === "playing") requestAnimationFrame(animate);
    };
    animate();
  }, [cats, items, draggedItem, images, imagesLoaded, gamePhase]);

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} width={400} height={700} className="w-full h-full cursor-grab active:cursor-grabbing" style={{ imageRendering: "pixelated" }} />
      {speechBubbles.map((bubble) => (
        <div key={bubble.id} className="absolute bg-white border-2 border-gray-800 rounded-2xl p-2 text-xs font-bold z-40 pointer-events-none"
          style={{
            left: `${(bubble.x / 400) * 100}%`,
            top: `${(bubble.y / 700) * 100}%`,
            // --- GÜNCELLENDİ: Balonların daha yukarıda çıkması için en doğru yöntem ---
            transform: "translate(-50%, calc(-100% - 10px))", // -%100, kendi yüksekliği kadar yukarı çık demektir. -10px de ekstra boşluk.
            animation: "bounce 0.5s", // bounce animasyonunu buraya aldık
            backgroundColor: bubble.color,
          }}>
          {bubble.needType && (
            <div className="w-6 h-6 flex-shrink-0">
              <img src={bubble.needType === 'food' ? '/mama.png' : '/su.png'} alt={bubble.needType} className="w-full h-full object-contain" style={{ imageRendering: "pixelated" }} />
            </div>
          )}
          <span>{bubble.text}</span>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0" style={{ borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: "6px solid #333" }} />
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 -mt-1" style={{ borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: `4px solid ${bubble.color}` }} />
        </div>
      ))}
    </div>
  );
}