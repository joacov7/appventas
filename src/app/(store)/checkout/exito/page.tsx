import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Props {
  searchParams: Promise<{ payment_id?: string; external_reference?: string; status?: string }>;
}

export default async function ExitoPage({ searchParams }: Props) {
  const params = await searchParams;
  const orderId = params.external_reference;

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center space-y-5 max-w-md">
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
        <Link href="/">
          <Button size="lg">Seguir comprando</Button>
        </Link>
      </div>
    </div>
  );
}
