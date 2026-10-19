const contactForm = document.getElementById('contactForm');
const contactApiBase = String(window.EVOLVA_API_BASE || '').replace(/\/$/, '');

for (const link of document.querySelectorAll('[data-service]')) {
  link.addEventListener('click', () => {
    const serviceSelect = document.getElementById('contactService');
    if (!serviceSelect) return;

    const requestedService = link.dataset.service || '';
    const exactMatch = Array.from(serviceSelect.options).find(
      (option) => option.text === requestedService
    );
    const fallbackMatch = Array.from(serviceSelect.options).find(
      (option) => option.text.includes(requestedService.split(' — ')[0])
    );

    if (exactMatch || fallbackMatch) {
      serviceSelect.value = (exactMatch || fallbackMatch).value;
    }
  });
}

if (contactForm) {
  contactForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const submitButton = document.getElementById('contactSubmit');
    const status = document.getElementById('formStatus');
    const formData = new FormData(contactForm);
    const payload = Object.fromEntries(formData.entries());
    payload.consent = contactForm.elements.consent.checked;

    submitButton.disabled = true;
    status.textContent = 'Enviando tu consulta…';

    try {
      if (window.location.protocol === 'file:') {
        throw new Error('Abre el sitio desde el servidor EVOLVA para enviar la consulta.');
      }

      const response = await fetch(`${contactApiBase}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || 'No se pudo enviar la consulta. Revisa la conexión con EVOLVA.');
      }

      contactForm.reset();
      status.textContent = '¡Consulta recibida! Te contactaremos pronto.';
    } catch (error) {
      status.textContent = error.message || 'No se pudo enviar la consulta. Inténtalo nuevamente.';
    } finally {
      submitButton.disabled = false;
    }
  });
}
