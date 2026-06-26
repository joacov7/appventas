"""
Scraper de inteligencia de precios.
Busca tiendas en Tiendanube y Empretienda, extrae productos y detecta cambios de precio.
"""

import time
import random
import requests
from urllib.parse import urlparse, urljoin
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
    "Accept-Language": "es-AR,es;q=0.9",
}

PLATAFORMAS = {
    "tiendanube":  "site:mitiendanube.com OR site:mitienda.com",
    "empretienda": "site:empretienda.com.ar",
    "todas":       "site:mitiendanube.com OR site:mitienda.com OR site:empretienda.com.ar",
}


# ── Búsqueda de tiendas en Google ────────────────────────────────────────────

def buscar_tiendas_google(page, termino: str, plataforma: str, max_tiendas: int = 8) -> list[dict]:
    """Busca tiendas en Google según plataforma y retorna lista de {nombre, url, plataforma}."""
    site_filter = PLATAFORMAS.get(plataforma, PLATAFORMAS["todas"])
    query = f"{termino} {site_filter}"
    url_busqueda = f"https://www.google.com/search?q={query.replace(' ', '+')}&hl=es-419&num=20"

    tiendas = []
    vistos = set()

    try:
        page.goto(url_busqueda, timeout=30000, wait_until="domcontentloaded")
        time.sleep(random.uniform(2, 3))

        # Aceptar cookies de Google si aparece
        try:
            page.locator('button:has-text("Aceptar todo"), button:has-text("Accept all")').first.click(timeout=3000)
            time.sleep(1)
        except Exception:
            pass

        resultados = page.locator("div#search a[href]").all()

        for link in resultados:
            if len(tiendas) >= max_tiendas:
                break
            try:
                href = link.get_attribute("href") or ""
                if not href.startswith("http"):
                    continue

                parsed = urlparse(href)
                dominio = parsed.netloc.lower()

                plat_detectada = None
                if "mitiendanube.com" in dominio or "mitienda.com" in dominio:
                    plat_detectada = "tiendanube"
                elif "empretienda.com.ar" in dominio:
                    plat_detectada = "empretienda"
                else:
                    continue

                base_url = f"{parsed.scheme}://{parsed.netloc}"
                if base_url in vistos:
                    continue
                vistos.add(base_url)

                nombre = dominio.split(".")[0].replace("-", " ").title()
                tiendas.append({"nombre": nombre, "url": base_url, "plataforma": plat_detectada})
            except Exception:
                continue

        print(f"  [GOOGLE] '{termino}' → {len(tiendas)} tiendas encontradas")

    except Exception as e:
        print(f"  [ERROR] Google search '{termino}': {e}")

    return tiendas


# ── Scraping de productos ─────────────────────────────────────────────────────

def scrape_tiendanube(store_url: str) -> list[dict]:
    """Usa la API JSON pública de Tiendanube para extraer productos."""
    productos = []
    page_num = 1

    while True:
        try:
            resp = requests.get(
                f"{store_url}/productos.json",
                params={"per_page": 200, "page": page_num},
                headers=HEADERS,
                timeout=15,
            )
            if resp.status_code != 200:
                break

            data = resp.json()
            items = data if isinstance(data, list) else data.get("products", data.get("items", []))

            if not items:
                break

            for item in items:
                try:
                    nombre = item.get("name") or item.get("nombre") or ""
                    precio_raw = item.get("price") or item.get("precio") or item.get("variants", [{}])[0].get("price", 0)
                    precio = float(str(precio_raw).replace(",", ".")) if precio_raw else None

                    cats = item.get("categories") or item.get("categorias") or []
                    categoria = cats[0].get("name") if cats and isinstance(cats[0], dict) else (cats[0] if cats else None)

                    item_url = item.get("url") or item.get("permalink") or ""
                    if item_url and not item_url.startswith("http"):
                        item_url = urljoin(store_url, item_url)

                    imagenes = item.get("images") or item.get("imagenes") or []
                    imagen = imagenes[0].get("src") if imagenes and isinstance(imagenes[0], dict) else None

                    if nombre and item_url:
                        productos.append({
                            "nombre": nombre,
                            "precio": precio,
                            "categoria": categoria,
                            "url": item_url,
                            "imagen": imagen,
                        })
                except Exception:
                    continue

            if len(items) < 200:
                break
            page_num += 1
            time.sleep(0.5)

        except Exception as e:
            print(f"    [WARN] Tiendanube JSON error {store_url}: {e}")
            break

    return productos


def scrape_empretienda(page, store_url: str) -> list[dict]:
    """Scrapea productos de Empretienda via HTML."""
    productos = []
    try:
        page.goto(f"{store_url}/productos", timeout=20000, wait_until="domcontentloaded")
        time.sleep(2)

        html = page.content()
        soup = BeautifulSoup(html, "html.parser")

        for item in soup.select(".product-item, .item, article.product, .productos-item")[:100]:
            try:
                nombre_el = item.select_one(".product-name, .item-name, h2, h3, .nombre")
                nombre = nombre_el.get_text(strip=True) if nombre_el else ""

                precio_el = item.select_one(".price, .precio, .product-price, [class*='price']")
                precio_txt = precio_el.get_text(strip=True) if precio_el else ""
                precio = None
                if precio_txt:
                    nums = "".join(c for c in precio_txt if c.isdigit() or c in ".,")
                    nums = nums.replace(".", "").replace(",", ".")
                    try:
                        precio = float(nums)
                    except Exception:
                        pass

                link_el = item.select_one("a[href]")
                item_url = ""
                if link_el:
                    href = link_el.get("href", "")
                    item_url = href if href.startswith("http") else urljoin(store_url, href)

                img_el = item.select_one("img[src]")
                imagen = img_el.get("src") if img_el else None

                if nombre and item_url:
                    productos.append({
                        "nombre": nombre,
                        "precio": precio,
                        "categoria": None,
                        "url": item_url,
                        "imagen": imagen,
                    })
            except Exception:
                continue

    except Exception as e:
        print(f"    [WARN] Empretienda scrape {store_url}: {e}")

    return productos


def scrape_tienda(page, tienda: dict) -> list[dict]:
    url = tienda["url"]
    plat = tienda["plataforma"]
    print(f"    Scrapeando {url} ({plat})...")

    if plat == "tiendanube":
        productos = scrape_tiendanube(url)
    else:
        productos = scrape_empretienda(page, url)

    print(f"    → {len(productos)} productos")
    return productos


# ── Pipeline principal ────────────────────────────────────────────────────────

def run_inteligencia(conn_factory, busquedas: list[dict], alertas_callback=None) -> dict:
    """
    Ejecuta el pipeline completo de inteligencia de precios.
    - conn_factory: función que retorna una conexión DB (para upserts)
    - busquedas: lista de {termino, plataforma, umbral_alerta}
    - alertas_callback(cambio, producto, tienda): llamado cuando hay baja de precio significativa
    Retorna resumen {tiendas, productos, alertas}
    """
    from database import upsert_tienda, upsert_producto

    resumen = {"tiendas": 0, "productos": 0, "alertas": 0}
    tiendas_vistas = {}  # url -> id

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(user_agent=HEADERS["User-Agent"], locale="es-AR")
        page = context.new_page()

        for busqueda in busquedas:
            termino = busqueda["termino"]
            plataforma = busqueda["plataforma"]
            umbral = busqueda.get("umbral_alerta", 10)

            print(f"\n[INTELIGENCIA] Búsqueda: '{termino}' ({plataforma})")
            tiendas = buscar_tiendas_google(page, termino, plataforma)
            time.sleep(random.uniform(2, 3))

            for tienda in tiendas:
                if tienda["url"] not in tiendas_vistas:
                    tienda_id = upsert_tienda(tienda["nombre"], tienda["url"], tienda["plataforma"])
                    tiendas_vistas[tienda["url"]] = tienda_id
                    resumen["tiendas"] += 1
                else:
                    tienda_id = tiendas_vistas[tienda["url"]]

                productos = scrape_tienda(page, tienda)
                time.sleep(random.uniform(1, 2))

                for prod in productos:
                    cambio = upsert_producto(tienda_id, prod)
                    resumen["productos"] += 1

                    if cambio and cambio["pct"] <= -umbral and alertas_callback:
                        alertas_callback(cambio, prod, tienda)
                        resumen["alertas"] += 1

        browser.close()

    return resumen


if __name__ == "__main__":
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent))
    from database import get_connection, crear_tablas_inteligencia, seed_busquedas_default, cargar_busquedas_activas

    crear_tablas_inteligencia()
    seed_busquedas_default()
    busquedas = cargar_busquedas_activas()
    print(f"[INFO] {len(busquedas)} búsquedas activas")
    resumen = run_inteligencia(get_connection, busquedas)
    print(f"\n[OK] Tiendas: {resumen['tiendas']} | Productos: {resumen['productos']} | Alertas: {resumen['alertas']}")
