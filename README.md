# CraftPanel

Administra tus servidores de Minecraft desde un solo lugar.
CraftPanel es una herramienta pensada para hacer más sencilla la administración de servidores de Minecraft, con versiones Web y Desktop. El proyecto está dirigido a jugadores, administradores de servidores y personas que quieran experimentar, aprender o crear su propio entorno de juego.
CraftPanel: tu servidor, tu configuración, tu control.

CraftPanel se publica como un proyecto abierto bajo la licencia MIT. Puedes estudiar el código, modificarlo, adaptarlo a tus necesidades y compartir tus propias versiones, siempre respetando las condiciones de la licencia.
📚 Contenido
- ¿Qué es CraftPanel?
- Funciones principales
- Versiones disponibles
- Requisitos
- Instalación
- Primeros pasos
- Configuración y administración
- Seguridad y privacidad
- Solución de problemas
- Participa en CraftPanel
- Licencia
- Aviso sobre Minecraft
🎮 ¿Qué es CraftPanel?
CraftPanel busca ofrecer una forma más accesible de organizar y administrar servidores de Minecraft. En vez de tener que recordar cada comando o gestionar todas las tareas manualmente, la aplicación reúne opciones de administración en una interfaz propia.
El proyecto contempla dos versiones:
- CraftPanel Web: una interfaz que se ejecuta localmente y se utiliza desde un navegador.
- CraftPanel Desktop: una aplicación para Windows enfocada en la administración desde el escritorio.
CraftPanel está pensado para distintos tipos de usuarios: quienes quieren jugar con amigos en un servidor propio, quienes están aprendiendo a administrar servidores y quienes desean explorar el código para adaptarlo o contribuir al proyecto.
Las funciones exactas pueden variar de una versión a otra. Consulta las instrucciones incluidas con la versión que descargues.
✨ Funciones principales
🗂️ Administración de servidores
CraftPanel está diseñado para facilitar la organización y gestión de servidores de Minecraft desde una interfaz central. Comprueba siempre qué servidor y qué directorio tienes seleccionados antes de efectuar cambios.
🌐 CraftPanel Web
La versión Web permite utilizar la interfaz desde un navegador mientras el proceso de CraftPanel está en ejecución. El paquete Web utiliza Node.js y npm para instalar sus dependencias e iniciar la aplicación.
Ejecutarse en un navegador no significa que CraftPanel esté preparado automáticamente para publicarse en Internet. Revisa la configuración de red y la seguridad antes de permitir conexiones externas.

🖥️ CraftPanel Desktop
La versión Desktop está orientada a Windows y busca ofrecer una experiencia de administración desde el escritorio.
🧠 Configuración de memoria RAM
La versión Desktop trabajada incluye un selector de memoria RAM por servidor, con un rango configurado de 1 a 32 GB. La cantidad apropiada depende de la versión de Minecraft, los mods, los plugins, el número de jugadores y los recursos del equipo.
No asignes más memoria de la que tu equipo pueda proporcionar. Deja recursos suficientes para Windows y las demás aplicaciones.
☕ Selección de Java
La versión Desktop contempla la selección de una ruta de Java para el servidor. La versión necesaria de Java depende del tipo y la versión del servidor de Minecraft que utilices.
👤 Usuarios e instalación inicial
Las versiones pueden incluir funciones de registro y gestión de usuarios. Si distribuyes o instalas CraftPanel en otro equipo, asegúrate de usar un paquete limpio que no contenga cuentas ni datos de tu propia instalación.
📦 Versiones disponibles
Versión	Descripción
Web	Interfaz utilizada desde el navegador y diseñada para ejecutarse localmente.
Desktop	Aplicación para Windows, con opciones de configuración de servidor como memoria RAM y ruta de Java.


Cuando haya paquetes listos para descargar, publícalos en la sección Releases de GitHub. Revisa las notas de cada versión para conocer cambios, requisitos y posibles limitaciones.
🛠️ Requisitos
CraftPanel Web
- Una versión compatible de Node.js.
- npm, normalmente incluido con Node.js.
- Un navegador moderno.
- Los archivos de CraftPanel Web.
- Java y los archivos del servidor de Minecraft que quieras ejecutar, según tu configuración.
CraftPanel Desktop
- Una versión compatible de Windows.
- Los archivos de la distribución o el instalador oficial de CraftPanel.
- Una versión de Java compatible con el servidor de Minecraft que vayas a utilizar.
- Espacio suficiente para la aplicación, los servidores, los mundos y sus copias de seguridad.
Los requisitos pueden cambiar con futuras versiones.
🚀 Instalación
Instalar CraftPanel Web
1. Descarga el paquete de CraftPanel Web desde Releases, si hay una versión publicada.
2. Extrae el archivo ZIP en una carpeta de tu elección.
3. Instala Node.js si todavía no lo tienes.
4. Abre una terminal en la carpeta que contiene package.json.
5. Instala las dependencias:
   npm install
6. Inicia CraftPanel:
   npm start
7. Revisa el mensaje que aparece en la terminal para saber qué dirección local debes abrir.
8. Abre esa dirección en el navegador.
Para detener la aplicación, vuelve a la terminal en la que se está ejecutando y pulsa Ctrl + C.
Nota: la dirección y el puerto pueden depender de la configuración de la versión descargada. Sigue el mensaje de inicio y las instrucciones de ese paquete.
Instalar CraftPanel Desktop
1. Descarga la versión Desktop desde la sección Releases, si está disponible.
2. Extrae el ZIP o ejecuta el instalador, según el formato distribuido.
3. Lee las instrucciones incluidas en el paquete.
4. Abre CraftPanel desde el archivo de inicio o el acceso directo suministrado.
5. Configura las rutas y las opciones que necesites.
Descarga ejecutables únicamente de fuentes confiables. Si Windows muestra una advertencia de seguridad, verifica el origen del archivo antes de continuar.
🧭 Primeros pasos
Después de instalar CraftPanel:
1. Abre la aplicación. Sigue las instrucciones específicas de la versión Web o Desktop.
2. Comprueba la configuración inicial. Revisa los directorios y las opciones disponibles.
3. Configura tu servidor. Verifica su ruta, los archivos necesarios y la versión de Java.
4. Ajusta la memoria. Asigna una cantidad de RAM adecuada para tu equipo y tu servidor.
5. Haz una prueba. Antes de confiarle un servidor importante a una nueva configuración, prueba primero con un servidor de prueba.
6. Guarda una copia de seguridad. Protege tus mundos y archivos antes de realizar cambios importantes.
⚙️ Configuración y administración
Rutas de archivos
Utiliza las rutas correspondientes a tu propio equipo. Una ruta que funciona en el ordenador de otra persona puede no existir en el tuyo, especialmente si incluye un nombre de usuario de Windows o una carpeta personal.
Memoria RAM
La memoria necesaria depende de la versión de Minecraft, la cantidad de jugadores, los mods y los plugins. Si el sistema se queda sin memoria, reduce la asignación o revisa qué otros programas están consumiendo recursos.
Java
Si un servidor no inicia, comprueba que la ruta de Java sea correcta y que esa instalación sea compatible con el servidor. Puedes revisar la versión disponible en una terminal con:
java -version
Eliminar servidores o archivos
Las operaciones de eliminación pueden borrar datos importantes, como mundos, configuraciones, complementos y registros. Antes de confirmar una eliminación:
- Confirma el nombre del servidor y la ruta completa.
- Comprueba qué datos serán eliminados.
- Guarda los archivos que quieras conservar.
- Mantén la copia de seguridad fuera de la carpeta que vas a eliminar.
No continúes si no estás seguro de qué operación se ejecutará.
🔐 Seguridad y privacidad
La seguridad también depende de cómo se configure y distribuya la aplicación. Para utilizar y compartir CraftPanel responsablemente:
- No publiques contraseñas, tokens, cookies de sesión ni claves privadas.
- No subas datos de usuarios reales ni bases de datos de tu instalación.
- No compartas mundos privados ni configuraciones que contengan información personal.
- Revisa los archivos JSON y los registros antes de subirlos a GitHub.
- Usa una instalación limpia para preparar paquetes destinados a otras personas.
- No expongas la interfaz Web directamente a Internet sin revisar primero su autenticación, permisos, configuración de red y firewall.
- Haz copias de seguridad antes de actualizar, migrar o eliminar datos.
Antes de publicar una nueva versión
1. Prueba el paquete en una carpeta o instalación limpia.
2. Verifica que no incluya cuentas personales ni archivos sensibles.
3. Comprueba que las rutas no dependan del ordenador del desarrollador.
4. Incluye instrucciones de instalación y requisitos.
5. Extrae el ZIP final en otra carpeta y comprueba el funcionamiento del paquete.
🧰 Solución de problemas
CraftPanel Web no inicia
- Comprueba que Node.js y npm estén instalados:
  node --version
  npm --version
- Ejecuta los comandos dentro de la carpeta correcta.
- Vuelve a instalar las dependencias con npm install.
- Inicia la aplicación con npm start.
- Lee el mensaje de error completo y comprueba que el puerto configurado no esté ocupado.
No puedo abrir la interfaz en el navegador
- Verifica que CraftPanel siga en ejecución.
- Utiliza la dirección que indique la terminal.
- Comprueba si el puerto está ocupado o si el firewall bloquea la conexión.
- Recuerda que la aplicación puede estar configurada para aceptar únicamente conexiones locales.
El servidor de Minecraft no inicia
- Verifica que los archivos del servidor existan.
- Comprueba la ruta y compatibilidad de Java.
- Revisa la memoria RAM asignada y el espacio disponible.
- Consulta la consola y los registros del servidor para identificar el error original.
Las rutas no funcionan en otro ordenador
Configura rutas válidas para el equipo donde está instalado CraftPanel. No distribuyas configuraciones con rutas personales tomadas de tu propio ordenador.
Aparecen usuarios de otra instalación
No distribuyas una instalación con cuentas ajenas. Utiliza un paquete limpio preparado para una instalación nueva. Antes de borrar datos, verifica cómo los utiliza la aplicación y conserva una copia de seguridad si necesitas mantenerlos.
Si informas de un problema en GitHub, incluye la versión de CraftPanel, el sistema operativo, los pasos para reproducirlo y el mensaje de error. Elimina antes cualquier contraseña, token o dato privado.
🗺️ Hoja de ruta
CraftPanel puede seguir mejorando gracias a las pruebas y sugerencias de la comunidad. Estas son áreas posibles de mejora, no promesas de funciones ni fechas confirmadas:
- [ ] Ampliar y actualizar las guías de instalación.
- [ ] Facilitar la configuración inicial en instalaciones nuevas.
- [ ] Mejorar la validación de rutas y versiones de Java.
- [ ] Hacer más claros los mensajes de error.
- [ ] Documentar las operaciones que eliminan archivos.
- [ ] Mejorar las instrucciones para copias de seguridad y restauración.
- [ ] Revisar el aislamiento de datos entre instalaciones.
- [ ] Publicar notas de versión con cambios y correcciones.
- [ ] Incorporar ideas y contribuciones de la comunidad.
Las propuestas son bienvenidas. Puedes abrir una incidencia para plantear una mejora o informar de un problema.
🤝 Participa en CraftPanel
CraftPanel es un proyecto público y abierto a la colaboración. Puedes utilizarlo, revisar su código, adaptarlo a tu flujo de trabajo y compartir mejoras bajo los términos de la licencia MIT.
Puedes participar de varias maneras:
- ⭐ Dar una estrella al repositorio en GitHub para ayudar a que otras personas lo descubran.
- 🐛 Informar de errores con pasos claros para reproducirlos.
- 💡 Proponer nuevas funciones o mejoras de uso.
- 📖 Corregir o ampliar la documentación.
- 🔧 Modificar el código y enviar tus cambios al proyecto.
- 🌱 Crear una versión adaptada a tus necesidades, respetando la licencia y los avisos de derechos de autor aplicables.
Cómo enviar una contribución
1. Crea un fork del repositorio.
2. Crea una rama para tu mejora.
3. Haz los cambios y prueba lo que hayas modificado.
4. Explica claramente qué cambiaste y por qué.
5. Abre un pull request para proponer que tus cambios se incorporen al proyecto original.
Si prefieres trabajar en tu propia versión, la licencia MIT también permite redistribuir modificaciones de acuerdo con sus condiciones. Procura documentar tus cambios para que otras personas puedan entenderlos.
Al publicar incidencias, capturas o registros, no incluyas contraseñas, tokens, datos personales ni archivos privados.
📄 Licencia
CraftPanel se distribuye bajo la licencia MIT. Esta licencia permite, entre otras cosas, utilizar, copiar, modificar, fusionar, publicar, distribuir, sublicenciar y vender copias del software, siempre sujeto a las condiciones de la licencia.
En particular, debes conservar el aviso de copyright y el texto de permiso de la licencia en las copias o partes sustanciales del software. El software se proporciona “tal cual”, sin garantías, en los términos descritos en la licencia.
Consulta el archivo LICENSE incluido en el repositorio para leer el texto completo.
La licencia MIT del proyecto no reemplaza las licencias de bibliotecas, dependencias, iconos u otros recursos de terceros. Cada componente de terceros sigue sujeto a sus propios términos.
⚖️ Aviso sobre Minecraft
CraftPanel es un proyecto independiente y no está afiliado, respaldado ni aprobado oficialmente por Mojang Studios o Microsoft. Minecraft y sus marcas pertenecen a sus respectivos titulares.
Quienes utilicen CraftPanel son responsables de respetar los términos y las licencias aplicables al juego, al software de servidor y a los recursos que instalen o distribuyan.
💚 Gracias
Gracias por probar CraftPanel, compartir comentarios, informar de errores o contribuir con código y documentación. La participación de la comunidad ayuda a identificar problemas, proponer ideas y hacer que el proyecto sea más útil para todos.
<p align="center">
  <strong>CraftPanel</strong><br>
  <em>Tu servidor. Tu configuración. Tu control.</em>
</p>

- [ ] Mejorar la documentación de instalación.
- [ ] Facilitar la configuración inicial.
- [ ] Mejorar el aislamiento de los datos de cada instalación.
- [ ] Añadir validaciones más claras para las rutas.
- [ ] Mejorar la detección de problemas relacionados con Java.
- [ ] Mejorar los mensajes de error.
- [ ] Documentar las acciones que eliminan archivos.
- [ ] Facilitar las copias de seguridad y la restauración.
- [ ] Mejorar la organización del repositorio.
- [ ] Publicar notas de versión detalladas.
- [ ] Incorporar sugerencias de la comunidad.

Las nuevas funciones dependerán de las necesidades del proyecto y de su desarrollo.

---

## 🤝 Contribuciones

Las sugerencias, los informes de errores y las mejoras pueden ayudar a que CraftPanel evolucione.

### Informar de un error

Al abrir una incidencia, incluye:

- La versión de CraftPanel.
- La versión utilizada: Web o Desktop.
- Tu sistema operativo.
- La versión de Node.js o Java, si corresponde.
- Los pasos para reproducir el problema.
- El resultado esperado.
- El resultado obtenido.
- El mensaje de error completo, si está disponible.

No incluyas contraseñas, datos de usuarios, tokens, direcciones privadas ni archivos personales.

### Proponer una función

Describe qué problema resolvería la función, cómo podría funcionar y si afectaría a la versión Web, Desktop o ambas.

---

## 📄 Licencia

La licencia definitiva de CraftPanel debe estar especificada en el archivo `LICENSE` del repositorio.

Las opciones habituales incluyen:

- **MIT:** permite utilizar, modificar y redistribuir el código bajo sus condiciones.
- **GNU GPL v3.0:** permite utilizar, modificar y distribuir el programa bajo condiciones de copyleft.
- **Sin licencia publicada:** no concede automáticamente permisos generales para reutilizar o redistribuir el código.

No declares una licencia hasta haber tomado la decisión y añadido el archivo correspondiente. También debes respetar las licencias de las dependencias y los recursos de terceros.

---

## ⚖️ Aviso legal

CraftPanel es un proyecto independiente y no debe presentarse como un producto oficial de Mojang Studios o Microsoft.

Minecraft, sus marcas y sus elementos relacionados pertenecen a sus respectivos titulares. El usuario es responsable de respetar los términos aplicables al software, los archivos de servidor y los recursos que utilice.

---

## 💚 Créditos

CraftPanel se desarrolla con el objetivo de facilitar la administración de servidores de Minecraft y ofrecer una herramienta práctica para la comunidad.

Gracias a todas las personas que prueben el proyecto, compartan sugerencias, informen de errores o contribuyan a mejorarlo.

---

<p align="center">

**CraftPanel**

*Tu servidor. Tu configuración. Tu control.*

</p>
