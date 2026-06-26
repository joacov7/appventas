"""
Filtra reseñas negativas con palabras clave comerciales
y genera mensajes de abordaje personalizados.
"""

PALABRAS_CLAVE = [
    "demora", "tardaron", "tardó", "tarde",
    "pedido mínimo", "mínimo",
    "stock", "sin stock", "no tenían",
    "atención", "mal trato", "maleducado", "no responden",
    "fallado", "roto", "rajado", "astillado", "madera mala",
    "bombilla tapada", "bombilla obstruida", "bombilla rota",
    "envío", "flete", "llegó roto", "llegó mal",
    "calidad", "mala calidad", "barato", "se rompe",
    "caro", "precio", "no vale",
    "incumplimiento", "no entregaron", "no llegó",
]

# Mapeo problema → mensaje de abordaje
MENSAJES = {
    "demora|tardaron|tardó|tarde|no llegó|no entregaron|incumplimiento": (
        "Hola {autor}, vi que tuviste problemas con los tiempos de entrega de tu proveedor. "
        "En AppVentas trabajamos con stock disponible y despacho en 24-48hs. "
        "¿Te gustaría conocer nuestro catálogo de mates, bombillas y tablas? {url}"
    ),
    "pedido mínimo|mínimo": (
        "Hola {autor}, si el pedido mínimo es un obstáculo para vos, en AppVentas no tenemos "
        "esa restricción. Podés comprar las unidades que necesitás. "
        "Conocé nuestro catálogo: {url}"
    ),
    "stock|sin stock|no tenían": (
        "Hola {autor}, los problemas de stock son frustrantes cuando querés vender. "
        "En AppVentas mantenemos stock permanente de mates, tablas y bombillas. "
        "Mirá nuestra oferta mayorista: {url}"
    ),
    "rajado|astillado|madera mala|fallado|roto|mala calidad|se rompe|calidad": (
        "Hola {autor}, lamentamos que hayas recibido productos de baja calidad. "
        "Nuestros mates y tablas son seleccionados artesanalmente. "
        "Te invitamos a conocer la diferencia: {url}"
    ),
    "bombilla tapada|bombilla obstruida|bombilla rota": (
        "Hola {autor}, una bombilla de mala calidad arruina la experiencia del cliente. "
        "En AppVentas ofrecemos bombillas de acero inoxidable con garantía. "
        "Conocé nuestro catálogo: {url}"
    ),
    "atención|mal trato|maleducado|no responden": (
        "Hola {autor}, la atención al cliente es clave en este rubro. "
        "En AppVentas nos comprometemos a responderte siempre el mismo día. "
        "¿Charlamos? {url}"
    ),
    "envío|flete|llegó roto|llegó mal": (
        "Hola {autor}, los problemas de envío generan devoluciones y pérdidas. "
        "En AppVentas embalamos con cuidado y trabajamos con logística confiable. "
        "Conocé nuestro catálogo: {url}"
    ),
    "caro|precio|no vale": (
        "Hola {autor}, entendemos que el precio es clave para la rentabilidad. "
        "En AppVentas manejamos precios mayoristas competitivos sin sacrificar calidad. "
        "Pedí nuestra lista de precios: {url}"
    ),
}

APP_URL = "https://appventas-iota.vercel.app"


def detectar_problema(texto: str) -> str | None:
    texto_lower = texto.lower()
    for patron in MENSAJES:
        palabras = patron.split("|")
        if any(p in texto_lower for p in palabras):
            return patron
    return None


def generar_mensaje(patron: str, autor: str) -> str:
    template = MENSAJES[patron]
    return template.format(autor=autor, url=APP_URL)


def filtrar_y_generar(reviews: list[dict]) -> list[dict]:
    """
    Recibe lista de reseñas y devuelve solo las que son leads válidos
    con su mensaje de abordaje generado.
    """
    leads = []

    for r in reviews:
        # Solo reseñas negativas (1-3 estrellas)
        if r.get("calificacion", 5) > 3:
            continue

        texto = r.get("texto_queja", "")
        if not texto or len(texto) < 15:
            continue

        patron = detectar_problema(texto)
        if not patron:
            continue

        mensaje = generar_mensaje(patron, r["autor"])

        leads.append({
            **r,
            "mensaje_abordaje": mensaje,
        })

    print(f"[FILTRADO] {len(reviews)} reseñas → {len(leads)} leads válidos")
    return leads


if __name__ == "__main__":
    # Test con datos simulados
    reviews_test = [
        {
            "autor": "María González",
            "calificacion": 2,
            "texto_queja": "Pedí mates de madera y llegaron rajados, pésima calidad.",
            "url_perfil": "https://maps.google.com/contrib/12345",
            "competidor": "Regalería Ejemplo",
        },
        {
            "autor": "Carlos Pérez",
            "calificacion": 1,
            "texto_queja": "Tardaron 3 semanas en enviarme el pedido y sin respuesta.",
            "url_perfil": "https://maps.google.com/contrib/67890",
            "competidor": "Bazar Regional Ejemplo",
        },
        {
            "autor": "Laura Torres",
            "calificacion": 5,
            "texto_queja": "Excelente atención, muy recomendable.",
            "url_perfil": "https://maps.google.com/contrib/11111",
            "competidor": "Regalería Ejemplo",
        },
        {
            "autor": "Roberto Silva",
            "calificacion": 2,
            "texto_queja": "La bombilla vino tapada y no me quisieron cambiar.",
            "url_perfil": "https://maps.google.com/contrib/22222",
            "competidor": "Bazar Regional Ejemplo",
        },
        {
            "autor": "Ana Martínez",
            "calificacion": 3,
            "texto_queja": "El pedido mínimo es altísimo para un local chico como el mío.",
            "url_perfil": "https://maps.google.com/contrib/33333",
            "competidor": "Regalería Ejemplo",
        },
    ]

    leads = filtrar_y_generar(reviews_test)
    for lead in leads:
        print(f"\n👤 {lead['autor']} ({lead['calificacion']}⭐) — {lead['competidor']}")
        print(f"   Queja: {lead['texto_queja'][:80]}...")
        print(f"   Mensaje: {lead['mensaje_abordaje'][:100]}...")
