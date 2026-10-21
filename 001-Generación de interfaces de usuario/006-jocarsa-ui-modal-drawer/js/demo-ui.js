/**
 * jocarsa | iu · demostraciones
 * Namespace técnico: jocarsa.iu
 */
window.jocarsa = window.jocarsa || {};
window.jocarsa.iu = window.jocarsa.iu || {};

(() => {
  "use strict";

  class ToastDemo {
    constructor(selectorPila = "#toastStack") {
      this.pila = document.querySelector(selectorPila);
      this.iconos = {
        success: "✓",
        info: "i",
        warning: "!",
        danger: "×"
      };
    }

    mostrar(tipo = "info", titulo = "Información", texto = "Mensaje de ejemplo") {
      if (!this.pila) {
        return;
      }

      const toast = document.createElement("article");
      toast.className = `ju-toast is-${tipo}`;
      toast.innerHTML = `
        <div class="ju-toast-icon">${this.iconos[tipo] || "i"}</div>
        <div>
          <p class="ju-toast-title">${titulo}</p>
          <p class="ju-toast-text">${texto}</p>
        </div>
        <button class="ju-toast-close" type="button" aria-label="Cerrar">×</button>
      `;

      const cerrar = () => {
        toast.classList.add("is-leaving");
        setTimeout(() => toast.remove(), 240);
      };

      toast.querySelector(".ju-toast-close").addEventListener("click", cerrar);
      this.pila.appendChild(toast);
      setTimeout(cerrar, 5000);
    }
  }

  class DemoIU {
    constructor() {
      this.toast = new ToastDemo();
      this.textos = {
        success: ["Guardado correctamente", "La operación se ha completado."],
        info: ["Información", "Este es un mensaje informativo."],
        warning: ["Revisión necesaria", "Conviene revisar los datos antes de continuar."],
        danger: ["Operación fallida", "No se ha podido completar la operación."]
      };
    }

    iniciar() {
      document.addEventListener("click", (evento) => {
        const boton = evento.target.closest("[data-toast]");

        if (!boton) {
          return;
        }

        const tipo = boton.dataset.toast;
        this.toast.mostrar(tipo, ...this.textos[tipo]);
      });

      document.getElementById("formDemo")?.addEventListener("submit", (evento) => {
        evento.preventDefault();
        this.toast.mostrar(
          "success",
          "Formulario guardado",
          "El evento submit se ha capturado correctamente."
        );
      });
    }
  }

  window.jocarsa.iu.ToastDemo = ToastDemo;
  window.jocarsa.iu.DemoIU = DemoIU;

  document.addEventListener("DOMContentLoaded", () => {
    window.jocarsa.iu.demo = new DemoIU();
    window.jocarsa.iu.demo.iniciar();
  });
})();
