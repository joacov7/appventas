import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function ExitoPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center space-y-5 max-w-md">
        <CheckCircle size={64} className="text-emerald-500 mx-auto" strokeWidth={1.5} />
        <h1 className="text-2xl font-bold text-gray-900">¡Pago aprobado!</h1>
        <p className="text-gray-500">
          Tu compra fue procesada con éxito. Recibirás un email de confirmación en breve.
        </p>
        <Link href="/">
          <Button size="lg">Seguir comprando</Button>
        </Link>
      </div>
    </div>
  );
}
