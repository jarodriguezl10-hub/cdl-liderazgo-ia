// ==========================================
// CONFIGURACIÓN DE SUPABASE
// ==========================================
const SUPABASE_URL = 'https://jredmwkogtibqptxjxtx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpyZWRtd2tvZ3RpYnFwdHhqeHR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk1NjcsImV4cCI6MjA5MjA0NTU2N30.MUfyZpcCPkOZAYiQdPSdzrWo-wnBI1TUIhtNTvUgbM0';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: window.sessionStorage,
        autoRefreshToken: true,
        persistSession: true
    }
});

// ==========================================
// ESTADO GLOBAL
// ==========================================
let currentSession = null;
let prospectosData = [];
let currentProspectoId = null;
let isRegisterMode = false;
let activeProjectName = localStorage.getItem('activeProjectName') || 'Seguimiento Clientes';

// ==========================================
// INICIALIZACIÓN Y AUTH
// ==========================================
async function initCRM() {
    console.log("initCRM STARTED");
    
    // Listeners para formateo de moneda en tiempo real
    setupCurrencyInput('det-costo-final');
    setupCurrencyInput('pago-monto');

    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    // Verificar si hay sesión activa
    try {
        const { data: { session } } = await db.auth.getSession();
        if (session) {
            await validateSession(session);
        } else {
            document.getElementById('login-screen').classList.add('active');
        }

        // Listener de estado de auth
        db.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
                await validateSession(session);
            } else if (event === 'SIGNED_OUT') {
                document.getElementById('crm-screen').classList.remove('active');
                document.getElementById('login-screen').classList.add('active');
            }
        });
    } catch (err) {
        console.error("Critical error in initCRM:", err);
    }
}

document.addEventListener('DOMContentLoaded', initCRM);

// ==========================================
// UTILIDADES (TOAST & FORMAT)
// ==========================================
function showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

function setupCurrencyInput(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.type = 'text'; 
    el.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, "");
        if (val) e.target.value = new Intl.NumberFormat('es-CO').format(val);
        else e.target.value = '';
    });
}

function parseCurrency(str) {
    if(!str) return 0;
    return parseFloat(str.toString().replace(/\./g, ""));
}

// ==========================================
// GESTIÓN DE PROYECTOS
// ==========================================
async function loadProyectos() {
    const { data, error } = await db.from('crm_proyectos').select('*').order('nombre', { ascending: true });
    if(error || !data || data.length === 0) return;

    const list = document.getElementById('projects-list');
    list.innerHTML = '';
    
    let foundActive = false;

    data.forEach(p => {
        const a = document.createElement('a');
        a.href = "#";
        if (p.nombre === activeProjectName) {
            a.className = 'nav-item active';
            foundActive = true;
        } else {
            a.className = 'nav-item';
        }
        a.innerHTML = `🎯 ${p.nombre}`;
        a.onclick = (e) => {
            e.preventDefault();
            selectProject(p.nombre);
        };
        list.appendChild(a);
    });

    // Validar si el proyecto en caché ya no existe (por ejemplo, fue renombrado)
    if (!foundActive && data.length > 0) {
        // En lugar de renderizar el inválido, seleccionamos automáticamente el primero
        selectProject(data[0].nombre);
        return; // selectProject ya va a recargar UI y prospectos
    }

    // Actualizar títulos si lo encontró
    document.getElementById('active-project-title').textContent = activeProjectName;
    const projectLabel = document.getElementById('label-active-project-creation');
    if(projectLabel) projectLabel.textContent = activeProjectName;
}

async function selectProject(name) {
    activeProjectName = name;
    localStorage.setItem('activeProjectName', name);
    
    // UI Update
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    loadProyectos(); 
    
    showToast(`Cambiando a: ${name}`);
    loadProspectos();
}

async function crearNuevoProyecto() {
    const nombre = prompt("Ingrese el nombre del nuevo proyecto:");
    if (!nombre) return;

    const { error } = await db.from('crm_proyectos').insert([{ nombre }]);
    if (error) {
        alert("Error al crear proyecto: " + error.message);
        return;
    }

    showToast("Proyecto creado con éxito");
    selectProject(nombre);
}

// ==========================================
// VALIDACIÓN Y AUTH LOGIC
// ==========================================
async function validateSession(session) {
    currentSession = session;
    const email = session.user.email;
    const { data, error } = await db.from('crm_usuarios_auth').select('autorizado').eq('email', email).single();

    if (error || !data || data.autorizado !== true) {
        await db.auth.signOut();
        const errDiv = document.getElementById('login-error');
        if (errDiv) {
            errDiv.textContent = "Acceso Restringido: Tu cuenta todavía no ha sido autorizada.";
            errDiv.style.display = 'block';
        }
        document.getElementById('login-screen').classList.add('active');
        document.getElementById('crm-screen').classList.remove('active');
        return;
    }

    document.getElementById('user-email').textContent = email;
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('crm-screen').classList.add('active');
    
    await loadProyectos(); 
    loadProspectos(); 
}

async function logout() {
    await db.auth.signOut();
    document.getElementById('crm-screen').classList.remove('active');
    document.getElementById('login-screen').classList.add('active');
}

// ==========================================
// KANBAN LOGIC
// ==========================================
async function loadProspectos() {
    const { data, error } = await db.from('crm_prospectos')
        .select('*')
        .eq('proyecto_nombre', activeProjectName)
        .order('fecha_registro', { ascending: false });

    prospectosData = error ? [] : (data || []);
    renderKanban();
}

function renderKanban() {
    const statuses = ['Nuevo', 'Contactado', 'Negociación', 'Pagado', 'Descartado'];
    statuses.forEach(status => {
        const col = document.getElementById(`col-${status}`);
        if(col) col.innerHTML = '';
        const count = document.getElementById(`count-${status}`);
        if(count) count.textContent = '0';
    });
    let counts = { 'Nuevo': 0, 'Contactado': 0, 'Negociación': 0, 'Pagado': 0, 'Descartado': 0 };
    prospectosData.forEach(p => {
        const targetStatus = counts[p.estado] !== undefined ? p.estado : 'Nuevo';
        counts[targetStatus]++;
        const col = document.getElementById(`col-${targetStatus}`);
        if(col) col.appendChild(createCard(p));
    });
    Object.keys(counts).forEach(k => {
        const count = document.getElementById(`count-${k}`);
        if(count) count.textContent = counts[k];
    });
}

function createCard(p) {
    const card = document.createElement('div');
    card.className = 'k-card';
    card.onclick = () => openDetailModal(p.id);
    const dateStr = new Date(p.fecha_registro).toLocaleDateString('es-CO');
    const abonado = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(p.valor_total_pagado || 0);
    const total = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(p.costo_final_certificacion || 0);

    card.innerHTML = `
        <div class="k-card-title">${p.nombre}</div>
        <div class="k-card-date">🗓️ ${dateStr}</div>
        <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.2rem;">Inv. Total: ${total}</div>
        <div class="k-card-meta">
            <span>📱 ${p.telefono}</span>
            <span style="color: #10B981; font-weight: 600;">Pagado: ${abonado}</span>
        </div>
    `;
    return card;
}

// ==========================================
// CREACIÓN DE PROSPECTOS
// ==========================================
function openCreateModal() {
    document.getElementById('create-modal').classList.add('active');
}

function closeCreateModal() {
    document.getElementById('create-modal').classList.remove('active');
}

async function saveNuevoProspecto() {
    const nombre = document.getElementById('new-nombre').value;
    const telefono = document.getElementById('new-telefono').value;
    const email = document.getElementById('new-email').value;
    const comoSeEntero = document.getElementById('new-como-se-entero').value;
    const observaciones = document.getElementById('new-observaciones').value;

    if(!nombre || !telefono) {
        showToast("Nombre y teléfono son obligatorios");
        return;
    }

    const { error } = await db.from('crm_prospectos').insert([{
        nombre,
        telefono,
        email,
        proyecto_nombre: activeProjectName,
        estado: 'Nuevo',
        como_se_entero: comoSeEntero,
        observaciones: observaciones
    }]);

    if(error) {
        alert("Error al crear prospecto: " + error.message);
        return;
    }

    showToast("Prospecto creado con éxito");
    closeCreateModal();
    
    // Limpiar campos
    document.getElementById('new-nombre').value = '';
    document.getElementById('new-telefono').value = '';
    document.getElementById('new-email').value = '';
    document.getElementById('new-como-se-entero').value = 'Landing page';
    document.getElementById('new-observaciones').value = '';
    
    loadProspectos();
}

// ==========================================
// MODAL & DETAIL LOGIC
// ==========================================
async function openDetailModal(id) {
    currentProspectoId = id;
    const p = prospectosData.find(x => x.id === id);
    if (!p) return;

    // Limpiar campos de nuevos registros para que no se hereden de la tarjeta anterior
    document.getElementById('int-notas').value = '';
    document.getElementById('int-tipo').selectedIndex = 0;
    document.getElementById('pago-monto').value = '';
    document.getElementById('pago-notas').value = '';
    document.getElementById('pago-metodo').selectedIndex = 0;

    document.getElementById('det-nombre').textContent = p.nombre;
    document.getElementById('det-email').textContent = '✉️ ' + p.email;
    document.getElementById('det-telefono').textContent = '📱 ' + p.telefono;
    document.getElementById('det-estado').value = (p.estado === 'Pendiente volver a contactar') ? 'Nuevo' : (p.estado || 'Nuevo');
    document.getElementById('det-proximo').value = p.fecha_proximo_contacto ? p.fecha_proximo_contacto.split('T')[0] : '';

    document.getElementById('det-costo-final').value = p.costo_final_certificacion ? new Intl.NumberFormat('es-CO').format(p.costo_final_certificacion) : '0';
    document.getElementById('det-modalidad').value = p.modalidad_pago || 'Contado';
    document.getElementById('det-observaciones-pago').value = p.observaciones_pago || '';

    document.getElementById('det-tipo-pago').value = p.tipo_pago_preferido || 'Total';
    document.getElementById('det-fecha-siguiente').value = p.fecha_siguiente_pago || '';

    toggleExtraPaymentFields();
    renderBalanceDisplay(p);
    renderAcuerdoHistory();

    switchTab('info');
    document.getElementById('detail-modal').classList.add('active');
    loadInteracciones();
    loadPagos();
}

function renderBalanceDisplay(p) {
    const fmt = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v || 0);
    document.getElementById('det-total-pagado').textContent = fmt(p.valor_total_pagado);
    document.getElementById('det-total-inversion').textContent = fmt(p.costo_final_certificacion);
}

function toggleExtraPaymentFields() {
    const tipo = document.getElementById('det-tipo-pago').value;
    document.getElementById('wrapper-fecha-siguiente').style.display = (tipo === 'Abono') ? 'block' : 'none';
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if(btn.getAttribute('onclick').includes(`'${tabId}'`)) btn.classList.add('active');
    });
    document.getElementById(`tab-${tabId}`).style.display = 'block';
}

async function updateEstado() {
    const { error } = await db.from('crm_prospectos').update({ estado: document.getElementById('det-estado').value }).eq('id', currentProspectoId);
    if (error) {
        alert("Error al actualizar estado: " + error.message);
        return;
    }
    showToast("Estado actualizado");
    loadProspectos();
}

async function saveAcuerdoPago() {
    const costo = parseCurrency(document.getElementById('det-costo-final').value);
    const mod = document.getElementById('det-modalidad').value;
    const obs = document.getElementById('det-observaciones-pago').value;

    const { error } = await db.from('crm_prospectos').update({ 
        costo_final_certificacion: costo,
        modalidad_pago: mod,
        observaciones_pago: obs
    }).eq('id', currentProspectoId);

    if(!error) {
        const pIndex = prospectosData.findIndex(x => x.id === currentProspectoId);
        if(pIndex !== -1) {
            prospectosData[pIndex].costo_final_certificacion = costo;
            prospectosData[pIndex].modalidad_pago = mod;
            prospectosData[pIndex].observaciones_pago = obs;
            renderBalanceDisplay(prospectosData[pIndex]);
            renderKanban();
            renderAcuerdoHistory();
        }
        showToast("Acuerdo guardado");
    } else {
        alert("Error al guardar acuerdo: " + error.message);
    }
}

function renderAcuerdoHistory() {
    const p = prospectosData.find(x => x.id === currentProspectoId);
    if(!p) return;
    const history = document.getElementById('det-acuerdo-history');
    history.innerHTML = `
        <div class="history-item" style="border-left-color: var(--text-muted);">
            <div class="h-date">Última actualización</div>
            <div class="h-type">Modalidad: ${p.modalidad_pago || 'No definida'}</div>
            <div class="h-notes">${p.observaciones_pago || 'Sin observaciones descriptivas del acuerdo.'}</div>
        </div>
    `;
}

async function loadInteracciones() {
    const { data } = await db.from('crm_interacciones').select('*').eq('prospecto_id', currentProspectoId).order('fecha_registro', { ascending: false });
    const list = document.getElementById('det-history');
    list.innerHTML = (data || []).map(i => `
        <div class="history-item">
            <div class="h-date">${new Date(i.fecha_registro).toLocaleString('es-CO')}</div>
            <div class="h-type">${i.tipo}</div>
            <div class="h-notes">${i.notas || ''}</div>
        </div>
    `).join('');
}

async function addInteraccion() {
    const tipo = document.getElementById('int-tipo').value;
    const notas = document.getElementById('int-notas').value;
    if(!notas) return;
    const { error } = await db.from('crm_interacciones').insert([{ prospecto_id: currentProspectoId, tipo, notas }]);
    if (error) {
        alert("Error al registrar interacción: " + error.message);
        return;
    }
    await db.from('crm_prospectos').update({ fecha_ultimo_contacto: new Date().toISOString() }).eq('id', currentProspectoId);
    document.getElementById('int-notas').value = '';
    document.getElementById('int-tipo').selectedIndex = 0;
    showToast("Interacción registrada");
    loadInteracciones();
}

async function loadPagos() {
    const { data } = await db.from('crm_pagos').select('*').eq('prospecto_id', currentProspectoId).order('fecha_pago', { ascending: false });
    let total = 0;
    const list = document.getElementById('det-pagos-list');
    list.innerHTML = (data || []).map(p => {
        total += parseFloat(p.monto);
        const amt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(p.monto);
        return `
            <div class="history-item" style="border-left-color: #10B981;">
                <div class="h-date">${new Date(p.fecha_pago).toLocaleString('es-CO')}</div>
                <div class="h-type" style="color: #10B981;">${amt} - ${p.metodo}</div>
                <div class="h-notes">${p.notas || ''}</div>
            </div>
        `;
    }).join('');
    
    await db.from('crm_prospectos').update({ valor_total_pagado: total }).eq('id', currentProspectoId);
    const pIndex = prospectosData.findIndex(x => x.id === currentProspectoId);
    if(pIndex !== -1) {
        prospectosData[pIndex].valor_total_pagado = total;
        renderBalanceDisplay(prospectosData[pIndex]);
    }
}

async function addPago() {
    const monto = parseCurrency(document.getElementById('pago-monto').value);
    const metodo = document.getElementById('pago-metodo').value;
    const notas = document.getElementById('pago-notas').value;
    if(!monto || isNaN(monto)) return;
    const { error } = await db.from('crm_pagos').insert([{ prospecto_id: currentProspectoId, monto, metodo, notas }]);
    if (error) {
        alert("Error al registrar pago: " + error.message);
        return;
    }
    document.getElementById('pago-monto').value = '';
    document.getElementById('pago-notas').value = '';
    document.getElementById('pago-metodo').selectedIndex = 0;
    showToast("Pago registrado");
    loadPagos();
}

async function updateCamposExtra() {
    const tipo = document.getElementById('det-tipo-pago').value;
    const fechaSig = document.getElementById('det-fecha-siguiente').value;
    toggleExtraPaymentFields();
    const { error } = await db.from('crm_prospectos').update({ tipo_pago_preferido: tipo, fecha_siguiente_pago: fechaSig || null }).eq('id', currentProspectoId);
    if (error) {
        alert("Error al actualizar campos extra: " + error.message);
        return;
    }
    const pIndex = prospectosData.findIndex(x => x.id === currentProspectoId);
    if(pIndex !== -1) {
        prospectosData[pIndex].tipo_pago_preferido = tipo;
        prospectosData[pIndex].fecha_siguiente_pago = fechaSig;
    }
}

async function updateProximoContacto() {
    const fecha = document.getElementById('det-proximo').value;
    const { error } = await db.from('crm_prospectos').update({ fecha_proximo_contacto: fecha ? (fecha + 'T00:00:00Z') : null }).eq('id', currentProspectoId);
    if (error) {
        alert("Error al programar seguimiento: " + error.message);
        return;
    }
    showToast("Seguimiento programado");
}

function closeDetailModal() { document.getElementById('detail-modal').classList.remove('active'); currentProspectoId = null; }
function togglePasswordVisibility() { const el = document.getElementById('login-password'); el.type = (el.type === 'password') ? 'text' : 'password'; }
function bypassParaVer() { showToast("Bypass ya no es necesario."); }

function toggleAuthMode() {
    isRegisterMode = !isRegisterMode;
    const title = document.getElementById('auth-title');
    const desc = document.getElementById('auth-desc');
    const btnSubmit = document.getElementById('btn-auth-submit');
    const btnToggle = document.getElementById('btn-toggle-auth');
    const regFields = document.getElementById('register-fields');
    const regName = document.getElementById('reg-name');

    if (isRegisterMode) {
        title.textContent = 'Registro en CRM';
        desc.textContent = 'Crea tu cuenta para acceder a la plataforma.';
        btnSubmit.textContent = 'Registrarse';
        btnToggle.textContent = '¿Ya tienes cuenta? Ingresa aquí';
        regFields.style.display = 'block';
        regName.required = true;
    } else {
        title.textContent = 'Acceso al CRM';
        desc.textContent = 'Ingresa tus credenciales para administrar tus prospectos.';
        btnSubmit.textContent = 'Ingresar';
        btnToggle.textContent = '¿No tienes cuenta? Regístrate';
        regFields.style.display = 'none';
        regName.required = false;
    }
}

async function handleAuth() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const name = document.getElementById('reg-name').value;
    const errorMsg = document.getElementById('login-error');
    const successMsg = document.getElementById('login-success');
    
    errorMsg.style.display = 'none';
    successMsg.style.display = 'none';

    if (isRegisterMode) {
        const { data, error } = await db.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: name }
            }
        });

        if (error) {
            errorMsg.textContent = "Error al registrarse: " + error.message;
            errorMsg.style.display = 'block';
        } else {
            // Actualizar el nombre en la tabla pública crm_usuarios_auth luego del registro
            await db.from('crm_usuarios_auth').update({ nombre: name }).eq('email', email);

            successMsg.textContent = "Registro exitoso. Revisa tu correo o espera a ser autorizado.";
            successMsg.style.display = 'block';
            toggleAuthMode();
            document.getElementById('login-password').value = '';
        }
    } else {
        const { data, error } = await db.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) {
            errorMsg.textContent = "Error al ingresar: Credenciales inválidas o tu cuenta necesita validación.";
            errorMsg.style.display = 'block';
        } else {
            // El listener publicará éxito una vez que initCRM lo procese
        }
    }
}

