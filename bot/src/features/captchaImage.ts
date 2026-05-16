import { createCanvas } from "@napi-rs/canvas";

/** PNG avec distorsion léger pour anti-bot léger ; le même code doit être lu et retapé par l’humain. */
export function renderCaptchaImagePng(code: string): Buffer {
  const text = code.trim().toUpperCase();
  if (!text) {
    throw new Error("Captcha vide.");
  }

  const width = 300;
  const height = 110;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#1f2023";
  ctx.fillRect(0, 0, width, height);

  ctx.lineWidth = 1.75;
  for (let i = 0; i < 8; i++) {
    ctx.strokeStyle = `rgba(180, 200, 255, ${0.08 + Math.random() * 0.15})`;
    ctx.beginPath();
    ctx.moveTo(0, Math.random() * height);
    ctx.bezierCurveTo(
      width * 0.25,
      Math.random() * height,
      width * 0.75,
      Math.random() * height,
      width,
      Math.random() * height,
    );
    ctx.stroke();
  }

  const chars = [...text];
  const step = 40;
  const baseX = (width - (chars.length - 1) * step) / 2 - 10;

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!;
    ctx.save();
    ctx.translate(baseX + i * step, 68);
    ctx.rotate((Math.random() - 0.5) * 0.75);
    ctx.fillStyle = `hsl(${200 + Math.random() * 80}, ${60 + Math.random() * 25}%, ${62 + Math.random() * 18}%)`;
    ctx.font = "bold 44px sans-serif";
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 4;
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  }

  for (let i = 0; i < 45; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.05 + Math.random() * 0.1})`;
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 0.8 + Math.random() * 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas.toBuffer("image/png");
}
