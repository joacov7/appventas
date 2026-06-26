"""
Demo de punta a punta sin scraping real.
Simula reseñas → filtra → inserta en Neon → muestra resultado.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from database import crear_tabla, upsert_leads, listar_leads
from filtrado import filtrar_y_generar

REVIEWS_SIMULADAS = [
    {"autor": "María González",  "calificacion": 2, "texto_queja": "Pedí mates de madera y llegaron todos rajados. Pésima calidad de origen.",         "url_perfil": "https://maps.google.com/contrib/1001", "competidor": "Regalería Centro"},
    {"autor": "Carlos Pérez",    "calificacion": 1, "texto_queja": "Tardaron 3 semanas en despachar y nunca respondieron los mensajes.",               "url_perfil": "https://maps.google.com/contrib/1002", "competidor": "Bazar Regional Sur"},
    {"autor": "Laura Torres",    "calificacion": 5, "texto_queja": "Excelente atención, muy recomendable. Volvería a comprar sin dudas.",               "url_perfil": "https://maps.google.com/contrib/1003", "competidor": "Regalería Centro"},
    {"autor": "Roberto Silva",   "calificacion": 2, "texto_queja": "La bombilla vino completamente tapada y no quisieron hacerse cargo del cambio.",    "url_perfil": "https://maps.google.com/contrib/1004", "competidor": "Bazar Regional Sur"},
    {"autor": "Ana Martínez",    "calificacion": 3, "texto_queja": "El pedido mínimo es altísimo para un local pequeño como el mío. No es viable.",    "url_perfil": "https://maps.google.com/contrib/1005", "competidor": "Regalería Centro"},
    {"autor": "Diego Romero",    "calificacion": 1, "texto_queja": "Me mandaron tablas con la madera astillada y rajada. Inaceptable para revender.",  "url_perfil": "https://maps.google.com/contrib/1006", "competidor": "Distribuidora Norte"},
    {"autor": "Sofía Herrera",   "calificacion": 2, "texto_queja": "Siempre tienen problemas de stock. Nunca tienen lo que uno necesita a tiempo.",    "url_perfil": "https://maps.google.com/contrib/1007", "competidor": "Distribuidora Norte"},
    {"autor": "Martín López",    "calificacion": 4, "texto_queja": "Buen producto aunque un poco caro. El envío llegó bien embalado.",                  "url_perfil": "https://maps.google.com/contrib/1008", "competidor": "Bazar Regional Sur"},
    {"autor": "Paula Díaz",      "calificacion": 1, "texto_queja": "El envío llegó completamente roto. El embalaje era paupérrimo.",                    "url_perfil": "https://maps.google.com/contrib/1009", "competidor": "Regalería Centro"},
    {"autor": "Héctor Vargas",   "calificacion": 2, "texto_queja": "Los precios son muy caros para la calidad que ofrecen. No volvería a comprar.",     "url_perfil": "https://maps.google.com/contrib/1010", "competidor": "Distribuidora Norte"},
]

def run_demo():
    print("=" * 60)
    print("  DEMO DE CAPTACIÓN — Simulación punta a punta")
    print("=" * 60)

    # 1. Crear tabla
    print("\n[1/4] Verificando tabla en Neon...")
    crear_tabla()

    # 2. Filtrar
    print("\n[2/4] Filtrando reseñas simuladas...")
    leads = filtrar_y_generar(REVIEWS_SIMULADAS)

    # 3. Mostrar leads generados
    print(f"\n[3/4] Leads válidos encontrados: {len(leads)}")
    print("─" * 60)
    for lead in leads:
        print(f"\n  👤  {lead['autor']}  ({lead['calificacion']}⭐)  —  {lead['competidor']}")
        print(f"  💬  {lead['texto_queja'][:75]}...")
        print(f"  📩  {lead['mensaje_abordaje'][:90]}...")

    # 4. Insertar en Neon
    print(f"\n[4/4] Insertando en Neon (UPSERT)...")
    insertados = upsert_leads(leads)
    print(f"  ✅  {insertados} leads guardados en leads_captacion.")

    # 5. Leer de vuelta para confirmar
    print("\n─── TABLA leads_captacion (últimos registros) ───────────")
    rows = listar_leads()
    print(f"  {'ID':<5} {'Autor':<20} {'★':<3} {'Competidor':<22} {'Estado':<10} Fecha")
    print("  " + "─" * 70)
    for row in rows:
        fecha = row[5].strftime("%d/%m %H:%M") if row[5] else "—"
        print(f"  {row[0]:<5} {str(row[1]):<20} {str(row[2]):<3} {str(row[3]):<22} {str(row[4]):<10} {fecha}")

    print("\n  🎉  Demo completado con éxito.\n")

if __name__ == "__main__":
    run_demo()
