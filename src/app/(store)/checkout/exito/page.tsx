"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ReferralShare } from "@/components/store/ReferralShare";

function ExitoContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("external_reference");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    // Email is stored in sessionStorage by the checkout flow
    const stored = sessionStorage.getItem("checkout_email");
    if (stored) {
      setEmail(stored);
      sessionStorage.removeItem("checkout_email");
    }
  }, []);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="text-center space-y-5 max-w-md w-full">
        <CheckCircle size={64} className="text-emerald-500 mx-auto" strokeWidth={1.5} />
        <h1 className="text-2xl font-bold text-gray-900">¡Pago aprobado!</h1>
        <p className="text-gray-500">
          Tu compra fue procesada con éxito. Recibirás un email de confirmación en breve.
        </p>
        {orderId && (
          <p className="text-xs text-gray-400 font-mono bg-gray-50 px-3 py-2 rounded-lg">
            Orden: {orderId.slice(0, 8)}…
          </p>
        )}
        {email && <ReferralShare email={email} />}
        <Link href="/">
          <Button size="lg">Seguir comprando</Button>
        </Link>
      </div>
    </div>
  );
}

export default function ExitoPage() {
  return (
    <Suspense>
      <ExitoContent />
    </Suspense>
  );
}
