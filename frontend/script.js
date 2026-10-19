/* =========================
   EVOLVA
   INTERACTIVITY
========================= */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);


/* =========================
   LOADING SCREEN
========================= */

const loadingScreen = $("#loadingScreen");
const loadingProgress = $("#loadingProgress");
const loadingPercent = $("#loadingPercent");

let progress = 0;

const loadingInterval = setInterval(() => {

    progress += Math.floor(Math.random() * 10) + 5;

    if (progress >= 100) {

        progress = 100;

        clearInterval(loadingInterval);

        setTimeout(() => {

            loadingScreen.classList.add("finished");

        }, 400);

    }

    loadingProgress.style.width = `${progress}%`;
    loadingPercent.textContent = `${progress}%`;

}, 80);


/* =========================
   DARK / LIGHT MODE
========================= */

const themeToggle = $("#themeToggle");
const arcadeTransition = $("#arcadeTransition");
const savedTheme = localStorage.getItem("evolva-theme");

if (savedTheme === "light") {
    document.body.classList.add("light");
    themeToggle.textContent = "☾";
}

themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("light");

    const isLight = document.body.classList.contains("light");
    localStorage.setItem("evolva-theme", isLight ? "light" : "dark");
    themeToggle.textContent = isLight ? "☾" : "☼";

    if (!arcadeTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    arcadeTransition.classList.remove("active");
    void arcadeTransition.offsetWidth;
    arcadeTransition.classList.add("active");
});

arcadeTransition?.addEventListener("animationend", (event) => {
    if (event.animationName === "theme-soft-glow") {
        arcadeTransition.classList.remove("active");
    }
});



/* =========================
   MOBILE MENU
========================= */

const menuButton = $("#menuButton");
const navigation = $("#navigation");

menuButton.addEventListener("click", () => {

    navigation.classList.toggle("open");

});


$$(".header nav a").forEach(link => {

    link.addEventListener("click", () => {

        navigation.classList.remove("open");

    });

});


/* =========================
   DIAGNÓSTICO
========================= */

const questions = $$(".question");

const nextButton = $("#diagnosticNext");
const backButton = $("#diagnosticBack");

const dots = $$(".steps span");

const diagnosticForm = $("#diagnosticForm");

const result = $("#diagnosticResult");

const resultTitle = $("#resultTitle");
const resultText = $("#resultText");
const resultServices = $("#resultServices");

const resetButton = $("#diagnosticReset");

let currentStep = 0;


function showQuestion(index) {

    questions.forEach((question, i) => {

        question.classList.toggle(
            "active",
            i === index
        );

    });


    dots.forEach((dot, i) => {

        dot.classList.toggle(
            "active",
            i === index
        );

    });


    backButton.disabled =
        index === 0;


    nextButton.textContent =
        index === questions.length - 1
            ? "Ver resultado →"
            : "Continuar →";

}


function getAnswer(name) {

    return document.querySelector(
        `input[name="${name}"]:checked`
    )?.value;

}


function createResult() {

    const presence =
        getAnswer("presence");

    const goal =
        getAnswer("goal");

    const priority =
        getAnswer("priority");


    let title =
        "Tu negocio ya tiene por dónde empezar.";

    let text =
        "Podemos ayudarte a ordenar tus redes, mostrar lo que ofreces y facilitar que tus clientes te contacten.";

    let services = [
        "Manejo de redes (community manager)",
        "Diseños y textos para redes",
        "Plan de ideas para tu negocio"
    ];


    if (
        priority === "branding" ||
        goal === "image"
    ) {

        title =
            "Empecemos por la imagen de tu negocio.";

        text =
            "Definimos un logo, colores y estilo para que las personas reconozcan tu negocio. Después podrás usarlos en tus publicaciones y otros materiales.";

        services = [
            "Diseño de logotipo",
            "Imagen de marca",
            "Diseños y textos para redes"
        ];

    }


    else if (
        priority === "web" ||
        goal === "digital"
    ) {

        title =
            "A tu negocio podría ayudarle tener una página web.";

        text =
            "Es un lugar donde las personas pueden conocer tu negocio, ver qué ofreces y encontrar cómo contactarte.";

        services = [
            "Página web para tu negocio",
            "Imagen de marca",
            "Manejo de redes (community manager)"
        ];

    }


    else if (presence === "none") {

        title =
            "Empecemos por construir tu presencia en internet.";

        text =
            "No necesitas tener redes ni una página para empezar. Podemos ayudarte a definir una imagen para tu negocio, preparar contenido y elegir dónde mostrar lo que ofreces.";

        services = [
            "Imagen de marca",
            "Diseños y textos para redes",
            "Manejo de redes (community manager)"
        ];

    }

    else if (
        priority === "management" ||
        presence === "social"
    ) {

        title =
            "Tus redes necesitan orden y atención.";

        text =
            "Podemos planificar y publicar contenido, además de responder comentarios y mensajes dentro del horario incluido en el plan que elijas.";

        services = [
            "Manejo de redes (community manager)",
            "Diseños y textos para redes",
            "Plan de ideas para tu negocio"
        ];

    }


    else if (goal === "customers") {

        title =
            "Hagamos más fácil que tus clientes te encuentren.";

        text =
            "Podemos mostrar mejor lo que ofreces en redes y en una página web, para que las personas sepan cómo contactarte.";

        services = [
            "Manejo de redes (community manager)",
            "Diseños y textos para redes",
            "Página web para tu negocio"
        ];

    }


    resultTitle.textContent = title;

    resultText.textContent = text;

    resultServices.innerHTML =
        services
            .map(service => `<span>${service}</span>`)
            .join("");

}




nextButton.addEventListener("click", () => {

    const selected =
        questions[currentStep].querySelector(
            "input:checked"
        );


    if (!selected) {

        questions[currentStep].animate(

            [
                { transform: "translateX(0)" },
                { transform: "translateX(-7px)" },
                { transform: "translateX(7px)" },
                { transform: "translateX(0)" }
            ],

            {
                duration: 220
            }

        );

        return;

    }


    if (currentStep < questions.length - 1) {

        currentStep++;

        showQuestion(currentStep);

    }

    else {

        createResult();

        diagnosticForm.style.display =
            "none";

        $(".diagnostic-intro").style.display =
            "none";

        result.classList.add("show");

    }

});


backButton.addEventListener("click", () => {

    if (currentStep > 0) {

        currentStep--;

        showQuestion(currentStep);

    }

});


resetButton.addEventListener("click", () => {

    diagnosticForm.reset();

    currentStep = 0;

    showQuestion(0);

    diagnosticForm.style.display =
        "flex";

    $(".diagnostic-intro").style.display =
        "block";

    result.classList.remove("show");

});


showQuestion(0);


/* =========================
   SERVICE HOVER EFFECT
========================= */

$$(".service-card").forEach(card => {

    card.addEventListener(
        "pointermove",
        event => {

            const rect =
                card.getBoundingClientRect();


            const x =
                ((event.clientX - rect.left) /
                    rect.width) * 100;


            const y =
                ((event.clientY - rect.top) /
                    rect.height) * 100;


            card.style.background = `
                radial-gradient(
                    circle at ${x}% ${y}%,
                    rgba(212,168,79,.10),
                    transparent 35%
                ),
                var(--surface)
            `;

        }
    );


    card.addEventListener(
        "pointerleave",
        () => {

            card.style.background = "";

        }
    );

});