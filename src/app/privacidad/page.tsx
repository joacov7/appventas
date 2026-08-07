export const metadata = {
  title: "Política de Privacidad",
  description: "Política de privacidad y tratamiento de datos personales.",
};

export default function PrivacidadPage() {
  const actualizado = "julio de 2026";
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px", fontFamily: "-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif", color: "#1f2937", lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8 }}>Política de Privacidad</h1>
      <p style={{ color: "#6b7280", marginBottom: 28 }}>Última actualización: {actualizado}</p>

      <p style={{ marginBottom: 20 }}>
        Esta Política de Privacidad describe cómo recopilamos, usamos y protegemos la información
        de las personas que utilizan nuestra tienda online y nuestros canales de atención, incluido
        WhatsApp. Al utilizar nuestros servicios, aceptás las prácticas descritas en este documento.
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 28, marginBottom: 10 }}>1. Información que recopilamos</h2>
      <p>Podemos recopilar los siguientes datos cuando interactuás con nosotros:</p>
      <ul style={{ marginTop: 8, paddingLeft: 22 }}>
        <li>Datos de contacto (nombre, teléfono, correo electrónico).</li>
        <li>Datos de envío y facturación necesarios para procesar pedidos.</li>
        <li>Mensajes e interacciones a través de WhatsApp u otros canales de atención.</li>
        <li>Información de la compra (productos, montos, medios de pago).</li>
      </ul>

      <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 28, marginBottom: 10 }}>2. Cómo usamos la información</h2>
      <p>Utilizamos los datos únicamente para:</p>
      <ul style={{ marginTop: 8, paddingLeft: 22 }}>
        <li>Procesar y entregar tus pedidos.</li>
        <li>Responder consultas y brindar atención al cliente por WhatsApp y otros medios.</li>
        <li>Enviar información sobre el estado de tu compra.</li>
        <li>Mejorar nuestros productos y servicios.</li>
      </ul>

      <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 28, marginBottom: 10 }}>3. WhatsApp</h2>
      <p>
        Utilizamos la plataforma de WhatsApp Business para comunicarnos con vos. Los mensajes que
        intercambiás con nosotros por ese medio se procesan para responder tus consultas y gestionar
        tu compra. No compartimos el contenido de esas conversaciones con terceros ajenos a la
        prestación del servicio.
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 28, marginBottom: 10 }}>4. Compartir información</h2>
      <p>
        No vendemos ni cedemos tus datos personales. Solo compartimos información con proveedores que
        nos ayudan a operar (por ejemplo, procesadores de pago y servicios de envío), y únicamente en
        la medida necesaria para completar tu pedido.
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 28, marginBottom: 10 }}>5. Conservación y seguridad</h2>
      <p>
        Conservamos los datos durante el tiempo necesario para cumplir con las finalidades descritas y
        con nuestras obligaciones legales. Aplicamos medidas razonables de seguridad para proteger tu
        información.
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 28, marginBottom: 10 }}>6. Tus derechos</h2>
      <p>
        Podés solicitar el acceso, la rectificación o la eliminación de tus datos personales
        escribiéndonos por nuestros canales de contacto. Atenderemos tu solicitud conforme a la
        normativa vigente.
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 28, marginBottom: 10 }}>7. Cambios en esta política</h2>
      <p>
        Podemos actualizar esta Política de Privacidad periódicamente. Publicaremos cualquier cambio en
        esta misma página, indicando la fecha de última actualización.
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 28, marginBottom: 10 }}>8. Contacto</h2>
      <p>
        Si tenés preguntas sobre esta Política de Privacidad o sobre el tratamiento de tus datos,
        podés contactarnos a través de los medios de contacto publicados en nuestra tienda.
      </p>
    </main>
  );
}
