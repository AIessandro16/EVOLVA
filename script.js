// =====================================================
// MOBILE MENU
// =====================================================

const menuToggle = document.querySelector(".menu-toggle");
const navMenu = document.querySelector(".nav-menu");

if (menuToggle && navMenu) {

    menuToggle.addEventListener("click", () => {
        navMenu.classList.toggle("active");
    });


    // Cerrar menú al seleccionar una sección

    const navLinks = document.querySelectorAll(".nav-menu a");

    navLinks.forEach((link) => {

        link.addEventListener("click", () => {
            navMenu.classList.remove("active");
        });

    });
}


// =====================================================
// CONTACT FORM
// =====================================================

const contactForm = document.querySelector("#contactForm");
const formMessage = document.querySelector("#formMessage");

if (contactForm) {

    contactForm.addEventListener("submit", (event) => {

        event.preventDefault();

        if (!contactForm.checkValidity()) {

            contactForm.reportValidity();

            return;
        }


        formMessage.textContent =
            "¡Solicitud preparada! El envío real se conectará más adelante.";


        contactForm.reset();

    });

}