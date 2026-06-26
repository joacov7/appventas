import json
import time
import random
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

COMPETIDORES_PATH = Path(__file__).parent.parent / "config" / "competidores.json"
MAX_REVIEWS = 30
MAX_NEGOCIOS_DEFAULT = 5


def cargar_busquedas() -> list[dict]:
    with open(COMPETIDORES_PATH, encoding="utf-8") as f:
        return json.load(f)


def buscar_negocios(page, termino: str, max_negocios: int) -> list[dict]:
    """Busca negocios en Google Maps por término y devuelve lista de {nombre, url}."""
    negocios = []
    url_busqueda = f"https://www.google.com/maps/search/{termino.replace(' ', '+')}"
    print(f"\n[BÚSQUEDA] {termino}")

    try:
        page.goto(url_busqueda, timeout=30000, wait_until="domcontentloaded")
        time.sleep(3)

        # Aceptar cookies
        try:
            page.locator('button:has-text("Aceptar todo")').click(timeout=3000)
            time.sleep(1)
        except Exception:
            pass

        # Esperar resultados
        page.wait_for_selector('div[role="feed"] a[href*="/maps/place/"]', timeout=10000)

        # Scroll para cargar más resultados
        feed = page.locator('div[role="feed"]').first
        for _ in range(3):
            feed.evaluate("el => el.scrollBy(0, 1000)")
            time.sleep(1)

        # Extraer links de negocios
        links = page.locator('div[role="feed"] a[href*="/maps/place/"]').all()
        vistos = set()

        for link in links:
            if len(negocios) >= max_negocios:
                break
            try:
                href = link.get_attribute("href")
                nombre = link.get_attribute("aria-label") or link.inner_text(timeout=1000)
                if href and href not in vistos and nombre:
                    vistos.add(href)
                    negocios.append({"nombre": nombre.strip(), "url": href})
            except Exception:
                continue

        print(f"  [INFO] {len(negocios)} negocios encontrados")

    except Exception as e:
        print(f"  [ERROR] búsqueda '{termino}': {e}")

    return negocios


def scroll_reviews(page):
    try:
        panel = page.locator('div[role="feed"]').first
        for _ in range(MAX_REVIEWS // 5):
            panel.evaluate("el => el.scrollBy(0, 1500)")
            time.sleep(random.uniform(0.8, 1.5))
    except Exception as e:
        print(f"  [WARN] scroll: {e}")


def extraer_reviews(page, nombre_competidor: str) -> list[dict]:
    reviews = []
    try:
        tarjetas = page.locator('div[data-review-id]').all()
        print(f"  [INFO] {len(tarjetas)} reseñas en {nombre_competidor}")

        for tarjeta in tarjetas[:MAX_REVIEWS]:
            try:
                ver_mas = tarjeta.locator('button[aria-label="Ver más"]')
                if ver_mas.count() > 0:
                    ver_mas.first.click()
                    time.sleep(0.3)

                autor = tarjeta.locator('[class*="d4r55"]').first.inner_text(timeout=2000)

                estrellas = tarjeta.locator('span[role="img"][aria-label]').first
                aria = estrellas.get_attribute("aria-label") if estrellas.count() > 0 else ""
                calificacion = int(aria[0]) if aria and aria[0].isdigit() else 0

                texto = tarjeta.locator('[class*="wiI7pd"]').first.inner_text(timeout=2000)

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


def scrapear_negocio(page, negocio: dict) -> list[dict]:
    nombre = negocio["nombre"]
    url = negocio["url"]
    print(f"\n  [NEGOCIO] {nombre}")

    try:
        page.goto(url, timeout=30000, wait_until="domcontentloaded")
        time.sleep(2)

        # Click en pestaña de reseñas
        try:
            page.locator('button[aria-label*="eseña"], button[aria-label*="eview"]').first.click(timeout=5000)
            time.sleep(1.5)
        except Exception:
            print("    [WARN] No se encontró pestaña de reseñas")
            return []

        # Ordenar por más recientes
        try:
            page.locator('button[aria-label*="rdenar"], button[data-value="sort"]').first.click(timeout=5000)
            time.sleep(0.8)
            page.locator('[data-index="1"], [aria-label*="eciente"]').first.click(timeout=3000)
            time.sleep(1.5)
        except Exception:
            pass

        scroll_reviews(page)
        return extraer_reviews(page, nombre)

    except PlaywrightTimeout:
        print(f"    [ERROR] Timeout: {url}")
        return []
    except Exception as e:
        print(f"    [ERROR] {nombre}: {e}")
        return []


def scrape_all() -> list[dict]:
    busquedas = cargar_busquedas()
    todas_reviews = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
            locale="es-AR",
        )
        page = context.new_page()

        negocios_vistos = set()

        for item in busquedas:
            termino = item["busqueda"]
            max_neg = item.get("max_negocios", MAX_NEGOCIOS_DEFAULT)

            negocios = buscar_negocios(page, termino, max_neg)
            time.sleep(random.uniform(2, 3))

            for negocio in negocios:
                if negocio["url"] in negocios_vistos:
                    continue
                negocios_vistos.add(negocio["url"])

                reviews = scrapear_negocio(page, negocio)
                todas_reviews.extend(reviews)
                time.sleep(random.uniform(2, 4))

        browser.close()

    print(f"\n[SCRAPER] Total reseñas extraídas: {len(todas_reviews)}")
    return todas_reviews


if __name__ == "__main__":
    reviews = scrape_all()
    for r in reviews[:3]:
        print(r)
