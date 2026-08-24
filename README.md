# CuentasSeparadas

Aplicación web para repartir los gastos de un viaje entre grupos y personas.

## Publicación gratuita

El proyecto se publica automáticamente en GitHub Pages al hacer *push* a `main`.

> **Paso manual obligatorio (una sola vez).** El workflow **no puede activar
> GitHub Pages por sí mismo**: el `GITHUB_TOKEN` de Actions no tiene permiso para
> crear el sitio y el paso *Set up Pages* falla con
> `Create Pages site failed. Error: Resource not accessible by integration`.
> Hay que activarlo a mano en los ajustes del repositorio.

1. En el repositorio, abre **Settings → Pages**.
2. En **Build and deployment**, selecciona **GitHub Actions** como fuente.
3. Vuelve a lanzar el workflow *Deploy to GitHub Pages* (o haz un nuevo *push* a
   `main`); la aplicación estará disponible en
   `https://acg1996.github.io/CuentasSeparadas/`.

Los datos de gastos se guardan únicamente en el almacenamiento local de cada navegador.
