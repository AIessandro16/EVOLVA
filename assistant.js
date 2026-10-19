const assistantToggle = document.getElementById('assistantToggle');
const assistantPanel = document.getElementById('assistantPanel');
const assistantClose = document.getElementById('assistantClose');
const assistantForm = document.getElementById('assistantForm');
const assistantInput = document.getElementById('assistantInput');
const assistantMessages = document.getElementById('assistantMessages');
const assistantStatus = document.getElementById('assistantStatus');
const apiBase = (window.EVOLVA_API_BASE || '').replace(/\/$/, '');
const conversationHistory = [];

function setAssistantOpen(open) {
    assistantPanel.hidden = !open;
    assistantToggle.setAttribute('aria-expanded', String(open));
    if (open) assistantInput.focus();
}

assistantToggle.addEventListener('click', () => setAssistantOpen(assistantPanel.hidden));
assistantClose.addEventListener('click', () => setAssistantOpen(false));

function addMessage(text, role) {
    const message = document.createElement('p');
    message.className = `assistant-message ${role === 'user' ? 'assistant-user' : 'assistant-reply'}`;
    message.textContent = text;
    assistantMessages.append(message);
    assistantMessages.scrollTop = assistantMessages.scrollHeight;
}

assistantForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = assistantInput.value.trim();
    if (!message) return;
    addMessage(message, 'user');
    assistantInput.value = '';
    assistantInput.disabled = true;
    assistantForm.querySelector('button').disabled = true;
    assistantStatus.textContent = 'Evol está pensando…';
    try {
        if (window.location.protocol === 'file:') {
            throw new Error('Para usar el asistente, ejecuta «npm start» en la carpeta EVOLVA y abre http://localhost:3000.');
        }
        const response = await fetch(`${apiBase}/api/assistant`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, history: conversationHistory.slice(-8) })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            const fallback = response.status === 429
                ? 'Has enviado varias preguntas seguidas. Espera un minuto y vuelve a intentarlo.'
                : response.status === 503
                    ? 'El asistente está temporalmente sin configuración. Inténtalo más tarde.'
                    : 'No se pudo obtener una respuesta. Inténtalo de nuevo.';
            throw new Error(result.error || fallback);
        }
        if (typeof result.answer !== 'string' || !result.answer.trim()) {
            throw new Error('No llegó una respuesta completa. Inténtalo de nuevo con una pregunta más corta.');
        }
        conversationHistory.push(
            { role: 'user', text: message },
            { role: 'assistant', parts: result.modelTurn?.parts || [{ text: result.answer }] }
        );
        if (conversationHistory.length > 8) conversationHistory.splice(0, conversationHistory.length - 8);
        addMessage(result.answer, 'assistant');
        assistantStatus.textContent = 'Las respuestas son orientación inicial para tu negocio.';
    } catch (error) {
        const messageText = error instanceof TypeError
            ? 'No pude conectar con el servidor de EVOLVA. Revisa que esté abierto y vuelve a intentarlo.'
            : error.message || 'El asistente no pudo responder. Inténtalo de nuevo.';
        addMessage(messageText, 'assistant');
        assistantInput.value = message;
        assistantStatus.textContent = 'Tu pregunta quedó en el campo para que puedas volver a enviarla.';
    } finally {
        assistantInput.disabled = false;
        assistantForm.querySelector('button').disabled = false;
        assistantInput.focus();
    }
});
