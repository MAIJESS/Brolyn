# Brolyn

Catálogo temático de **Broly y Dragon Ball Super** para [KinoTV](https://kinotvapp.github.io/kino-plugins/): películas, series y anime con datos de TMDB, en español de México.

> **Solo catálogo.** Brolyn no aloja ni enlaza videos. Al pulsar un título, Kino muestra **"Buscar dónde verlo"** y lo busca en los otros plugins que ya tienes instalados (fuentes que tú hayas autorizado).

## Qué incluye

- **Inicio** con estas filas: La saga de Broly · Dragon Ball Super · Películas de Dragon Ball · Series de Dragon Ball · Más anime de acción. Cada fila tiene "Ver más" con carga por páginas.
- **Búsqueda** de películas y series (primero lo relacionado con Dragon Ball, después el resto), con "Ver más resultados".
- **Fichas** con título, póster, fondo, sinopsis, año, géneros, puntuación y duración. El reparto, el director y la clasificación los añade Kino desde TMDB gracias al identificador del título.
- **Temporadas y episodios** con imagen, sinopsis, fecha y duración (hasta 20 temporadas, sin especiales).
- **Mensajes claros** si falla la conexión, si TMDB limita las peticiones o si no hay resultados.

## Requisitos

- Kino **0.9.54 o superior** (`apiVersion` 8).
- Ninguna llave: el catálogo usa `kino.tmdb`, el acceso a TMDB que ofrece Kino. El plugin no contiene llaves, tokens ni cookies.

## Instalar

En Kino: **Menú ▸ Plugins ▸ Agregar** y escribe:

```
https://github.com/TU_USUARIO/brolyn-kino
```

## Probar en local

Copia `sdk/`, `contract.json` y `kino.d.ts` de [kinotvapp/kino-plugin-sdk](https://github.com/kinotvapp/kino-plugin-sdk) y ejecuta (Node 18+):

```
node sdk/validate.mjs .
KINO_TMDB_KEY=<tu llave v3 solo para pruebas locales> node sdk/run.mjs . home
KINO_TMDB_KEY=<...> node sdk/run.mjs . search "broly"
KINO_TMDB_KEY=<...> node sdk/run.mjs . episodes '{"t":"tv","id":62715}'
```

La llave de pruebas va solo en tu terminal: nunca la escribas en `plugin.js` ni la subas al repositorio.

## Limitaciones

- No reproduce videos (`catalogOnly`). En Kino 0.9.53 o anterior, al intentar reproducir verás: "Brolyn solo muestra el catálogo: busca este título en tus otros plugins."
- Sinopsis y títulos dependen de lo que TMDB tenga en español de México; si falta la sinopsis se muestra "Sinopsis no disponible en español."
- Las filas temáticas se filtran por título ("Broly", "Dragon Ball"), por lo que pueden faltar o colarse títulos raros.

## Créditos y aviso legal

Este producto usa la API de TMDB, pero no está avalado ni certificado por TMDB.
Dragon Ball, Dragon Ball Super y Broly son marcas de sus titulares (Bird Studio, Shueisha y Toei Animation). Brolyn es un proyecto de fans no oficial y sin relación con ellos.

## Licencia

MIT
