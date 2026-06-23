import Link from "next/link";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function FalloPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center space-y-5 max-w-md">
        <XCircle size={64} className="text-red-500 mx-auto" strokeWidth={1.5} />
        <h1 className="text-2xl font-bold text-gray-900">Pago rechazado</h1>
        <p className="text-gray-500">
          Hubo un problema con el pago. Podés intentarlo nuevamente o elegir otro medio.
        </p>
        <Link href="/checkout">
          <Button variant="danger" size="lg">Reintentar pago</Button>
        </Link>
        <div>
          <Link href="/" className="text-sm text-gray-400 hover:underline">Volver al inicio</Link>
        </div>
      </div>
    </div>
  );
}
