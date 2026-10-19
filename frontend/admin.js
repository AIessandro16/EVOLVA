const apiBase = (window.EVOLVA_API_BASE || '').replace(/\/$/, '');
const loginPanel = document.getElementById('loginPanel');
const dashboard = document.getElementById('dashboard');
const loginStatus = document.getElementById('loginStatus');
const dashboardStatus = document.getElementById('dashboardStatus');
const contactList = document.getElementById('contactList');

async function api(path, options = {}) {
    if (window.location.protocol === 'file:') {
        throw new Error('Estás abriendo el archivo directamente. En VS Code ejecuta «npm start» y abre http://localhost:3000/admin.html.');
    }
    const token = sessionStorage.getItem('evolva-admin-token');
    let response;
    try {
        response = await fetch(`${apiBase}${path}`, {
            credentials: 'include',
            ...options,
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) }
        });
    } catch {
        throw new Error('No se pudo conectar con la API de EVOLVA. Inicia el servidor con «npm start» y abre el sitio desde http://localhost:3000.');
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        if (response.status === 429) throw new Error('Se alcanzó el límite de intentos. Espera 15 minutos y vuelve a probar.');
        const contentType = response.headers.get('content-type') || 'respuesta sin tipo de contenido';
        throw new Error(result.error || result.message || `La API respondió HTTP ${response.status} (${contentType}) en ${response.url}. Comprueba que el sitio esté abierto desde el servidor EVOLVA.`);
    }
    return result;
}

function showDashboard() {
    loginPanel.hidden = true;
    dashboard.hidden = false;
    loadContacts();
}

async function loadContacts() {
    dashboardStatus.textContent = 'Cargando consultas…';
    contactList.replaceChildren();
    try {
        const { contacts } = await api('/api/admin/contacts');
        document.getElementById('contactCount').textContent = `${contacts.length} ${contacts.length === 1 ? 'consulta' : 'consultas'} recientes`;
        if (!contacts.length) {
            const empty = document.createElement('p');
            empty.className = 'empty-state';
            empty.textContent = 'Todavía no has recibido consultas.';
            contactList.append(empty);
        }
        contacts.forEach((contact) => {
            const card = document.createElement('article');
            card.className = 'contact-card';
            const heading = document.createElement('div');
            heading.className = 'contact-card-heading';
            const name = document.createElement('h2');
            name.textContent = contact.name;
            const date = document.createElement('time');
            date.dateTime = contact.created_at;
            date.textContent = new Date(`${contact.created_at.replace(' ', 'T')}Z`).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' });
            heading.append(name, date);
            const details = document.createElement('dl');
            [[ 'Correo', contact.email ], [ 'Negocio', contact.business || 'No especificado' ], [ 'Servicio', contact.service ]].forEach(([label, value]) => {
                const group = document.createElement('div');
                const term = document.createElement('dt');
                term.textContent = label;
                const description = document.createElement('dd');
                description.textContent = value;
                group.append(term, description);
                details.append(group);
            });
            const message = document.createElement('p');
            message.className = 'contact-card-message';
            message.textContent = contact.message;
            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.className = 'button secondary contact-delete-button';
            deleteButton.textContent = 'Eliminar solicitud';
            deleteButton.setAttribute('aria-label', `Eliminar solicitud de ${contact.name}`);
            deleteButton.addEventListener('click', async () => {
                if (!window.confirm(`¿Eliminar la solicitud de ${contact.name}? Esta acción no se puede deshacer.`)) return;
                deleteButton.disabled = true;
                dashboardStatus.textContent = 'Eliminando solicitud…';
                try {
                    await api(`/api/admin/contacts/${contact.id}`, { method: 'DELETE' });
                    await loadContacts();
                } catch (error) {
                    dashboardStatus.textContent = error.message;
                    deleteButton.disabled = false;
                }
            });
            card.append(heading, details, message, deleteButton);
            contactList.append(card);
        });
        dashboardStatus.textContent = '';
    } catch (error) {
        dashboardStatus.textContent = error.message;
    }
}

document.getElementById('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = document.getElementById('loginButton');
    button.disabled = true;
    loginStatus.textContent = 'Verificando acceso…';
    try {
        const { token } = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: document.getElementById('adminPassword').value }) });
        sessionStorage.setItem('evolva-admin-token', token);
        document.getElementById('adminPassword').value = '';
        showDashboard();
    } catch (error) {
        loginStatus.textContent = error.message;
    } finally {
        button.disabled = false;
    }
});

document.getElementById('logoutButton').addEventListener('click', async () => {
    try {
        await api('/api/admin/logout', { method: 'POST' });
    } finally {
        sessionStorage.removeItem('evolva-admin-token');
        dashboard.hidden = true;
        loginPanel.hidden = false;
        loginStatus.textContent = 'Sesión cerrada.';
    }
});

api('/api/admin/session').then(({ authenticated }) => {
    if (authenticated) showDashboard();
}).catch(() => {});
