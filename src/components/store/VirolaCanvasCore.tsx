"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from "react";

const CANVAS_SIZE = 500;
const RING_OUTER = 220;
const RING_INNER = 80;

export interface VirolaCanvasHandle {
  toDataURL: () => string;
  toJSON: () => object;
  loadJSON: (json: object) => Promise<void>;
  getCanvas: () => any;
}

interface Props {
  bgColor: string;
  onReady?: () => void;
  onModified?: () => void;
}

export const VirolaCanvasCore = forwardRef<VirolaCanvasHandle, Props>(function VirolaCanvasCore(
  { bgColor, onReady, onModified },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    toDataURL() {
      const { canvas, Circle } = fabricRef.current ?? {};
      if (!canvas) return "";
      const orig = canvas.clipPath;
      canvas.clipPath = undefined;
      canvas.renderAll();
      const url = canvas.toDataURL({ format: "png", multiplier: 1 });
      canvas.clipPath = orig;
      canvas.renderAll();
      return url;
    },
    toJSON() {
      return fabricRef.current?.canvas?.toJSON() ?? {};
    },
    async loadJSON(json: object) {
      const { canvas } = fabricRef.current ?? {};
      if (!canvas) return;
      await canvas.loadFromJSON(json);
      canvas.renderAll();
    },
    getCanvas() {
      return fabricRef.current?.canvas;
    },
  }));

  useEffect(() => {
    let cancelled = false;
    import("fabric").then(({ Canvas, Circle }) => {
      if (cancelled || !canvasRef.current) return;

      const canvas = new Canvas(canvasRef.current, {
        width: CANVAS_SIZE,
        height: CANVAS_SIZE,
        backgroundColor: bgColor,
      });

      const clip = new Circle({
        radius: RING_OUTER,
        originX: "center", originY: "center",
        left: CANVAS_SIZE / 2, top: CANVAS_SIZE / 2,
        absolutePositioned: true,
      });
      canvas.clipPath = clip;

      canvas.on("after:render", ({ ctx }: { ctx: CanvasRenderingContext2D }) => {
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.beginPath();
        ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, RING_INNER, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        ctx.beginPath();
        ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, RING_INNER, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(100,100,100,0.5)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, RING_OUTER, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(100,100,100,0.5)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      });

      if (onModified) {
        canvas.on("object:modified", onModified);
        canvas.on("object:added", onModified);
        canvas.on("object:removed", onModified);
      }

      fabricRef.current = { canvas, Circle };
      onReady?.();
    });
    return () => {
      cancelled = true;
      fabricRef.current?.canvas?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const canvas = fabricRef.current?.canvas;
    if (!canvas) return;
    canvas.backgroundColor = bgColor;
    canvas.renderAll();
  }, [bgColor]);

  return <canvas ref={canvasRef} />;
});
