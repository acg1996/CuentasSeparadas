# CuentasSeparadas

Aplicación web para repartir los gastos de un viaje entre grupos y personas.

## Qué se puede hacer

- **Varios viajes.** Crea, cambia, renombra y borra viajes desde la barra superior;
  cada viaje tiene sus propios participantes y gastos.
- **Participantes con peso.** Cada participante tiene un peso que indica cuántas
  partes paga. Una cuenta conjunta de dos personas usa peso `2` y por tanto asume
  el doble que un participante con peso `1`. Junto a cada nombre se muestra el
  porcentaje que le corresponde del reparto.
- **Reparto proporcional.** Cada gasto se divide entre los participantes marcados
  en proporción a sus pesos, y la app calcula los pagos mínimos para saldar todo.
- **Compartir el viaje.** El botón *Copiar enlace para compartir* genera una URL
  que lleva el viaje codificado. Al abrirla en otro dispositivo (o enviarla a otra
  persona) se importa el viaje con sus participantes y gastos. Como los datos
  viajan en el enlace, no hace falta ningún servidor; hay que volver a compartir el
  enlace tras añadir gastos nuevos para que el resto vea los cambios.

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

Los datos de gastos se guardan en el almacenamiento local de cada navegador; para
usarlos en otro dispositivo hay que compartir el enlace del viaje.
