import json
import time
import random
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

COMPETIDORES_PATH = Path(__file__).parent.parent / "config" / "competidores.json"
MAX_REVIEWS = 50


def cargar_competidores() -> list[dict]:
    with open(COMPETIDORES_PATH, encoding="utf-8") as f:
        return json.load(f)


def scroll_reviews(page, cantidad: int = MAX_REVIEWS):
    """Hace scroll en el panel de reseñas hasta cargar la cantidad deseada."""
    try:
        # Esperar el panel de reseñas
        panel = page.locator('div[role="feed"]').first
        for _ in range(cantidad // 5):
            panel.evaluate("el => el.scrollBy(0, 1500)")
            time.sleep(random.uniform(0.8, 1.5))
    except Exception as e:
        print(f"  [WARN] scroll: {e}")


def extraer_reviews(page, nombre_competidor: str) -> list[dict]:
    """Extrae autor, calificación, texto y url de perfil de cada reseña."""
    reviews = []
    try:
        tarjetas = page.locator('div[data-review-id]').all()
        print(f"  [INFO] {len(tarjetas)} reseñas encontradas para {nombre_competidor}")

        for tarjeta in tarjetas[:MAX_REVIEWS]:
            try:
                # Expandir "más" si está truncado
                ver_mas = tarjeta.locator('button[aria-label="Ver más"]')
                if ver_mas.count() > 0:
                    ver_mas.first.click()
                    time.sleep(0.3)

                autor = tarjeta.locator('[class*="d4r55"]').first.inner_text(timeout=2000)

                # Calificación: contar estrellas llenas
                estrellas = tarjeta.locator('span[role="img"][aria-label]').first
                aria = estrellas.get_attribute("aria-label") if estrellas.count() > 0 else ""
                calificacion = int(aria[0]) if aria and aria[0].isdigit() else 0

                texto = tarjeta.locator('[class*="wiI7pd"]').first.inner_text(timeout=2000)

                # URL de perfil del autor
                link = tarjeta.locator('a[href*="contrib"]')
                url_perfil = link.first.get_attribute("href") if link.count() > 0 else f"sin_url_{autor}"

                reviews.append({
                    "autor": autor.strip(),
                    "calificacion": calificacion,
                    "texto_queja": texto.strip(),
                    "url_perfil": url_perfil or f"sin_url_{autor}",
                    "competidor": nombre_competidor,
                })
            except Exception as e:
                print(f"  [WARN] tarjeta omitida: {e}")
                continue

    except Exception as e:
        print(f"  [ERROR] extraer_reviews: {e}")

    return reviews


def scrapear_competidor(page, competidor: dict) -> list[dict]:
    nombre = competidor["nombre"]
    url = competidor["url"]
    print(f"\n[SCRAPER] Procesando: {nombre}")

    try:
        page.goto(url, timeout=30000, wait_until="domcontentloaded")
        time.sleep(2)

        # Aceptar cookies si aparece el dialogo
        try:
            page.locator('button:has-text("Aceptar todo")').click(timeout=3000)
            time.sleep(1)
        except Exception:
            pass

        # Click en pestaña de reseñas
        try:
            page.locator('button[aria-label*="eseña"], button[aria-label*="eview"]').first.click(timeout=5000)
            time.sleep(1.5)
        except Exception:
            print("  [WARN] No se pudo clickear pestaña de reseñas, intentando continuar...")

        # Ordenar por más recientes
        try:
            page.locator('button[aria-label*="rdenar"], button[data-value="sort"]').first.click(timeout=5000)
            time.sleep(0.8)
            page.locator('[data-index="1"], [aria-label*="eciente"]').first.click(timeout=3000)
            time.sleep(1.5)
        except Exception:
            print("  [WARN] No se pudo ordenar por recientes")

        scroll_reviews(page)
        return extraer_reviews(page, nombre)

    except PlaywrightTimeout:
        print(f"  [ERROR] Timeout al cargar {url}")
        return []
    except Exception as e:
        print(f"  [ERROR] {nombre}: {e}")
        return []


def scrape_all() -> list[dict]:
    competidores = cargar_competidores()
    todas_reviews = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
            locale="es-AR",
        )
        page = context.new_page()

        for competidor in competidores:
            reviews = scrapear_competidor(page, competidor)
            todas_reviews.extend(reviews)
            time.sleep(random.uniform(2, 4))  # pausa entre competidores

        browser.close()

    print(f"\n[SCRAPER] Total reseñas extraídas: {len(todas_reviews)}")
    return todas_reviews


if __name__ == "__main__":
    reviews = scrape_all()
    for r in reviews[:3]:
        print(r)
