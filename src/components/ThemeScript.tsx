// Roda antes da hidratação, direto no <head>, pra não "piscar" o tema errado.
// Prioridade: preferência salva (localStorage) > tema do sistema operacional.
const SCRIPT = `(function(){
  try {
    var salvo = localStorage.getItem("theme");
    var tema = salvo === "light" || salvo === "dark"
      ? salvo
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", tema);
  } catch (e) {}
})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
