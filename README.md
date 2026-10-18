# CraftPanel

**Administra tus servidores de Minecraft desde un solo lugar.**

CraftPanel es una herramienta de gestión diseñada para facilitar la administración de servidores de Minecraft mediante una interfaz sencilla, con versiones Web y Desktop orientadas a distintos tipos de usuarios.

> Tu servidor. Tu configuración. Tu control.

---

## 📌 Tabla de contenido

- [Acerca del proyecto](#-acerca-del-proyecto)
- [Características](#-características)
- [Versiones disponibles](#-versiones-disponibles)
- [Requisitos](#-requisitos)
- [Instalación](#-instalación)
- [Configuración](#-configuración)
- [Gestión de servidores](#-gestión-de-servidores)
- [Seguridad](#-seguridad)
- [Solución de problemas](#-solución-de-problemas)
- [Hoja de ruta](#-hoja-de-ruta)
- [Contribuciones](#-contribuciones)
- [Licencia](#-licencia)
- [Aviso legal](#-aviso-legal)

---

## 🎮 Acerca del proyecto

**CraftPanel** nace con la idea de simplificar la administración de servidores de Minecraft. Su objetivo es ofrecer una experiencia más cómoda para organizar, configurar y gestionar servidores sin depender exclusivamente de comandos manuales.

El proyecto contempla dos versiones principales:

- **CraftPanel Web:** una interfaz que se ejecuta localmente y se utiliza desde un navegador.
- **CraftPanel Desktop:** una aplicación para Windows diseñada para administrar desde el escritorio.

CraftPanel está pensado tanto para jugadores que desean crear servidores privados para sus amigos como para usuarios interesados en experimentar con distintas configuraciones y aprender sobre la administración de servidores.

El proyecto continúa evolucionando. Las funciones y los requisitos específicos pueden variar según la versión publicada.

## ✨ Características

### 🖥️ Interfaz de administración

CraftPanel busca centralizar las tareas de gestión de servidores en una interfaz accesible, organizada y fácil de utilizar.

### 🌐 Versión Web

La versión Web permite acceder a la interfaz desde un navegador mientras la aplicación está ejecutándose localmente.

Está pensada para ofrecer una alternativa cómoda a la administración tradicional mediante terminales y archivos de configuración.

### 💻 Versión Desktop

La versión Desktop está orientada a usuarios de Windows que prefieren gestionar sus servidores desde una aplicación de escritorio.

Su distribución puede incluir archivos de inicio e instalación, dependiendo de la versión.

### ⚙️ Configuración por servidor

CraftPanel contempla opciones de configuración para administrar los servidores de forma individual. La disponibilidad de cada opción depende de la versión instalada.

### 🧠 Administración de memoria RAM

La versión Desktop trabajada contempla una opción para configurar la memoria RAM asignada a cada servidor, dentro del rango admitido por la aplicación.

La memoria recomendada depende de la versión de Minecraft, los mods, los plugins, la cantidad de jugadores y los recursos del equipo.

### ☕ Selección de Java

La versión Desktop contempla la posibilidad de seleccionar la ruta de Java que utilizará el servidor.

Esto resulta útil cuando distintas versiones de Minecraft necesitan diferentes versiones de Java.

### 🗂️ Administración de archivos

CraftPanel está orientado a facilitar la gestión de los directorios relacionados con los servidores. Algunas operaciones pueden afectar directamente a los archivos almacenados en el equipo.

**Importante:** antes de eliminar un servidor o sus archivos, realiza una copia de seguridad de los mundos, configuraciones y complementos que quieras conservar.

### 👤 Sistema de usuarios

Las versiones pueden incluir funciones de registro y administración de usuarios.

Cada instalación distribuida debe utilizar sus propios datos de usuario. Nunca compartas una copia que contenga tus cuentas, credenciales o información privada.

---

## 📦 Versiones disponibles

| Versión | Descripción |
|---|---|
| CraftPanel Web | Interfaz accesible desde un navegador, diseñada para ejecutarse localmente. |
| CraftPanel Desktop | Aplicación para Windows enfocada en la administración desde el escritorio. |

Las versiones pueden tener requisitos y funciones diferentes. Consulta las instrucciones incluidas en cada distribución antes de instalarla o actualizarla.

## 🛠️ Requisitos

### CraftPanel Web

- Windows u otro sistema compatible con la versión de Node.js utilizada.
- Node.js instalado.
- npm disponible en la terminal.
- Un navegador moderno.
- Los archivos de CraftPanel Web.
- Java y los archivos del servidor de Minecraft, cuando sean necesarios para ejecutar el servidor.

### CraftPanel Desktop

- Windows compatible con la versión distribuida.
- Los archivos de CraftPanel Desktop o su instalador.
- Java compatible con la versión de Minecraft que quieras ejecutar.
- Espacio suficiente en disco para la aplicación, los servidores y sus mundos.

Los requisitos definitivos dependen de la versión que descargues.

---

## 🚀 Instalación

### CraftPanel Web

1. Descarga el paquete Web desde la sección **Releases** del repositorio, si está disponible.
2. Extrae el archivo ZIP en una carpeta de tu elección.
3. Instala Node.js si todavía no está instalado.
4. Abre una terminal dentro de la carpeta que contiene `package.json`.
5. Instala las dependencias:

   ```bash
   npm install
   ```

6. Inicia CraftPanel:

   ```bash
   npm start
   ```

7. Revisa el mensaje de inicio en la terminal para identificar la dirección local configurada.
8. Abre esa dirección en tu navegador.

Para detener la aplicación, vuelve a la terminal y presiona `Ctrl + C`.

**Nota:** la dirección y el puerto dependen de la configuración de la versión instalada. Utiliza los valores que indique la aplicación.

### CraftPanel Desktop

1. Descarga la versión Desktop publicada en el repositorio.
2. Extrae el ZIP si no incluye un instalador.
3. Lee las instrucciones incluidas en el paquete.
4. Ejecuta el instalador, si corresponde.
5. Abre CraftPanel desde el acceso directo o archivo de inicio suministrado.
6. Configura las rutas y opciones que necesites.

Descarga ejecutables únicamente desde fuentes confiables.

---

## ⚙️ Configuración

CraftPanel puede utilizar archivos de configuración propios, dependiendo de la versión distribuida.

Antes de modificar cualquier archivo:

1. Haz una copia de seguridad.
2. Comprueba que estás editando el archivo correcto.
3. Verifica que las rutas correspondan a tu equipo.
4. Evita modificar opciones cuyo propósito desconozcas.
5. Reinicia la aplicación cuando sea necesario para aplicar los cambios.

### Rutas de servidores

Las rutas deben apuntar a las carpetas correctas de tu equipo.

No copies configuraciones que dependan del nombre de usuario de Windows o de directorios personales de otra persona.

### Memoria RAM

Asigna una cantidad de memoria apropiada para el servidor. Deja suficientes recursos para Windows, CraftPanel y los demás programas que estén ejecutándose.

### Java

Comprueba que la versión de Java sea compatible con la versión de Minecraft que utilizarás.

Puedes consultar la versión instalada desde una terminal mediante:

```bash
java -version
```

Si tienes varias instalaciones de Java, verifica que CraftPanel utilice la ruta correcta.

---

## 🗂️ Gestión de servidores

Antes de iniciar un servidor, comprueba:

- Que hayas seleccionado el servidor correcto.
- Que la ruta configurada sea válida.
- Que Java esté disponible y sea compatible.
- Que exista suficiente memoria RAM.
- Que tengas espacio libre en disco.
- Que los archivos necesarios estén presentes.

### Eliminación de servidores

Eliminar un servidor puede significar borrar solamente su registro en CraftPanel o eliminar también sus archivos del disco, dependiendo de la función utilizada.

Antes de confirmar una eliminación:

1. Verifica el nombre del servidor.
2. Revisa la ruta completa.
3. Guarda una copia de los mundos y archivos importantes.
4. Confirma qué datos se eliminarán.
5. Comprueba que la copia de seguridad esté guardada fuera de la carpeta afectada.

Las eliminaciones de archivos pueden ser irreversibles.

---

## 🔐 Seguridad y privacidad

La seguridad es importante tanto para el desarrollador como para quienes utilizan CraftPanel.

- No publiques contraseñas ni credenciales.
- No distribuyas archivos que contengan cuentas personales.
- No subas tokens, cookies de sesión o claves privadas.
- No publiques mundos privados ni configuraciones con información sensible.
- Utiliza contraseñas únicas y robustas.
- Mantén los datos de cada instalación separados.
- Haz copias de seguridad antes de modificar o eliminar archivos.
- No expongas la interfaz Web a Internet sin revisar primero su seguridad.
- Revisa los archivos incluidos en cada ZIP antes de compartirlo.

### Preparar una versión para otros usuarios

Antes de distribuir CraftPanel:

1. Prueba el paquete en una instalación limpia.
2. Comprueba que no contenga tus datos personales.
3. Verifica que el sistema de registro inicial funcione como esperas.
4. Revisa las rutas configuradas.
5. Elimina registros y archivos temporales que puedan contener información privada.
6. Incluye instrucciones claras.
7. Prueba nuevamente el ZIP extraído en una carpeta nueva.

**Nunca distribuyas una copia que contenga las cuentas de usuario de tu propia instalación.**

---

## 🧰 Solución de problemas

### CraftPanel Web no inicia

Prueba lo siguiente:

```bash
node --version
npm --version
npm install
npm start
```

Si el problema continúa:

- Comprueba que estés en la carpeta correcta.
- Revisa el mensaje de error completo.
- Verifica que la versión de Node.js sea compatible.
- Comprueba que el puerto configurado no esté ocupado.

### No puedo acceder desde el navegador

- Confirma que CraftPanel siga ejecutándose.
- Abre la dirección indicada en la terminal.
- Comprueba si el puerto ha cambiado.
- Revisa el firewall si corresponde.

La aplicación puede estar configurada únicamente para conexiones locales.

### El servidor de Minecraft no inicia

- Comprueba la ruta de Java.
- Verifica la compatibilidad de Java con Minecraft.
- Revisa que los archivos del servidor estén presentes.
- Comprueba la memoria RAM asignada.
- Consulta los registros del servidor para identificar el error.

### CraftPanel muestra usuarios existentes

Comprueba que estés utilizando un paquete limpio preparado para una instalación nueva.

No borres archivos de usuarios sin comprender cómo los utiliza la aplicación. Si necesitas conservar los datos de una instalación anterior, realiza primero una copia de seguridad.

### La aplicación falla después de actualizar

- Conserva una copia de seguridad.
- Consulta las notas de la versión.
- Evita mezclar archivos de versiones diferentes.
- Comprueba la compatibilidad de los datos existentes.

---

## 🗺️ Hoja de ruta

Las siguientes ideas representan posibles mejoras futuras, no funciones garantizadas ni fechas confirmadas.

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

### Enviar cambios

Si el repositorio acepta contribuciones, puedes:

1. Crear un *fork* del repositorio.
2. Crear una rama para tus cambios.
3. Implementar y probar la mejora.
4. Describir los cambios realizados.
5. Abrir un *pull request*.

Procura mantener los cambios claros y documentados.

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
