"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ArrowRight } from "lucide-react";

interface Slide {
  id: string;
  imageUrl: string;
  title: string | null;
  subtitle: string | null;
  buttonText: string | null;
  buttonUrl: string | null;
}

interface HeroSliderProps {
  slides: Slide[];
}

export function HeroSlider({ slides }: HeroSliderProps) {
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => setCurrent((c) => (c + 1) % slides.length), [slides.length]);
  const prev = () => setCurrent((c) => (c - 1 + slides.length) % slides.length);

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = setInterval(next, 5000);
    return () => clearInterval(id);
  }, [next, slides.length]);

  if (slides.length === 0) return null;

  const slide = slides[current];

  return (
    <section className="relative w-full overflow-hidden bg-gray-900" style={{ height: "clamp(280px, 55vw, 600px)" }}>
      {/* Imagen */}
      <Image
        key={slide.id}
        src={slide.imageUrl}
        alt={slide.title ?? ""}
        fill
        className="object-cover transition-opacity duration-700"
        priority
        sizes="100vw"
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent" />

      {/* Contenido */}
      {(slide.title || slide.subtitle || slide.buttonText) && (
        <div className="absolute inset-0 flex items-center">
          <div className="px-8 sm:px-16 max-w-2xl space-y-4">
            {slide.title && (
              <h1 className="text-3xl sm:text-5xl font-bold text-white leading-tight drop-shadow">
                {slide.title}
              </h1>
            )}
            {slide.subtitle && (
              <p className="text-base sm:text-xl text-white/90 drop-shadow">
                {slide.subtitle}
              </p>
            )}
            {slide.buttonText && slide.buttonUrl && (
              <Link
                href={slide.buttonUrl}
                className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-xl font-semibold transition-colors shadow-lg"
              >
                {slide.buttonText} <ArrowRight size={18} />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Flechas */}
      {slides.length > 1 && (
        <>
          <button onClick={prev}
            className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 backdrop-blur-sm text-white rounded-full p-2 transition-colors">
            <ChevronLeft size={22} />
          </button>
          <button onClick={next}
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 backdrop-blur-sm text-white rounded-full p-2 transition-colors">
            <ChevronRight size={22} />
          </button>

          {/* Puntos */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {slides.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)}
                className={`w-2 h-2 rounded-full transition-all ${i === current ? "bg-white w-6" : "bg-white/50"}`} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
