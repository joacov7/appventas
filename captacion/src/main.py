"""
Pipeline completo:
  1. Scrapea reseñas de Google Maps → filtra quejas → inserta leads en Neon
  2. Scrapea tiendas (Tiendanube / Empretienda) → detecta cambios de precio → envía alertas
"""

import sys
import logging
import smtplib
import os
from email.mime.text import MIMEText
from datetime import datetime
from pathlib import Path

LOG_PATH = Path(__file__).parent.parent / f"captacion_{datetime.now().strftime('%Y%m%d_%H%M')}.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(LOG_PATH, encoding="utf-8"),
    ],
)
log = logging.getLogger(__name__)

sys.path.insert(0, str(Path(__file__).parent))

from database import (
    crear_tabla, upsert_leads, listar_leads,
    crear_tablas_inteligencia, seed_busquedas_default, cargar_busquedas_activas, get_connection,
)
from scraper_maps import scrape_all
from filtrado import filtrar_y_generar
from scraper_tiendas import run_inteligencia


def enviar_alerta_precio(cambio: dict, producto: dict, tienda: dict):
    """Envía email de alerta cuando un competidor baja precio significativamente."""
    admin_email = os.getenv("ADMIN_EMAIL_TO")
    resend_key = os.getenv("RESEND_API_KEY")

    if not admin_email:
        log.warning("[ALERTA] ADMIN_EMAIL_TO no configurado, saltando email")
        return

    pct = cambio["pct"]
    signo = "↓" if pct < 0 else "↑"
    emoji = "🔴" if pct < 0 else "🟢"

    asunto = f"{emoji} Competidor bajó precio {abs(pct)}% — {producto['nombre'][:50]}"
    cuerpo = f"""
Alerta de cambio de precio — AppVentas Inteligencia

Tienda: {tienda['nombre']} ({tienda['url']})
Producto: {producto['nombre']}
Precio anterior: ${cambio['anterior']:,.0f}
Precio nuevo: ${cambio['nuevo']:,.0f}
Cambio: {signo} {abs(pct)}%
URL: {producto['url']}

---
Ver todos los precios en: /admin/inteligencia
    """.strip()

    # Usar Resend API via requests si está disponible
    if resend_key:
        try:
            import requests
            resp = requests.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {resend_key}", "Content-Type": "application/json"},
                json={
                    "from": "AppVentas <onboarding@resend.dev>",
                    "to": [admin_email],
                    "subject": asunto,
                    "text": cuerpo,
                },
                timeout=10,
            )
            if resp.status_code in (200, 201):
                log.info(f"[ALERTA] Email enviado: {asunto}")
            else:
                log.warning(f"[ALERTA] Resend error {resp.status_code}: {resp.text}")
        except Exception as e:
            log.error(f"[ALERTA] Error enviando email: {e}")
    else:
        log.info(f"[ALERTA] {asunto} (sin RESEND_API_KEY, no se envió email)")


def run():
    print("=" * 60)
    print("  PIPELINE COMPLETO — AppVentas")
    print("=" * 60)

    # ── MÓDULO 1: Captación de leads (Google Maps) ───────────────────────────
    print("\n▶ MÓDULO 1: Captación de leads")
    crear_tabla()

    print("\n  [1/3] Scrapeando Google Maps...")
    reviews = scrape_all()

    if reviews:
        print("\n  [2/3] Filtrando quejas...")
        leads = filtrar_y_generar(reviews)

        if leads:
            print(f"\n  [3/3] Insertando {len(leads)} leads...")
            insertados = upsert_leads(leads)
            print(f"  [OK] {insertados} leads guardados")
        else:
            print("  [INFO] Sin quejas que coincidan con palabras clave")
    else:
        print("  [WARN] Sin reseñas obtenidas")

    # ── MÓDULO 2: Inteligencia de precios ─────────────────────────────────────
    print("\n▶ MÓDULO 2: Inteligencia de precios")
    crear_tablas_inteligencia()
    seed_busquedas_default()

    busquedas = cargar_busquedas_activas()
    print(f"\n  {len(busquedas)} búsquedas activas")

    if busquedas:
        resumen = run_inteligencia(get_connection, busquedas, alertas_callback=enviar_alerta_precio)
        print(f"\n  [OK] Tiendas: {resumen['tiendas']} | Productos: {resumen['productos']} | Alertas: {resumen['alertas']}")
    else:
        print("  [INFO] Sin búsquedas configuradas")

    print("\n" + "=" * 60)
    print("  Pipeline completado")
    print("=" * 60)


if __name__ == "__main__":
    run()
