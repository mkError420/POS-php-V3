import React, { useEffect, useRef } from 'react';

export default function BackgroundAnimation() {
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!wrapperRef.current) return;

    wrapperRef.current.innerHTML = ''; // Clean up on re-render

    const wrapper = wrapperRef.current;
    const canvas = document.createElement("canvas");
    canvas.id = "line-effect";
    wrapper.appendChild(canvas);

    const mouse = { x: -9999, y: -9999 };
    const linesFooter = [];
    let context;

    let horizontalPadding = 0;
    let verticalPadding = 0;

    const drawWaveEffect = (context, width, height) => {
      horizontalPadding = 0;
      verticalPadding = 0;

      // Increase line count for better resolution since the text will be smaller
      const linesCount = 90;
      const lineHeight = (height - verticalPadding * 2) / linesCount;
      const cellWidth = 4;
      const cols = Math.floor((width - horizontalPadding * 2) / cellWidth);

      // Make typeCanvas proportional to screen to map coordinates easily
      const scale = 0.25; 
      const typeCanvasWidth = Math.floor(width * scale);
      const typeCanvasHeight = Math.floor(height * scale);
      const typeCanvas = document.createElement("canvas");
      const typeContext = typeCanvas.getContext("2d");
      typeCanvas.width = typeCanvasWidth;
      typeCanvas.height = typeCanvasHeight;

      // Determine font size to fit inside the marking area (top-left)
      const fontSize = Math.max(16, typeCanvasWidth * 0.07); 
      typeContext.fillStyle = "black";
      typeContext.fillRect(0, 0, typeCanvasWidth, typeCanvasHeight);
      typeContext.fillStyle = "white";
      typeContext.font = `${fontSize}px Drukwide`;
      typeContext.textBaseline = "top";
      typeContext.textAlign = "left";
      
      // Position text in the top-left marking area (e.g. 5% from left, 8% from top)
      typeContext.fillText("CODEXAA", typeCanvasWidth * 0.05, typeCanvasHeight * 0.08);

      const typeData = typeContext.getImageData(
        0,
        0,
        typeCanvasWidth,
        typeCanvasHeight
      ).data;

      linesFooter.length = 0;
      for (let i = 0; i < linesCount; i++) {
        const y = verticalPadding + i * lineHeight;
        const line = [];

        for (let j = 0; j < cols; j++) {
          const x = horizontalPadding + j * cellWidth;

          const typeX = Math.floor((j / cols) * typeCanvasWidth);
          const typeY = Math.floor((i / linesCount) * typeCanvasHeight);
          const index = (typeY * typeCanvasWidth + typeX) * 4;
          const brightness = typeData[index] || 0;

          const heightOffset = (brightness / 255) * 20;
          const finalY = y - heightOffset;

          line.push({
            x,
            y: finalY,
            baseX: x,
            baseY: finalY,
          });
        }
        linesFooter.push(line);
      }
    };

    const updateLines = (mouseX, mouseY, radius = 100, maxSpeed = 10) => {
      linesFooter.forEach((lineFooter) => {
        lineFooter.forEach((point) => {
          const dx = point.x - mouseX;
          const dy = point.y - mouseY;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < radius) {
            const angle = Math.atan2(dy, dx);
            const force = (radius - distance) / radius;

            point.x += Math.cos(angle) * force * maxSpeed;
            point.y += Math.sin(angle) * force * maxSpeed;
          }

          const springX = (point.baseX - point.x) * 0.1;
          const springY = (point.baseY - point.y) * 0.1;

          point.x += springX;
          point.y += springY;
        });
      });
    };

    const drawLines = (context, width, height) => {
      context.clearRect(0, 0, width, height);

      linesFooter.forEach((lineFooter) => {
        context.beginPath();
        context.moveTo(lineFooter[0].x, lineFooter[0].y);

        for (let i = 1; i < lineFooter.length; i++) {
          const prev = lineFooter[i - 1];
          const current = lineFooter[i];

          const midX = (prev.x + current.x) / 2;
          const midY = (prev.y + current.y) / 2;

          context.quadraticCurveTo(prev.x, prev.y, midX, midY);
        }

        context.strokeStyle = "#ffdfc4";
        context.lineWidth = 0.5;
        context.stroke();
      });
    };

    const resizeCanvas = () => {
      const scaleFactor = window.devicePixelRatio || 1;
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;
      canvas.width = width * scaleFactor;
      canvas.height = height * scaleFactor;

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.scale(scaleFactor, scaleFactor);

      drawWaveEffect(context, width, height);
    };

    let animationFrameId;
    const animateFooterLines = () => {
      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);

      updateLines(mouse.x, mouse.y);
      drawLines(context, width, height);

      animationFrameId = requestAnimationFrame(animateFooterLines);
    };

    const waitForFonts = async () => {
      if (document.fonts) {
        try {
          await document.fonts.load(`1em Drukwide`);
        } catch (e) {
          console.error("error font:", e);
        }
      }
      resizeCanvas();
      animateFooterLines();
    };

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };

    const handleTouchMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      if (e.touches && e.touches.length > 0) {
        mouse.x = e.touches[0].clientX - rect.left;
        mouse.y = e.touches[0].clientY - rect.top;
      }
    };

    context = canvas.getContext("2d");

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("resize", resizeCanvas);

    waitForFonts();

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div
      className="footer_hover-effect fixed inset-0 z-0 pointer-events-none opacity-40"
      ref={wrapperRef}
    />
  );
}
