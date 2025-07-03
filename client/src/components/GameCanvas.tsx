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
  currentNeed: "food" | "water" | null;
  needTimeout?: number;
}

interface Item {
  id: string;
  type: "food" | "water";
  x: number;
  y: number;
  width: number;
  height: number;
  originalX: number;
  originalY: number;
  isDragging: boolean;
}

interface SpeechBubble {
  id: string;
  x: number;
  y: number;
  text: string;
  timestamp: number;
}

interface GameCanvasProps {
  onScoreChange: () => void;
  onTimeBonus: (seconds: number) => void;
  currentTime: number;
  onGameEnd: () => void;
}

export function GameCanvas({
  onScoreChange,
  onTimeBonus,
  currentTime,
  onGameEnd,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { score, level, gamePhase, endGame, levelUp } = useCatGame();
  const { playHit, playSuccess } = useAudio();

  const [cats, setCats] = useState<Cat[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [draggedItem, setDraggedItem] = useState<Item | null>(null);
  const [speechBubbles, setSpeechBubbles] = useState<SpeechBubble[]>([]);
  const [images, setImages] = useState<{ [key: string]: HTMLImageElement }>({});
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [gameStartTime, setGameStartTime] = useState<number>(Date.now());

  // Oda içindeki güvenli konumlar - yatak üstü, komodin üstü, yer
  const catPositions = [
    { x: 150, y: 380, name: "yatak_sol" },      // Yatak sol tarafı
    { x: 250, y: 380, name: "yatak_sag" },      // Yatak sağ tarafı
    { x: 320, y: 350, name: "komodin" },        // Komodin üstü
    { x: 80, y: 450, name: "yer_sol" },         // Yer sol
    { x: 200, y: 520, name: "yer_orta" },       // Yer orta
    { x: 300, y: 480, name: "yer_sag" },        // Yer sağ
  ];

  // Resimleri yükle
  useEffect(() => {
    const imageUrls = {
      rifki: "/Rifki.png",
      istanbul: "/istanbul.png", 
      food: "/mama.png",
      water: "/su.png",
      husnaNur: "/hus.png",
      room: "/oda.png",
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

  // Oyun başlangıcında kedileri ve öğeleri başlat
  useEffect(() => {
    if (gamePhase === "playing") {
      setGameStartTime(Date.now());
      
      const initialCats: Cat[] = [
        { 
          id: "rifki", 
          name: "Rifki", 
          x: catPositions[0].x, 
          y: catPositions[0].y, 
          width: 60, 
          height: 60, 
          currentNeed: null 
        },
        { 
          id: "istanbul", 
          name: "İstanbul", 
          x: catPositions[1].x, 
          y: catPositions[1].y, 
          width: 60, 
          height: 60, 
          currentNeed: null 
        },
      ];

      const initialItems: Item[] = [
        { 
          id: "food", 
          type: "food", 
          x: 50, 
          y: 600, 
          width: 50, 
          height: 50, 
          originalX: 50, 
          originalY: 600, 
          isDragging: false 
        },
        { 
          id: "water", 
          type: "water", 
          x: 120, 
          y: 600, 
          width: 50, 
          height: 50, 
          originalX: 120, 
          originalY: 600, 
          isDragging: false 
        },
      ];

      setCats(initialCats);
      setItems(initialItems);
    }
  }, [gamePhase]);

  // Oyun mantığı - talep üretme
  useEffect(() => {
    if (gamePhase !== 'playing') return;

    // İlk talep 2 saniye sonra
    const firstRequestTimeout = setTimeout(() => {
      generateRandomRequest();
    }, 2000);

    // Zorluk artışı sistemi
    const getRequestInterval = () => {
      const elapsedTime = (Date.now() - gameStartTime) / 1000;
      if (elapsedTime < 10) return 8000; // İlk 10 saniye: 8 saniye aralık
      if (elapsedTime < 30) return 6000; // 10-30 saniye: 6 saniye aralık
      if (elapsedTime < 60) return 4000; // 30-60 saniye: 4 saniye aralık
      return 3000; // 60+ saniye: 3 saniye aralık
    };

    let requestInterval: NodeJS.Timeout;
    
    const scheduleNextRequest = () => {
      requestInterval = setTimeout(() => {
        generateRandomRequest();
        scheduleNextRequest(); // Kendini tekrarla
      }, getRequestInterval());
    };

    scheduleNextRequest();

    return () => {
      clearTimeout(firstRequestTimeout);
      clearTimeout(requestInterval);
    };
  }, [gamePhase, gameStartTime]);

  // Oyun bitişi kontrolü
  useEffect(() => {
    if (currentTime <= 0 && gamePhase === "playing") {
      endGame();
    }
  }, [currentTime, gamePhase, endGame]);

  // Level up kontrolü
  useEffect(() => {
    if (score > 0 && score % 5 === 0) {
      levelUp();
    }
  }, [score, levelUp]);

  const generateRandomRequest = () => {
    // Mevcut ihtiyacı olmayan kedileri bul
    const availableCats = cats.filter(cat => !cat.currentNeed);
    if (availableCats.length === 0) return;

    const randomCat = availableCats[Math.floor(Math.random() * availableCats.length)];
    const randomNeed: "food" | "water" = Math.random() > 0.5 ? "food" : "water";
    
    // Kediyi yeni konuma taşı
    moveCatToNewPosition(randomCat.id);
    
    // İhtiyaç ekle
    setCats(prev => prev.map(cat => 
      cat.id === randomCat.id 
        ? { ...cat, currentNeed: randomNeed, needTimeout: Date.now() + 15000 }
        : cat
    ));

    // Diyalog göster
    showCatRequest(randomCat, randomNeed);
    
    // HusnaNur'un cevabını göster
    setTimeout(() => showHusnaNurResponse(randomCat), 1000);
  };

  const moveCatToNewPosition = (catId: string) => {
    setCats(prev => prev.map(cat => {
      if (cat.id === catId) {
        // Diğer kedinin olmadığı bir pozisyon seç
        const otherCat = prev.find(c => c.id !== catId);
        let availablePositions = catPositions;
        
        if (otherCat) {
          availablePositions = catPositions.filter(pos => 
            Math.abs(pos.x - otherCat.x) > 80 || Math.abs(pos.y - otherCat.y) > 80
          );
        }
        
        const newPosition = availablePositions[Math.floor(Math.random() * availablePositions.length)];
        return { ...cat, x: newPosition.x, y: newPosition.y };
      }
      return cat;
    }));
  };

  const showCatRequest = (cat: Cat, need: "food" | "water") => {
    const messages = {
      rifki: {
        food: ["Anne acıktım! Mama istiyorum!", "Karnım çok acıktı anne!", "Mama getirir misin anne?"],
        water: ["Anne susadım! Su istiyorum!", "Su verebilir misin anne?", "Çok susadım anne!"]
      },
      istanbul: {
        food: ["Anne mama istiyorum!", "Acıktım anne, mama getirir misin?", "Karnım acıktı anne!"],
        water: ["Anne su istiyorum!", "Susadım anne!", "Biraz su alabilir miyim anne?"]
      }
    };

    const catMessages = messages[cat.id as keyof typeof messages];
    const needMessages = catMessages[need];
    const randomMessage = needMessages[Math.floor(Math.random() * needMessages.length)];
    
    showSpeechBubble(cat.x + 30, cat.y - 30, randomMessage, "#FFE4B5");
  };

  const showHusnaNurResponse = (cat: Cat) => {
    const responses = {
      rifki: [
        "Tamam oğlum, hemen getiriyorum!",
        "Bekle Rifki, geliyorum!",
        "Tabii oğlum, hemen hazırlıyorum!"
      ],
      istanbul: [
        "Tamam İstanbul, bekle geliyorum!",
        "Hemen getiriyorum kızım!",
        "Sabret İstanbul, hazırlıyorum!"
      ]
    };

    const catResponses = responses[cat.id as keyof typeof responses];
    const randomResponse = catResponses[Math.floor(Math.random() * catResponses.length)];
    
    // HusnaNur'un konumu (sağ alt köşe)
    showSpeechBubble(300, 550, randomResponse, "#FFE4E1");
  };

  const showSpeechBubble = (x: number, y: number, text: string, color: string) => {
    const bubble: SpeechBubble = {
      id: `bubble_${Date.now()}_${Math.random()}`,
      x,
      y,
      text,
      timestamp: Date.now()
    };
    
    setSpeechBubbles(prev => [...prev, bubble]);
    
    // 3 saniye sonra baloncuğu kaldır
    setTimeout(() => {
      setSpeechBubbles(prev => prev.filter(b => b.id !== bubble.id));
    }, 3000);
  };

  const handleCorrectDelivery = (cat: Cat) => {
    onScoreChange();
    playSuccess();
    onTimeBonus(5); // 5 saniye bonus

    // Kedinin ihtiyacını karşıla
    setCats(prev => prev.map(c => 
      c.id === cat.id 
        ? { ...c, currentNeed: null, needTimeout: undefined } 
        : c
    ));

    // Teşekkür mesajı göster
    const thankMessages = {
      rifki: ["Teşekkürler anne!", "Çok lezzetliydi!", "Sağ ol anne!"],
      istanbul: ["Teşekkür ederim anne!", "Harika oldu!", "Çok güzeldi anne!"]
    };

    const catMessages = thankMessages[cat.id as keyof typeof thankMessages];
    const randomMessage = catMessages[Math.floor(Math.random() * catMessages.length)];
    
    showSpeechBubble(cat.x + 30, cat.y - 30, randomMessage, "#90EE90");

    // 2 saniye sonra yeni konuma taşı
    setTimeout(() => {
      moveCatToNewPosition(cat.id);
    }, 2000);
  };

  const handleWrongDelivery = (cat: Cat) => {
    playHit();
    
    const wrongMessages = {
      rifki: ["Bu değil anne!", "Yanlış getirdin anne!", "Ben onu istememiştim!"],
      istanbul: ["Anne bu değil!", "Yanlış anne!", "Ben başka bir şey istemiştim!"]
    };

    const catMessages = wrongMessages[cat.id as keyof typeof wrongMessages];
    const randomMessage = catMessages[Math.floor(Math.random() * catMessages.length)];
    
    showSpeechBubble(cat.x + 30, cat.y - 30, randomMessage, "#FFB6C1");
  };

  // Mouse/Touch eventi yardımcı fonksiyonları
  const getEventPos = (e: MouseEvent | Touch): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const isPointInRect = (point: { x: number; y: number }, rect: { x: number; y: number; width: number; height: number }) => {
    return (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    );
  };

  // Drag & Drop işlemleri
  const handleStart = (e: MouseEvent | Touch) => {
    if (gamePhase !== "playing") return;
    
    const pos = getEventPos(e);
    
    for (let item of items) {
      if (isPointInRect(pos, item)) {
        setDraggedItem(item);
        setItems(prev => prev.map(i => 
          i.id === item.id ? { ...i, isDragging: true } : i
        ));
        break;
      }
    }
  };

  const handleMove = (e: MouseEvent | Touch) => {
    if (draggedItem) {
      const pos = getEventPos(e);
      setDraggedItem({
        ...draggedItem,
        x: pos.x - draggedItem.width / 2,
        y: pos.y - draggedItem.height / 2
      });
    }
  };

  const handleEnd = (e: MouseEvent | Touch) => {
    if (!draggedItem || gamePhase !== "playing") return;

    // Kedilerin üzerine bırakıldı mı kontrol et
    for (let cat of cats) {
      if (isPointInRect(draggedItem, cat)) {
        if (cat.currentNeed && draggedItem.type === cat.currentNeed) {
          handleCorrectDelivery(cat);
        } else if (cat.currentNeed) {
          handleWrongDelivery(cat);
        }
        break;
      }
    }

    // Öğeyi orijinal yerine geri koy
    setItems(prev => prev.map(item => 
      item.id === draggedItem.id 
        ? { ...item, x: item.originalX, y: item.originalY, isDragging: false }
        : item
    ));
    
    setDraggedItem(null);
  };

  // Mouse events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseDown = (e: MouseEvent) => handleStart(e);
    const handleMouseMove = (e: MouseEvent) => { if (draggedItem) handleMove(e); };
    const handleMouseUp = (e: MouseEvent) => handleEnd(e);

    canvas.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggedItem, items, cats, gamePhase]);

  // Touch events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      handleStart(e.touches[0]);
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (draggedItem) handleMove(e.touches[0]);
    };
    
    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      handleEnd(e.changedTouches[0]);
    };

    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [draggedItem, items, cats, gamePhase]);

  // Çizim işlemi
  useEffect(() => {
    if (!imagesLoaded || gamePhase !== "playing") return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Arka plan (oda)
      if (images.room) {
        ctx.drawImage(images.room, 0, 0, canvas.width, canvas.height);
      }

      // Kedileri çiz
      cats.forEach(cat => {
        const catImage = images[cat.id];
        if (catImage) {
          ctx.drawImage(catImage, cat.x, cat.y, cat.width, cat.height);
          
          // Kedi ismini yaz
          ctx.fillStyle = "black";
          ctx.font = "bold 12px Arial";
          ctx.textAlign = "center";
          ctx.fillText(cat.name, cat.x + cat.width / 2, cat.y + cat.height + 15);
          
          // İhtiyaç ikonu göster
          if (cat.currentNeed) {
            const bounce = Math.sin(Date.now() * 0.005) * 3;
            ctx.fillStyle = cat.currentNeed === "food" ? "#FF6B6B" : "#4ECDC4";
            ctx.beginPath();
            ctx.arc(cat.x + cat.width - 10, cat.y + 10 + bounce, 8, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = "white";
            ctx.font = "12px Arial";
            ctx.textAlign = "center";
            const emoji = cat.currentNeed === "food" ? "🍽" : "💧";
            ctx.fillText(emoji, cat.x + cat.width - 10, cat.y + 15 + bounce);
          }
        }
      });

      // HusnaNur'u çiz
      if (images.husnaNur) {
        ctx.drawImage(images.husnaNur, 280, 520, 80, 100);
        ctx.fillStyle = "black";
        ctx.font = "bold 12px Arial";
        ctx.textAlign = "center";
        ctx.fillText("HusnaNur", 320, 635);
      }

      // Öğeleri çiz
      const allItems = [...items];
      if (draggedItem) allItems.push(draggedItem);

      allItems.forEach(item => {
        ctx.save();
        if (item.isDragging) {
          ctx.globalAlpha = 0.8;
          ctx.scale(1.1, 1.1);
          ctx.translate(-(item.width * 0.05), -(item.height * 0.05));
        }
        
        const itemImage = images[item.type];
        if (itemImage) {
          ctx.drawImage(itemImage, item.x, item.y, item.width, item.height);
        }
        
        ctx.restore();
      });

      if (gamePhase === "playing") {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }, [cats, items, draggedItem, images, imagesLoaded, gamePhase]);

  return (
    <div className="relative w-full h-full">
      <canvas 
        ref={canvasRef} 
        width={400} 
        height={700} 
        className="w-full h-full cursor-grab active:cursor-grabbing" 
        style={{ imageRendering: "pixelated" }} 
      />
      
      {/* Konuşma balonları */}
      {speechBubbles.map(bubble => (
        <div
          key={bubble.id}
          className="absolute bg-white border-2 border-gray-800 rounded-2xl p-2 text-xs font-bold z-40 pointer-events-none"
          style={{
            left: `${(bubble.x / 400) * 100}%`,
            top: `${(bubble.y / 700) * 100}%`,
            transform: "translate(-50%, calc(-100% - 10px))",
            animation: "bounce 0.5s",
            backgroundColor: "#fff",
            maxWidth: "150px"
          }}
        >
          <span>{bubble.text}</span>
          <div 
            className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0" 
            style={{ 
              borderLeft: "6px solid transparent", 
              borderRight: "6px solid transparent", 
              borderTop: "6px solid #333" 
            }} 
          />
          <div 
            className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 -mt-1" 
            style={{ 
              borderLeft: "4px solid transparent", 
              borderRight: "4px solid transparent", 
              borderTop: "4px solid white" 
            }} 
          />
        </div>
      ))}
    </div>
  );
}