import Link from "next/link";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function PendientePage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center space-y-5 max-w-md">
        <Clock size={64} className="text-amber-500 mx-auto" strokeWidth={1.5} />
        <h1 className="text-2xl font-bold text-gray-900">Pago pendiente</h1>
        <p className="text-gray-500">
          Tu pago está siendo procesado. Te avisaremos por email cuando se confirme.
        </p>
        <Link href="/">
          <Button variant="secondary" size="lg">Volver al inicio</Button>
        </Link>
      </div>
    </div>
  );
}
