// ====================================================
// GYMBRO — Sistema de Gestión para Entrenador Personal
// ====================================================

// ==================== DATABASE ====================
let db = null;
let SQL = null;

async function initDatabase() {
    try {
        SQL = await initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
        });
        const savedDb = localStorage.getItem('gymbro_db');
        if (savedDb) {
            const data = new Uint8Array(JSON.parse(savedDb));
            db = new SQL.Database(data);
        } else {
            db = new SQL.Database();
            createTables();
            insertDefaultData();
        }
        return true;
    } catch (error) {
        console.error('Error init DB:', error);
        db = new SQL.Database();
        createTables();
        insertDefaultData();
        return true;
    }
}

function createTables() {
    db.run(`
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            notes TEXT,
            status TEXT DEFAULT 'active',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS routines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT,
            duration INTEGER DEFAULT 45,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER,
            amount REAL,
            due_date TEXT,
            status TEXT DEFAULT 'pending',
            paid_date TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(student_id) REFERENCES students(id)
        );
        CREATE TABLE IF NOT EXISTS scheduled_classes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER,
            routine_id INTEGER,
            date TEXT,
            time TEXT,
            status TEXT DEFAULT 'scheduled',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(student_id) REFERENCES students(id),
            FOREIGN KEY(routine_id) REFERENCES routines(id)
        );
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY,
            gym_name TEXT DEFAULT 'GymBro',
            class_price REAL DEFAULT 250,
            currency TEXT DEFAULT 'ARS',
            open_time TEXT DEFAULT '06:00',
            close_time TEXT DEFAULT '22:00'
        );
    `);
}

function insertDefaultData() {
    db.run(`INSERT OR IGNORE INTO settings (id, gym_name, class_price, currency) VALUES (1, 'GymBro', 250, 'ARS')`);

    db.run(`INSERT OR IGNORE INTO students (id, name, email, phone, status, notes) VALUES
        (1, 'Ana García', 'ana@email.com', '11 5523-4567', 'active', 'Objetivo: perder peso'),
        (2, 'Carlos López', 'carlos@email.com', '11 1234-5678', 'active', 'Lesión en rodilla izquierda'),
        (3, 'María Rodríguez', 'maria@email.com', '11 8765-4321', 'active', ''),
        (4, 'Pedro Martínez', 'pedro@email.com', '11 5512-3456', 'inactive', 'Pausó por viaje'),
        (5, 'Laura Hernández', 'laura@email.com', '11 7891-2345', 'active', 'Competidora fitness')`);

    db.run(`INSERT OR IGNORE INTO routines (id, name, type, duration) VALUES
        (1, 'Fuerza Principiante', 'strength', 45),
        (2, 'Cardio Intermedio', 'cardio', 30),
        (3, 'Stretching y Flexibilidad', 'flexibility', 40),
        (4, 'Piernas Avanzada', 'strength', 60)`);

    const today = new Date().toISOString().split('T')[0];
    const dueSoon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    db.run(`INSERT OR IGNORE INTO payments (id, student_id, amount, due_date, status) VALUES
        (1, 1, 5000, '${dueSoon}', 'paid'),
        (2, 2, 2500, '${dueSoon}', 'pending'),
        (3, 3, 7500, '${today}', 'overdue')`);

    db.run(`INSERT OR IGNORE INTO scheduled_classes (id, student_id, routine_id, date, time) VALUES
        (1, 1, 1, '${today}', '07:00'),
        (2, 2, 2, '${today}', '09:00'),
        (3, 3, 4, '${today}', '11:00')`);
}

function saveDatabase() {
    try {
        const data = db.export();
        localStorage.setItem('gymbro_db', JSON.stringify(Array.from(data)));
    } catch (e) { console.error('Error saving DB:', e); }
}

// ==================== DATA OPS ====================
function getAllStudents() {
    const r = db.exec(`SELECT * FROM students ORDER BY name`);
    return r.length ? r[0].values.map(row => ({
        id: row[0], name: row[1], email: row[2], phone: row[3],
        notes: row[4], status: row[5], created_at: row[6]
    })) : [];
}

function getActiveStudents() {
    const r = db.exec(`SELECT * FROM students WHERE status = 'active' ORDER BY name`);
    return r.length ? r[0].values.map(row => ({
        id: row[0], name: row[1], email: row[2], phone: row[3],
        notes: row[4], status: row[5], created_at: row[6]
    })) : [];
}

function addStudent(name, email, phone, notes, status = 'active') {
    db.run(`INSERT INTO students (name, email, phone, notes, status) VALUES (?, ?, ?, ?, ?)`,
        [name, email, phone, notes, status]);
    saveDatabase();
}

function updateStudent(id, name, email, phone, notes, status) {
    db.run(`UPDATE students SET name=?, email=?, phone=?, notes=?, status=? WHERE id=?`,
        [name, email, phone, notes, status, id]);
    saveDatabase();
}

function deleteStudent(id) {
    db.run(`DELETE FROM students WHERE id=?`, [id]);
    saveDatabase();
}

function getAllRoutines() {
    const r = db.exec(`SELECT * FROM routines ORDER BY name`);
    return r.length ? r[0].values.map(row => ({
        id: row[0], name: row[1], type: row[2], duration: row[3], created_at: row[4]
    })) : [];
}

function addRoutine(name, type, duration) {
    db.run(`INSERT INTO routines (name, type, duration) VALUES (?, ?, ?)`, [name, type, duration]);
    saveDatabase();
}

function deleteRoutineFromDB(id) {
    db.run(`DELETE FROM routines WHERE id=?`, [id]);
    saveDatabase();
}

function getAllPayments() {
    const r = db.exec(`
        SELECT p.*, s.name as student_name
        FROM payments p
        LEFT JOIN students s ON p.student_id = s.id
        ORDER BY p.created_at DESC
    `);
    return r.length ? r[0].values.map(row => ({
        id: row[0], student_id: row[1], amount: row[2], due_date: row[3],
        status: row[4], paid_date: row[5], created_at: row[6], student_name: row[7]
    })) : [];
}

function getPendingPaymentsCount() {
    const r = db.exec(`SELECT COUNT(*) FROM payments WHERE status='pending' OR status='overdue'`);
    return r.length ? r[0].values[0][0] : 0;
}

function addPayment(studentId, amount, dueDate, status = 'pending') {
    const paidDate = status === 'paid' ? new Date().toISOString().split('T')[0] : null;
    db.run(`INSERT INTO payments (student_id, amount, due_date, status, paid_date) VALUES (?, ?, ?, ?, ?)`,
        [studentId, amount, dueDate, status, paidDate]);
    saveDatabase();
}

function updatePayment(id, studentId, amount, dueDate, status) {
    const paidDate = status === 'paid' ? new Date().toISOString().split('T')[0] : null;
    db.run(`UPDATE payments SET student_id=?, amount=?, due_date=?, status=?, paid_date=? WHERE id=?`,
        [studentId, amount, dueDate, status, paidDate, id]);
    saveDatabase();
}

function updatePaymentStatus(id, status) {
    db.run(`UPDATE payments SET status=?, paid_date=? WHERE id=?`,
        [status, status === 'paid' ? new Date().toISOString().split('T')[0] : null, id]);
    saveDatabase();
}

function getTotalPaidIncome() {
    const r = db.exec(`SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status='paid'`);
    return r.length ? r[0].values[0][0] : 0;
}

function getAllScheduledClasses() {
    const r = db.exec(`
        SELECT c.*, s.name as student_name, r.name as routine_name
        FROM scheduled_classes c
        LEFT JOIN students s ON c.student_id = s.id
        LEFT JOIN routines r ON c.routine_id = r.id
        ORDER BY c.date, c.time
    `);
    return r.length ? r[0].values.map(row => ({
        id: row[0], student_id: row[1], routine_id: row[2], date: row[3],
        time: row[4], status: row[5], student_name: row[7], routine_name: row[8]
    })) : [];
}

function addScheduledClass(studentId, routineId, date, time) {
    db.run(`INSERT INTO scheduled_classes (student_id, routine_id, date, time) VALUES (?, ?, ?, ?)`,
        [studentId, routineId, date, time]);
    saveDatabase();
}

function deleteScheduledClassFromDB(id) {
    db.run(`DELETE FROM scheduled_classes WHERE id=?`, [id]);
    saveDatabase();
}

function getSettings() {
    const r = db.exec(`SELECT * FROM settings WHERE id=1`);
    return r.length ? {
        gymName: r[0].values[0][1], classPrice: r[0].values[0][2],
        currency: r[0].values[0][3], openTime: r[0].values[0][4], closeTime: r[0].values[0][5]
    } : null;
}

function saveSettingsToDB(s) {
    db.run(`UPDATE settings SET gym_name=?, class_price=?, currency=?, open_time=?, close_time=? WHERE id=1`,
        [s.gymName, s.classPrice, s.currency, s.openTime, s.closeTime]);
    saveDatabase();
}

// ==================== CUSTOM CONFIRM ====================
let _confirmResolve = null;

function showConfirm(title, message, okLabel = 'Eliminar') {
    return new Promise(resolve => {
        _confirmResolve = resolve;
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').textContent = message;
        document.getElementById('confirm-ok-btn').textContent = okLabel;
        document.getElementById('confirm-overlay').style.display = 'flex';
    });
}

function confirmAccept() {
    document.getElementById('confirm-overlay').style.display = 'none';
    if (_confirmResolve) { _confirmResolve(true); _confirmResolve = null; }
}

function confirmReject() {
    document.getElementById('confirm-overlay').style.display = 'none';
    if (_confirmResolve) { _confirmResolve(false); _confirmResolve = null; }
}

// ==================== RENDER ====================
function renderDashboard() {
    renderUpcomingClasses();
    renderRecentPayments();
    renderStats();
    updateBadges();
}

function renderStats() {
    const active = getActiveStudents().length;
    const classes = getAllScheduledClasses().length;
    const routines = getAllRoutines().length;
    const income = getTotalPaidIncome();
    const settings = getSettings() || { currency: 'ARS' };
    const symbol = currencySymbol(settings.currency);

    document.getElementById('stat-students').textContent = active;
    document.getElementById('stat-classes').textContent = classes;
    document.getElementById('stat-routines').textContent = routines;
    document.getElementById('stat-income').textContent = `${symbol}${income.toLocaleString('es-AR')}`;
}

function currencySymbol(c) {
    return c === 'EUR' ? '€' : '$';
}

function updateBadges() {
    const active = getActiveStudents().length;
    const pending = getPendingPaymentsCount();

    const sb = document.getElementById('student-count-badge');
    const pb = document.getElementById('payment-count-badge');

    if (sb) sb.textContent = active;
    if (pb) {
        pb.textContent = pending;
        pb.style.display = pending > 0 ? 'inline' : 'none';
    }
}

function renderUpcomingClasses() {
    const container = document.getElementById('upcoming-classes');
    const today = new Date().toISOString().split('T')[0];
    const classes = getAllScheduledClasses().filter(c => c.date >= today).slice(0, 5);

    if (!classes.length) {
        container.innerHTML = '<div class="empty-state">No hay clases programadas</div>';
        return;
    }

    container.innerHTML = classes.map(cls => `
        <div class="schedule-item">
            <div class="schedule-time">${cls.time}</div>
            <div class="schedule-dot"></div>
            <div class="schedule-info">
                <h4>${cls.student_name || 'Estudiante'}</h4>
                <p>${cls.routine_name || 'Rutina'} — ${formatDate(cls.date)}</p>
            </div>
            <button class="btn-icon danger" onclick="cancelClass(${cls.id})" title="Cancelar clase">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
            </button>
        </div>
    `).join('');
}

function renderRecentPayments() {
    const container = document.getElementById('recent-payments');
    const payments = getAllPayments().slice(0, 5);

    if (!payments.length) {
        container.innerHTML = '<div class="empty-state">No hay pagos recientes</div>';
        return;
    }

    const settings = getSettings() || { currency: 'ARS' };
    const sym = currencySymbol(settings.currency);
    const labels = { paid: 'Pagado', pending: 'Pendiente', overdue: 'Vencido' };

    container.innerHTML = payments.map(p => `
        <div class="payment-item">
            <div class="payment-info">
                <h4>${p.student_name || 'Estudiante'}</h4>
                <p>${formatDate(p.due_date)}</p>
            </div>
            <div style="text-align:right">
                <div class="payment-amount ${p.status}">${sym}${p.amount.toLocaleString('es-AR')}</div>
                <span class="payment-status ${p.status}">${labels[p.status]}</span>
            </div>
        </div>
    `).join('');
}

function renderStudents() {
    const container = document.getElementById('student-list');
    const searchTerm = (document.getElementById('student-search')?.value || '').toLowerCase();
    let students = getAllStudents();

    const total = students.length;
    const active = students.filter(s => s.status === 'active').length;
    document.getElementById('total-students').textContent = total;
    document.getElementById('active-students').textContent = active;
    document.getElementById('inactive-students').textContent = total - active;

    if (searchTerm) {
        students = students.filter(s =>
            s.name.toLowerCase().includes(searchTerm) ||
            (s.email || '').toLowerCase().includes(searchTerm)
        );
    }

    if (!students.length) {
        container.innerHTML = `<div class="empty-state">${searchTerm ? 'Sin resultados para "' + searchTerm + '"' : 'No hay estudiantes registrados'}</div>`;
        return;
    }

    container.innerHTML = students.map(s => `
        <div class="student-detail-card">
            <div class="student-avatar-large">${getInitials(s.name)}</div>
            <div class="student-detail-info">
                <div class="student-detail-header">
                    <h3>${s.name}</h3>
                    <span class="student-status ${s.status}">${s.status === 'active' ? 'Activo' : 'Inactivo'}</span>
                </div>
                <div class="student-detail-meta">
                    ${s.email ? `<span>✉ ${s.email}</span>` : ''}
                    ${s.phone ? `<span>📞 ${s.phone}</span>` : ''}
                </div>
                ${s.notes ? `<p class="student-notes">📝 ${s.notes}</p>` : ''}
                <div class="student-detail-actions">
                    <button class="btn btn-secondary btn-sm" onclick="editStudent(${s.id})">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        Editar
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteStudentConfirm(${s.id})">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                        Eliminar
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function renderRoutines() {
    const container = document.getElementById('routine-list');
    const routines = getAllRoutines();

    if (!routines.length) {
        container.innerHTML = '<div class="empty-state">No hay rutinas creadas</div>';
        return;
    }

    const typeEmoji = { strength: '💪', cardio: '🏃', flexibility: '🧘', mixed: '⚡' };
    const typeLabel = { strength: 'Fuerza', cardio: 'Cardio', flexibility: 'Flexibilidad', mixed: 'Mixto' };

    container.innerHTML = routines.map(r => `
        <div class="routine-card">
            <div class="routine-icon">${typeEmoji[r.type] || '💪'}</div>
            <div class="routine-info">
                <h4>${r.name}</h4>
                <p>${typeLabel[r.type] || r.type} — ${r.duration} min</p>
            </div>
            <button class="btn-icon danger" onclick="deleteRoutineConfirm(${r.id})" title="Eliminar rutina">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
            </button>
        </div>
    `).join('');
}

const EXERCISES = [
    { name: 'Press de banca', category: 'push', muscle: 'Pecho', level: 'Intermedio' },
    { name: 'Press inclinado', category: 'push', muscle: 'Pecho alto', level: 'Intermedio' },
    { name: 'Fondos en paralelas', category: 'push', muscle: 'Pecho / Tríceps', level: 'Avanzado' },
    { name: 'Press militar', category: 'push', muscle: 'Hombros', level: 'Intermedio' },
    { name: 'Extensión tríceps', category: 'push', muscle: 'Tríceps', level: 'Principiante' },
    { name: 'Sentadillas', category: 'legs', muscle: 'Cuádriceps', level: 'Principiante' },
    { name: 'Peso muerto', category: 'legs', muscle: 'Cadena posterior', level: 'Intermedio' },
    { name: 'Prensa', category: 'legs', muscle: 'Cuádriceps', level: 'Principiante' },
    { name: 'Elevación de talones', category: 'legs', muscle: 'Gemelos', level: 'Principiante' },
    { name: 'Zancadas', category: 'legs', muscle: 'Piernas', level: 'Principiante' },
    { name: 'Dominadas', category: 'pull', muscle: 'Espalda', level: 'Avanzado' },
    { name: 'Remo con barra', category: 'pull', muscle: 'Espalda media', level: 'Intermedio' },
    { name: 'Curl de bíceps', category: 'pull', muscle: 'Bíceps', level: 'Principiante' },
    { name: 'Jalón al pecho', category: 'pull', muscle: 'Dorsal', level: 'Principiante' },
    { name: 'Plancha', category: 'core', muscle: 'Abdominales', level: 'Principiante' },
    { name: 'Crunches', category: 'core', muscle: 'Abdominales', level: 'Principiante' },
    { name: 'Rueda abdominal', category: 'core', muscle: 'Core completo', level: 'Avanzado' },
    { name: 'Saltos con cuerda', category: 'cardio', muscle: 'Cuerpo completo', level: 'Principiante' },
    { name: 'Burpees', category: 'cardio', muscle: 'Cuerpo completo', level: 'Intermedio' },
    { name: 'Bicicleta estática', category: 'cardio', muscle: 'Piernas', level: 'Principiante' },
];

function renderExercises(filter = 'all', search = '') {
    const container = document.getElementById('exercise-list');
    const categoryIcons = { push: '💪', pull: '🔙', legs: '🦵', core: '🎯', cardio: '🏃' };

    let list = EXERCISES;
    if (filter !== 'all') list = list.filter(e => e.category === filter);
    if (search) list = list.filter(e => e.name.toLowerCase().includes(search.toLowerCase()) || e.muscle.toLowerCase().includes(search.toLowerCase()));

    if (!list.length) {
        container.innerHTML = '<div class="empty-state">No se encontraron ejercicios</div>';
        return;
    }

    container.innerHTML = list.map(e => `
        <div class="exercise-card">
            <div class="exercise-icon ${e.category}">${categoryIcons[e.category]}</div>
            <div class="exercise-details">
                <h4>${e.name}</h4>
                <p>${e.muscle} · ${e.level}</p>
            </div>
        </div>
    `).join('');
}

function renderSchedule() {
    const container = document.getElementById('schedule-list');
    const today = new Date().toISOString().split('T')[0];
    const classes = getAllScheduledClasses().filter(c => c.date >= today);

    if (!classes.length) {
        container.innerHTML = '<div class="empty-state">No hay clases programadas</div>';
        return;
    }

    container.innerHTML = classes.map(cls => `
        <div class="schedule-item">
            <div class="schedule-time">${cls.time}</div>
            <div class="schedule-dot"></div>
            <div class="schedule-info">
                <h4>${cls.student_name || 'Estudiante'}</h4>
                <p>${cls.routine_name || 'Rutina'} — ${formatDate(cls.date)}</p>
            </div>
            <button class="btn-icon danger" onclick="cancelClass(${cls.id})" title="Cancelar clase">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
            </button>
        </div>
    `).join('');
}

function renderPayments() {
    const container = document.getElementById('payment-list');
    const payments = getAllPayments();
    const settings = getSettings() || { currency: 'ARS' };
    const sym = currencySymbol(settings.currency);

    const paid    = payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
    const pending = payments.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0);
    const overdue = payments.filter(p => p.status === 'overdue').reduce((s, p) => s + p.amount, 0);

    document.getElementById('total-paid').textContent    = `${sym}${paid.toLocaleString('es-AR')}`;
    document.getElementById('total-pending').textContent = `${sym}${pending.toLocaleString('es-AR')}`;
    document.getElementById('total-overdue').textContent = `${sym}${overdue.toLocaleString('es-AR')}`;

    if (!payments.length) {
        container.innerHTML = '<div class="empty-state">No hay pagos registrados</div>';
        return;
    }

    const labels = { paid: 'Pagado', pending: 'Pendiente', overdue: 'Vencido' };

    container.innerHTML = payments.map(p => `
        <div class="payment-detail-card">
            <div class="payment-detail-info">
                <div class="payment-detail-header">
                    <h4>${p.student_name || 'Estudiante'}</h4>
                    <span class="payment-status ${p.status}">${labels[p.status]}</span>
                </div>
                <div class="payment-detail-meta">
                    <span>📅 Vence: ${formatDate(p.due_date)}</span>
                    ${p.paid_date ? `<span>✅ Pagado: ${formatDate(p.paid_date)}</span>` : ''}
                </div>
            </div>
            <div class="payment-detail-amount">
                <span class="amount ${p.status}">${sym}${p.amount.toLocaleString('es-AR')}</span>
                <div class="payment-actions">
                    <button class="btn btn-secondary btn-sm" onclick="loadPaymentIntoForm(${p.id}, ${p.student_id}, ${p.amount}, '${p.due_date}', '${p.status}')" title="Editar">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="btn btn-sm ${p.status === 'paid' ? 'btn-warning' : 'btn-success'}"
                        onclick="togglePaymentStatus(${p.id}, '${p.status}')">
                        ${p.status === 'paid' ? '↩ Pendiente' : '✓ Pagado'}
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function updateDropdowns() {
    const students = getAllStudents();
    const routines = getAllRoutines();

    const studentOpts = '<option value="">Seleccionar estudiante...</option>' +
        students.map(s => `<option value="${s.id}">${s.name}${s.status === 'inactive' ? ' (inactivo)' : ''}</option>`).join('');
    const routineOpts = '<option value="">Seleccionar rutina...</option>' +
        routines.map(r => `<option value="${r.id}">${r.name}</option>`).join('');

    ['schedule-student', 'payment-student'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = studentOpts;
    });
    ['schedule-routine'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = routineOpts;
    });
}

function loadSettings() {
    const s = getSettings();
    if (s) {
        document.getElementById('gym-name').value    = s.gymName;
        document.getElementById('class-price').value = s.classPrice;
        document.getElementById('currency').value    = s.currency;
        document.getElementById('open-time').value   = s.openTime;
        document.getElementById('close-time').value  = s.closeTime;
        document.getElementById('user-name').textContent = s.gymName;
    }
}

// ==================== NAVIGATION ====================
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

let currentTab = 'dashboard';

function switchTab(tabId) {
    currentTab = tabId;
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId)?.classList.add('active');
    document.querySelector(`[data-tab="${tabId}"]`)?.classList.add('active');
    updateHeader(tabId);
    document.getElementById('sidebar').classList.remove('open');
    refreshCurrentTab();
}

function updateHeader(tabId) {
    const map = {
        dashboard: { title: 'Dashboard',    subtitle: 'Resumen de tu gimnasio',     action: null },
        students:  { title: 'Estudiantes',  subtitle: 'Gestión de alumnos',         action: 'Nuevo Estudiante' },
        routines:  { title: 'Rutinas',      subtitle: 'Programas de entrenamiento', action: 'Nueva Rutina' },
        exercises: { title: 'Ejercicios',   subtitle: 'Biblioteca de movimientos',  action: null },
        schedule:  { title: 'Horarios',     subtitle: 'Agenda de clases',           action: 'Agendar Clase' },
        payments:  { title: 'Pagos',        subtitle: 'Control de ingresos',        action: 'Nuevo Pago' },
        settings:  { title: 'Configuración',subtitle: 'Ajustes del sistema',        action: null },
    };
    const info = map[tabId] || map.dashboard;
    document.getElementById('page-title').textContent    = info.title;
    document.getElementById('page-subtitle').textContent = info.subtitle;
    const btn  = document.getElementById('action-btn');
    const text = document.getElementById('action-btn-text');
    if (btn && text) {
        btn.style.display = info.action ? 'inline-flex' : 'none';
        text.textContent  = info.action || '';
    }
}

function refreshCurrentTab() {
    switch (currentTab) {
        case 'students':  renderStudents(); break;
        case 'routines':  renderRoutines(); break;
        case 'exercises': renderExercises(); break;
        case 'schedule':  renderSchedule(); break;
        case 'payments':  renderPayments(); break;
        case 'dashboard': renderDashboard(); break;
        case 'settings':  loadSettings(); break;
    }
}

// ==================== ACTIONS ====================
let editingStudentId = null;

function openStudentModal(id = null) {
    editingStudentId = id;
    const title = document.getElementById('student-modal-title');

    if (id) {
        const s = getAllStudents().find(s => s.id === id);
        if (s) {
            title.textContent = 'Editar Estudiante';
            document.getElementById('student-name').value   = s.name || '';
            document.getElementById('student-email').value  = s.email || '';
            document.getElementById('student-phone').value  = s.phone || '';
            document.getElementById('student-status').value = s.status || 'active';
            document.getElementById('student-notes').value  = s.notes || '';
        }
    } else {
        title.textContent = 'Nuevo Estudiante';
        ['student-name','student-email','student-phone','student-notes'].forEach(id => {
            document.getElementById(id).value = '';
        });
        document.getElementById('student-status').value = 'active';
    }

    document.getElementById('student-modal').classList.add('active');
    setTimeout(() => document.getElementById('student-name').focus(), 300);
}

function closeStudentModal() {
    document.getElementById('student-modal').classList.remove('active');
    editingStudentId = null;
}

function saveStudent() {
    const name   = document.getElementById('student-name').value.trim();
    const email  = document.getElementById('student-email').value.trim();
    const phone  = document.getElementById('student-phone').value.trim();
    const status = document.getElementById('student-status').value;
    const notes  = document.getElementById('student-notes').value.trim();

    if (!name) {
        document.getElementById('student-name').focus();
        showNotification('El nombre es obligatorio', 'error');
        return;
    }
    if (!email) {
        document.getElementById('student-email').focus();
        showNotification('El email es obligatorio', 'error');
        return;
    }

    if (editingStudentId) {
        updateStudent(editingStudentId, name, email, phone, notes, status);
        showNotification('Estudiante actualizado');
    } else {
        addStudent(name, email, phone, notes, status);
        showNotification('Estudiante registrado');
    }

    closeStudentModal();
    renderStudents();
    updateDropdowns();
    renderDashboard();
}

function editStudent(id) { openStudentModal(id); }

async function deleteStudentConfirm(id) {
    const s = getAllStudents().find(s => s.id === id);
    const ok = await showConfirm(
        '¿Eliminar estudiante?',
        `Se eliminará a ${s?.name || 'este estudiante'} de forma permanente.`
    );
    if (ok) {
        deleteStudent(id);
        showNotification('Estudiante eliminado');
        renderStudents();
        updateDropdowns();
        renderDashboard();
    }
}

function createRoutine() {
    const nameEl = document.getElementById('routine-name');
    const name   = nameEl.value.trim();
    const type   = document.getElementById('routine-type').value;
    const dur    = parseInt(document.getElementById('routine-duration').value) || 45;

    if (!name) {
        nameEl.focus();
        showNotification('Ingresa un nombre para la rutina', 'error');
        return;
    }

    addRoutine(name, type, dur);
    showNotification('Rutina creada');
    nameEl.value = '';
    renderRoutines();
    renderDashboard();
    updateDropdowns();
}

async function deleteRoutineConfirm(id) {
    const ok = await showConfirm('¿Eliminar rutina?', 'Esta rutina será eliminada permanentemente.');
    if (ok) {
        deleteRoutineFromDB(id);
        showNotification('Rutina eliminada');
        renderRoutines();
        renderDashboard();
        updateDropdowns();
    }
}

function createScheduleClass() {
    const date      = document.getElementById('schedule-date').value;
    const time      = document.getElementById('schedule-time').value;
    const studentId = document.getElementById('schedule-student').value;
    const routineId = document.getElementById('schedule-routine').value;

    if (!date || !time || !studentId || !routineId) {
        showNotification('Completa todos los campos', 'error');
        return;
    }

    addScheduledClass(parseInt(studentId), parseInt(routineId), date, time);
    showNotification('Clase agendada');
    document.getElementById('schedule-date').value = '';
    document.getElementById('schedule-time').value = '09:00';
    renderSchedule();
    renderDashboard();
}

async function cancelClass(id) {
    const ok = await showConfirm('¿Cancelar clase?', 'Esta clase será eliminada del horario.', 'Cancelar clase');
    if (ok) {
        deleteScheduledClassFromDB(id);
        showNotification('Clase cancelada');
        renderSchedule();
        renderDashboard();
    }
}

// Payment form state
let editingPaymentId = null;

function clearPaymentForm() {
    editingPaymentId = null;
    document.getElementById('payment-form-title').textContent = 'Registrar Pago';
    document.getElementById('payment-student').value = '';
    document.getElementById('payment-amount').value  = '250';
    document.getElementById('payment-due').value     = '';
    document.getElementById('payment-status').value  = 'pending';
    document.getElementById('cancel-edit-btn').style.display = 'none';
}

function loadPaymentIntoForm(id, studentId, amount, dueDate, status) {
    editingPaymentId = id;
    document.getElementById('payment-form-title').textContent = 'Editar Pago';
    document.getElementById('payment-student').value = studentId;
    document.getElementById('payment-amount').value  = amount;
    document.getElementById('payment-due').value     = dueDate;
    document.getElementById('payment-status').value  = status;
    document.getElementById('cancel-edit-btn').style.display = 'inline-flex';
    document.getElementById('payment-form-title').scrollIntoView({ behavior: 'smooth' });
    showNotification('Editando pago — modificá y guardá');
}

function createPayment() {
    const studentId = document.getElementById('payment-student').value;
    const amount    = parseFloat(document.getElementById('payment-amount').value);
    const dueDate   = document.getElementById('payment-due').value;
    const status    = document.getElementById('payment-status').value;

    if (!studentId || !amount || !dueDate) {
        showNotification('Completa todos los campos', 'error');
        return;
    }

    if (editingPaymentId) {
        updatePayment(editingPaymentId, parseInt(studentId), amount, dueDate, status);
        showNotification('Pago actualizado');
    } else {
        addPayment(parseInt(studentId), amount, dueDate, status);
        showNotification('Pago registrado');
    }

    clearPaymentForm();
    renderPayments();
    renderDashboard();
    updateBadges();
}

function togglePaymentStatus(id, currentStatus) {
    const newStatus = currentStatus === 'paid' ? 'pending' : 'paid';
    updatePaymentStatus(id, newStatus);
    showNotification(newStatus === 'paid' ? '✓ Marcado como pagado' : 'Marcado como pendiente');
    renderPayments();
    renderDashboard();
    updateBadges();
}

function saveSettings() {
    const s = {
        gymName:    document.getElementById('gym-name').value.trim() || 'GymBro',
        classPrice: parseFloat(document.getElementById('class-price').value) || 250,
        currency:   document.getElementById('currency').value,
        openTime:   document.getElementById('open-time').value,
        closeTime:  document.getElementById('close-time').value,
    };
    saveSettingsToDB(s);
    showNotification('Configuración guardada');
    document.getElementById('user-name').textContent = s.gymName;
    renderDashboard();
}

// ==================== UTILITIES ====================
function getInitials(name) {
    return name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().substring(0, 2);
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    // Parse as local date to avoid timezone offset issues
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
}

let _notifTimeout = null;
function showNotification(message, type = 'success') {
    const el = document.getElementById('notification');
    el.textContent = message;
    el.className = `notification ${type} show`;
    if (_notifTimeout) clearTimeout(_notifTimeout);
    _notifTimeout = setTimeout(() => el.classList.remove('show'), 3000);
}

function handlePrimaryAction() {
    switch (currentTab) {
        case 'students':
        case 'dashboard':
            openStudentModal(); break;
        case 'routines':
            document.getElementById('routine-name').focus(); break;
        case 'schedule':
            document.getElementById('schedule-date').focus(); break;
        case 'payments':
            clearPaymentForm(); break;
    }
}

function handleExerciseSearch() {
    const filter = document.querySelector('.exercise-filter.active')?.dataset.filter || 'all';
    const search = document.getElementById('exercise-search-input')?.value || '';
    renderExercises(filter, search);
}

function setupExerciseFilters() {
    document.querySelectorAll('.exercise-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.exercise-filter').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            handleExerciseSearch();
        });
    });
    document.getElementById('exercise-search-input')?.addEventListener('input', handleExerciseSearch);
}

// Close sidebar when clicking outside
document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('sidebar');
    const menuBtn = document.querySelector('.mobile-menu-btn');
    if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
        if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
            sidebar.classList.remove('open');
        }
    }
});

// Close modal on overlay click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
        editingStudentId = null;
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeStudentModal();
        confirmReject();
    }
});

// Student search live
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('student-search')?.addEventListener('input', renderStudents);
});

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', async () => {
    await initDatabase();

    document.getElementById('loading-screen').style.display = 'none';

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = item.getAttribute('data-tab');
            if (tabId) switchTab(tabId);
        });
    });

    // Load data
    loadSettings();
    updateDropdowns();
    renderDashboard();
    renderStudents();
    renderRoutines();
    renderExercises();
    renderSchedule();
    renderPayments();
    setupExerciseFilters();

    // Update header for initial tab
    updateHeader('dashboard');
});

// ===== Globals =====
window.toggleSidebar        = toggleSidebar;
window.switchTab            = switchTab;
window.handlePrimaryAction  = handlePrimaryAction;
window.handleExerciseSearch = handleExerciseSearch;
window.openStudentModal     = openStudentModal;
window.closeStudentModal    = closeStudentModal;
window.saveStudent          = saveStudent;
window.editStudent          = editStudent;
window.deleteStudentConfirm = deleteStudentConfirm;
window.createRoutine        = createRoutine;
window.deleteRoutineConfirm = deleteRoutineConfirm;
window.createScheduleClass  = createScheduleClass;
window.cancelClass          = cancelClass;
window.deleteScheduledClass = cancelClass;
window.createPayment        = createPayment;
window.saveSettings         = saveSettings;
window.togglePaymentStatus  = togglePaymentStatus;
window.loadPaymentIntoForm  = loadPaymentIntoForm;
window.clearPaymentForm     = clearPaymentForm;
window.renderStudents       = renderStudents;
window.renderPayments       = renderPayments;
window.renderDashboard      = renderDashboard;
window.renderRoutines       = renderRoutines;
window.renderSchedule       = renderSchedule;
window.updateDropdowns      = updateDropdowns;
window.updateBadges         = updateBadges;
window.confirmAccept        = confirmAccept;
window.confirmReject        = confirmReject;