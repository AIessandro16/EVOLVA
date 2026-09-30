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

const savedTheme =
    localStorage.getItem("evolva-theme");


if (savedTheme === "light") {

    document.body.classList.add("light");

    themeToggle.textContent = "☾";

}


themeToggle.addEventListener("click", () => {

    document.body.classList.toggle("light");

    const isLight =
        document.body.classList.contains("light");

    localStorage.setItem(
        "evolva-theme",
        isLight ? "light" : "dark"
    );

    themeToggle.textContent =
        isLight ? "☾" : "☼";

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
        "Tu negocio está listo para evolucionar.";

    let text =
        "Tienes un punto de partida. Podemos ayudarte a organizar tu presencia digital y construir una estrategia que crezca contigo.";

    let services = [
        "Contenido",
        "Community Manager",
        "Marketing"
    ];


    if (
        priority === "branding" ||
        goal === "image"
    ) {

        title =
            "Empieza por construir una marca reconocible.";

        text =
            "Antes de publicar más, conviene definir cómo quieres que tu negocio se vea y se recuerde. Una identidad clara será la base para todo lo demás.";

        services = [
            "Branding",
            "Contenido"
        ];

    }


    else if (
        priority === "web" ||
        goal === "digital"
    ) {

        title =
            "Tu siguiente paso puede ser crear tu presencia digital.";

        text =
            "Una página web puede convertirse en el punto central donde tus clientes conozcan tu negocio, tus servicios y sepan cómo contactarte.";

        services = [
            "Página Web",
            "Branding",
            "Marketing"
        ];

    }


    else if (
        priority === "management" ||
        presence === "social"
    ) {

        title =
            "Tus redes necesitan orden y constancia.";

        text =
            "Ya tienes un punto de partida. Ahora podemos ayudarte a organizar el contenido, mantener tus redes activas y convertirlas en un canal útil.";

        services = [
            "Community Manager",
            "Contenido",
            "Marketing"
        ];

    }


    else if (goal === "customers") {

        title =
            "Hagamos que tu presencia digital trabaje por tu negocio.";

        text =
            "Tu objetivo es atraer clientes. Para ello podemos combinar contenido, estrategia y una presencia digital que facilite que las personas te descubran y contacten.";

        services = [
            "Marketing",
            "Contenido",
            "Página Web"
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
   BEFORE / AFTER
========================= */

const comparison =
    $("#comparison");

const comparisonAfter =
    $("#comparisonAfter");

const comparisonHandle =
    $("#comparisonHandle");

const comparisonRange =
    $("#comparisonRange");


function updateComparison(value) {

    comparisonAfter.style.width =
        `${value}%`;

    comparisonHandle.style.left =
        `${value}%`;

}


comparisonRange.addEventListener(
    "input",
    (event) => {

        updateComparison(
            event.target.value
        );

    }
);


let dragging = false;


comparisonHandle.addEventListener(
    "pointerdown",
    () => {

        dragging = true;

    }
);


window.addEventListener(
    "pointerup",
    () => {

        dragging = false;

    }
);


comparison.addEventListener(
    "pointermove",
    (event) => {

        if (!dragging) return;


        const rect =
            comparison.getBoundingClientRect();


        let percentage =
            ((event.clientX - rect.left) /
                rect.width) * 100;


        percentage =
            Math.max(
                20,
                Math.min(
                    80,
                    percentage
                )
            );


        comparisonRange.value =
            percentage;


        updateComparison(
            percentage
        );

    }
);


updateComparison(50);


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