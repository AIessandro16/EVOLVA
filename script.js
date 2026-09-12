// ===============================
// MENÚ MOBILE
// ===============================

const menuToggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".nav");

if (menuToggle && nav) {

    menuToggle.addEventListener("click", () => {

        nav.classList.toggle("open");

    });


    nav.querySelectorAll("a").forEach(link => {

        link.addEventListener("click", () => {

            nav.classList.remove("open");

        });

    });

}



// ===============================
// FORMULARIO
// ===============================

const form = document.querySelector("#contactForm");
const message = document.querySelector("#formMessage");


if (form && message) {

    form.addEventListener("submit", (event) => {

        event.preventDefault();


        if (!form.checkValidity()) {

            message.textContent =
                "Revisa los campos antes de enviar.";

            message.style.color =
                "#ff8b8b";

            form.reportValidity();

            return;

        }


        message.textContent =
            "¡Solicitud preparada! El envío real se conectará más adelante.";


        message.style.color =
            "#b8ff57";


        form.reset();

    });

}