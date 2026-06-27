"use client";

import { MessageCircle } from "lucide-react";

const WA_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";

export function buildWaLink(message: string) {
  const num = WA_NUMBER.replace(/\D/g, "");
  const encoded = encodeURIComponent(message.trim());
  return `https://wa.me/${num}?text=${encoded}`;
}

interface WhatsAppButtonProps {
  message?: string;
  label?: string;
  variant?: "floating" | "inline";
}

export function WhatsAppButton({
  message = "Hola, me gustaría consultar sobre sus productos.",
  label = "Consultá por WhatsApp",
  variant = "floating",
}: WhatsAppButtonProps) {
  if (!WA_NUMBER) return null;

  const href = buildWaLink(message);

  if (variant === "floating") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contactar por WhatsApp"
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 group"
      >
        {/* Versión expandida en hover (desktop) */}
        <span className="hidden md:flex items-center gap-2.5 pl-4 pr-5 py-3">
          <MessageCircle size={22} fill="white" strokeWidth={0} />
          <span className="font-medium text-sm whitespace-nowrap">{label}</span>
        </span>
        {/* Solo ícono (mobile) */}
        <span className="flex md:hidden items-center justify-center w-14 h-14">
          <MessageCircle size={26} fill="white" strokeWidth={0} />
        </span>
        {/* Ping animado */}
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white" />
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-medium text-sm px-5 py-3 rounded-xl transition-colors w-full"
    >
      <MessageCircle size={18} fill="white" strokeWidth={0} />
      {label}
    </a>
  );
}
