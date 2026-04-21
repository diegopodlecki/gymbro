// ==================== GYMBRO APP ====================
// Sistema de gestión de gimnasio con SQLite

// ==================== DATABASE ====================
let db = null;
let SQL = null;

// Initialize SQLite
async function initDatabase() {
    try {
        SQL = await initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
        });
        
        // Check for saved database
        const savedDb = localStorage.getItem('gymbro_db');
        if (savedDb) {
            const data = new Uint8Array(JSON.parse(savedDb));
            db = new SQL.Database(data);
        } else {
            db = new SQL.Database();
            createTables();
            insertDefaultData();
        }
        
        console.log('✅ Base de datos SQLite inicializada');
        return true;
    } catch (error) {
        console.error('❌ Error init DB:', error);
        // Fallback to memory
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
            currency TEXT DEFAULT 'MXN',
            open_time TEXT DEFAULT '06:00',
            close_time TEXT DEFAULT '22:00'
        );
    `);
}

function insertDefaultData() {
    // Settings
    db.run(`INSERT OR IGNORE INTO settings (id, gym_name, class_price, currency) VALUES (1, 'GymBro', 250, 'MXN')`);
    
    // Sample students
    db.run(`INSERT OR IGNORE INTO students (id, name, email, phone, status) VALUES 
        (1, 'Ana García', 'ana@email.com', '5523456789', 'active'),
        (2, 'Carlos López', 'carlos@email.com', '5512345678', 'active'),
        (3, 'María Rodríguez', 'maria@email.com', '5587654321', 'active'),
        (4, 'Pedro Martínez', 'pedro@email.com', '5551234567', 'inactive'),
        (5, 'Laura Hernández', 'laura@email.com', '5578912345', 'active')`);
    
    // Sample routines
    db.run(`INSERT OR IGNORE INTO routines (id, name, type, duration) VALUES 
        (1, 'Rutina Fuerza Principiante', 'strength', 45),
        (2, 'Cardio Intermedio', 'cardio', 30),
        (3, 'Stretching y Flexibilidad', 'flexibility', 40),
        (4, 'Rutina Piernas Avanzada', 'strength', 60)`);
    
    // Sample payments
    const today = new Date().toISOString().split('T')[0];
    const dueSoon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    db.run(`INSERT OR IGNORE INTO payments (id, student_id, amount, due_date, status) VALUES 
        (1, 1, 500, '${dueSoon}', 'paid'),
        (2, 2, 250, '${dueSoon}', 'pending'),
        (3, 3, 750, '${today}', 'overdue')`);
    
    // Sample classes
    db.run(`INSERT OR IGNORE INTO scheduled_classes (id, student_id, routine_id, date, time) VALUES 
        (1, 1, 1, '${today}', '07:00'),
        (2, 2, 2, '${today}', '09:00'),
        (3, 3, 4, '${today}', '11:00')`);
}

function saveDatabase() {
    try {
        const data = db.export();
        const arr = Array.from(data);
        localStorage.setItem('gymbro_db', JSON.stringify(arr));
    } catch (error) {
        console.error('Error saving DB:', error);
    }
}

// ==================== DATA OPERATIONS ====================
function getAllStudents() {
    const result = db.exec(`SELECT * FROM students ORDER BY name`);
    return result.length > 0 ? result[0].values.map(row => ({
        id: row[0], name: row[1], email: row[2], phone: row[3], 
        notes: row[4], status: row[5], created_at: row[6]
    })) : [];
}

function getActiveStudents() {
    const result = db.exec(`SELECT * FROM students WHERE status = 'active' ORDER BY name`);
    return result.length > 0 ? result[0].values.map(row => ({
        id: row[0], name: row[1], email: row[2], phone: row[3], 
        notes: row[4], status: row[5], created_at: row[6]
    })) : [];
}

function addStudent(name, email, phone, notes) {
    db.run(`INSERT INTO students (name, email, phone, notes, status) VALUES (?, ?, ?, ?, 'active')`, 
        [name, email, phone, notes]);
    saveDatabase();
    return db.exec(`SELECT last_insert_rowid()`)[0].values[0][0];
}

function updateStudent(id, name, email, phone, notes) {
    db.run(`UPDATE students SET name = ?, email = ?, phone = ?, notes = ? WHERE id = ?`, 
        [name, email, phone, notes, id]);
    saveDatabase();
}

function deleteStudent(id) {
    db.run(`DELETE FROM students WHERE id = ?`, [id]);
    saveDatabase();
}

function getAllRoutines() {
    const result = db.exec(`SELECT * FROM routines ORDER BY name`);
    return result.length > 0 ? result[0].values.map(row => ({
        id: row[0], name: row[1], type: row[2], duration: row[3], created_at: row[4]
    })) : [];
}

function addRoutine(name, type, duration) {
    db.run(`INSERT INTO routines (name, type, duration) VALUES (?, ?, ?)`, [name, type, duration]);
    saveDatabase();
}

function deleteRoutine(id) {
    db.run(`DELETE FROM routines WHERE id = ?`, [id]);
    saveDatabase();
}

function getAllPayments() {
    const result = db.exec(`
        SELECT p.*, s.name as student_name 
        FROM payments p 
        LEFT JOIN students s ON p.student_id = s.id 
        ORDER BY p.due_date DESC
    `);
    return result.length > 0 ? result[0].values.map(row => ({
        id: row[0], student_id: row[1], amount: row[2], due_date: row[3], 
        status: row[4], paid_date: row[5], created_at: row[6], student_name: row[7]
    })) : [];
}

function getPendingPayments() {
    const result = db.exec(`SELECT * FROM payments WHERE status = 'pending' OR status = 'overdue'`);
    return result.length > 0 ? result[0].values.length : 0;
}

function addPayment(studentId, amount, dueDate, status = 'pending') {
    const paidDate = status === 'paid' ? new Date().toISOString().split('T')[0] : null;
    db.run(`INSERT INTO payments (student_id, amount, due_date, status, paid_date) VALUES (?, ?, ?, ?, ?)`, 
        [studentId, amount, dueDate, status, paidDate]);
    saveDatabase();
}

function getMonthlyIncome() {
    const result = db.exec(`SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'paid'`);
    return result.length > 0 ? result[0].values[0][0] : 0;
}

function getAllScheduledClasses() {
    const result = db.exec(`
        SELECT c.*, s.name as student_name, r.name as routine_name 
        FROM scheduled_classes c
        LEFT JOIN students s ON c.student_id = s.id
        LEFT JOIN routines r ON c.routine_id = r.id
        ORDER BY c.date, c.time
    `);
    return result.length > 0 ? result[0].values.map(row => ({
        id: row[0], student_id: row[1], routine_id: row[2], date: row[3], 
        time: row[4], status: row[5], student_name: row[7], routine_name: row[8]
    })) : [];
}

function addScheduledClass(studentId, routineId, date, time) {
    db.run(`INSERT INTO scheduled_classes (student_id, routine_id, date, time) VALUES (?, ?, ?, ?)`, 
        [studentId, routineId, date, time]);
    saveDatabase();
}

function deleteScheduledClass(id) {
    db.run(`DELETE FROM scheduled_classes WHERE id = ?`, [id]);
    saveDatabase();
}

function getSettings() {
    const result = db.exec(`SELECT * FROM settings WHERE id = 1`);
    return result.length > 0 ? {
        gymName: result[0].values[0][1],
        classPrice: result[0].values[0][2],
        currency: result[0].values[0][3],
        openTime: result[0].values[0][4],
        closeTime: result[0].values[0][5]
    } : null;
}

function saveSettings(settings) {
    db.run(`UPDATE settings SET gym_name = ?, class_price = ?, currency = ?, open_time = ?, close_time = ? WHERE id = 1`, 
        [settings.gymName, settings.classPrice, settings.currency, settings.openTime, settings.closeTime]);
    saveDatabase();
}

// ==================== RENDER FUNCTIONS ====================
function renderDashboard() {
    renderUpcomingClasses();
    renderRecentPayments();
    renderStats();
    updateBadges();
}

function renderStats() {
    const activeStudents = getActiveStudents();
    const classes = getAllScheduledClasses();
    const routines = getAllRoutines();
    const income = getMonthlyIncome();
    const settings = getSettings() || { currency: 'MXN' };
    
    document.getElementById('stat-students').textContent = activeStudents.length;
    document.getElementById('stat-classes').textContent = classes.length;
    document.getElementById('stat-routines').textContent = routines.length;
    
    const symbol = settings.currency === 'MXN' ? '$' : settings.currency === 'EUR' ? '€' : '$';
    document.getElementById('stat-income').textContent = `${symbol}${income.toLocaleString()}`;
}

function updateBadges() {
    const activeStudents = getActiveStudents();
    const pendingPayments = getPendingPayments();
    
    const studentBadge = document.getElementById('student-count-badge');
    const paymentBadge = document.getElementById('payment-count-badge');
    
    if (studentBadge) studentBadge.textContent = activeStudents.length;
    if (paymentBadge) paymentBadge.textContent = pendingPayments;
    if (paymentBadge) {
        paymentBadge.style.display = pendingPayments > 0 ? 'inline' : 'none';
        paymentBadge.classList.toggle('warning', pendingPayments > 0);
    }
}

function renderUpcomingClasses() {
    const container = document.getElementById('upcoming-classes');
    const today = new Date().toISOString().split('T')[0];
    const classes = getAllScheduledClasses().filter(c => c.date >= today).slice(0, 5);
    
    if (classes.length === 0) {
        container.innerHTML = '<div class="empty-state">No hay clases programadas</div>';
        return;
    }
    
    container.innerHTML = classes.map(cls => `
        <div class="schedule-item">
            <div class="schedule-time">${cls.time}</div>
            <div class="schedule-dot"></div>
            <div class="schedule-info">
                <h4>${cls.student_name || 'Estudiante'}</h4>
                <p>${cls.routine_name || 'Rutina'} - ${formatDate(cls.date)}</p>
            </div>
            <button class="btn-icon" onclick="cancelClass(${cls.id})" title="Cancelar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
            </button>
        </div>
    `).join('');
}

function renderRecentPayments() {
    const container = document.getElementById('recent-payments');
    const payments = getAllPayments().slice(0, 5);
    
    if (payments.length === 0) {
        container.innerHTML = '<div class="empty-state">No hay pagos recientes</div>';
        return;
    }
    
    const statusLabels = { paid: 'Pagado', pending: 'Pendiente', overdue: 'Vencido' };
    
    container.innerHTML = payments.map(p => `
        <div class="payment-item">
            <div class="payment-info">
                <h4>${p.student_name || 'Estudiante'}</h4>
                <p>${formatDate(p.due_date)}</p>
            </div>
            <div class="payment-amount ${p.status}">
                $${p.amount}
                <span class="payment-status ${p.status}">${statusLabels[p.status]}</span>
            </div>
        </div>
    `).join('');
}

function renderStudents() {
    const container = document.getElementById('student-list');
    const searchTerm = document.getElementById('student-search')?.value?.toLowerCase() || '';
    let students = getAllStudents();
    
    // Update stats
    const total = students.length;
    const active = students.filter(s => s.status === 'active').length;
    const inactive = total - active;
    document.getElementById('total-students').textContent = total;
    document.getElementById('active-students').textContent = active;
    document.getElementById('inactive-students').textContent = inactive;
    
    if (searchTerm) {
        students = students.filter(s => 
            s.name.toLowerCase().includes(searchTerm) || 
            s.email.toLowerCase().includes(searchTerm)
        );
    }
    
    if (students.length === 0) {
        container.innerHTML = '<div class="empty-state">No hay estudiantes registrados</div>';
        return;
    }
    
    container.innerHTML = students.map(student => `
        <div class="student-detail-card">
            <div class="student-avatar-large">${getInitials(student.name)}</div>
            <div class="student-detail-info">
                <div class="student-detail-header">
                    <h3>${student.name}</h3>
                    <span class="student-status ${student.status}">${student.status === 'active' ? 'Activo' : 'Inactivo'}</span>
                </div>
                <div class="student-detail-meta">
                    <span>📧 ${student.email}</span>
                    <span>📞 ${student.phone || 'Sin teléfono'}</span>
                </div>
                ${student.notes ? `<p class="student-notes">📝 ${student.notes}</p>` : ''}
                <div class="student-detail-actions">
                    <button class="btn btn-secondary btn-sm" onclick="editStudent(${student.id})">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        Editar
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteStudentConfirm(${student.id})">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
    
    if (routines.length === 0) {
        container.innerHTML = '<div class="empty-state">No hay rutinas creadas</div>';
        return;
    }
    
    const typeEmoji = { strength: '💪', cardio: '🏃', flexibility: '🧘', mixed: '⚡' };
    
    container.innerHTML = routines.map(routine => `
        <div class="routine-card">
            <div class="routine-icon">${typeEmoji[routine.type] || '💪'}</div>
            <div class="routine-info">
                <h4>${routine.name}</h4>
                <p>${routine.duration} minutos</p>
            </div>
            <button class="btn-icon danger" onclick="deleteRoutine(${routine.id})" title="Eliminar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
            </button>
        </div>
    `).join('');
}

function renderExercises(filter = 'all', search = '') {
    const container = document.getElementById('exercise-list');
    
    const exercises = [
        { name: 'Press de banca', category: 'push', muscle: 'Pecho', level: 'Intermedio' },
        { name: 'Sentadillas', category: 'legs', muscle: 'Cuádriceps', level: 'Principiante' },
        { name: 'Peso muerto', category: 'legs', muscle: 'Espalda baja', level: 'Intermedio' },
        { name: 'Dominadas', category: 'pull', muscle: 'Espalda', level: 'Avanzado' },
        { name: 'Plancha', category: 'core', muscle: 'Abdominales', level: 'Principiante' },
        { name: 'Press militar', category: 'push', muscle: 'Hombros', level: 'Intermedio' },
        { name: 'Curl de bíceps', category: 'pull', muscle: 'Bíceps', level: 'Principiante' },
        { name: 'Saltos con cuerda', category: 'cardio', muscle: 'Piernas', level: 'Principiante' },
        { name: 'Elevación de talones', category: 'legs', muscle: 'Gemelos', level: 'Principiante' },
        { name: 'Crunches', category: 'core', muscle: 'Abdominales', level: 'Principiante' }
    ];
    
    let filtered = exercises;
    if (filter !== 'all') {
        filtered = filtered.filter(e => e.category === filter);
    }
    if (search) {
        filtered = filtered.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));
    }
    
    const categoryIcons = {
        push: '💪', pull: '🔙', legs: '🦵', core: '🎯', cardio: '🏃'
    };
    
    container.innerHTML = filtered.map(exercise => `
        <div class="exercise-card">
            <div class="exercise-icon ${exercise.category}">${categoryIcons[exercise.category]}</div>
            <div class="exercise-details">
                <h4>${exercise.name}</h4>
                <p>${exercise.muscle} • ${exercise.level}</p>
            </div>
        </div>
    `).join('');
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state">No hay ejercicios</div>';
    }
}

function renderSchedule() {
    const container = document.getElementById('schedule-list');
    const today = new Date().toISOString().split('T')[0];
    const classes = getAllScheduledClasses().filter(c => c.date >= today);
    
    if (classes.length === 0) {
        container.innerHTML = '<div class="empty-state">No hay clases programadas</div>';
        return;
    }
    
    container.innerHTML = classes.map(cls => `
        <div class="schedule-item">
            <div class="schedule-time">${cls.time}</div>
            <div class="schedule-dot"></div>
            <div class="schedule-info">
                <h4>${cls.student_name || 'Estudiante'}</h4>
                <p>${cls.routine_name || 'Rutina'} - ${formatDate(cls.date)}</p>
            </div>
            <button class="btn-icon danger" onclick="deleteScheduledClass(${cls.id})" title="Cancelar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
            </button>
        </div>
    `).join('');
}

function renderPayments() {
    const container = document.getElementById('payment-list');
    const payments = getAllPayments();
    
    // Calculate totals
    const paid = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
    const pending = payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0);
    const overdue = payments.filter(p => p.status === 'overdue').reduce((sum, p) => sum + p.amount, 0);
    
    document.getElementById('total-paid').textContent = `$${paid}`;
    document.getElementById('total-pending').textContent = `$${pending}`;
    document.getElementById('total-overdue').textContent = `$${overdue}`;
    
    if (payments.length === 0) {
        container.innerHTML = '<div class="empty-state">No hay pagos registrados</div>';
        return;
    }
    
    const statusLabels = { paid: 'Pagado', pending: 'Pendiente', overdue: 'Vencido' };
    
    container.innerHTML = payments.map(payment => `
        <div class="payment-detail-card">
            <div class="payment-detail-info">
                <div class="payment-detail-header">
                    <h4>${payment.student_name || 'Estudiante'}</h4>
                    <span class="payment-status ${payment.status}">${statusLabels[payment.status]}</span>
                </div>
                <div class="payment-detail-meta">
                    <span>📅 Vence: ${formatDate(payment.due_date)}</span>
                    ${payment.paid_date ? `<span>✅ Pagado: ${formatDate(payment.paid_date)}</span>` : ''}
                </div>
            </div>
            <div class="payment-detail-amount">
                <span class="amount">$${payment.amount}</span>
                <div class="payment-actions">
                    <button class="btn btn-secondary btn-sm" onclick="editPayment(${payment.id}, ${payment.student_id}, ${payment.amount}, '${payment.due_date}', '${payment.status}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="btn btn-sm ${payment.status === 'paid' ? 'btn-warning' : 'btn-success'}" onclick="togglePaymentStatus(${payment.id}, '${payment.status}')">
                        ${payment.status === 'paid' ? 'Marcar Pendiente' : 'Marcar Pagado'}
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function togglePaymentStatus(id, currentStatus) {
    const newStatus = currentStatus === 'paid' ? 'pending' : 'paid';
    updatePaymentStatus(id, newStatus);
    showNotification(newStatus === 'paid' ? 'Pago marcado como pagado' : 'Pago marcado como pendiente');
    renderPayments();
    renderDashboard();
    updateBadges();
}

function editPayment(id, studentId, amount, dueDate, status) {
    // Fill the form with payment data
    document.getElementById('payment-student').value = studentId;
    document.getElementById('payment-amount').value = amount;
    document.getElementById('payment-due').value = dueDate;
    document.getElementById('payment-status').value = status;
    
    // Store editing ID for update
    window.editingPaymentId = id;
    showNotification('Editando pago... completa y guarda los cambios');
}

function updatePaymentStatus(id, status) {
    db.run(`UPDATE payments SET status = ?, paid_date = ? WHERE id = ?`, 
        [status, status === 'paid' ? new Date().toISOString().split('T')[0] : null, id]);
    saveDatabase();
}

function openPaymentModal() {
    window.editingPaymentId = null;
    document.getElementById('payment-student').value = '';
    document.getElementById('payment-amount').value = '250';
    document.getElementById('payment-due').value = '';
    document.getElementById('payment-status').value = 'pending';
}

function updateDropdowns() {
    const students = getAllStudents();
    const routines = getAllRoutines();
    
    const studentOptions = '<option value="">Seleccionar estudiante...</option>' + 
        students.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    const routineOptions = '<option value="">Seleccionar rutina...</option>' + 
        routines.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
    
    const studentSelects = ['schedule-student', 'payment-student'];
    const routineSelects = ['schedule-routine'];
    
    studentSelects.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = studentOptions;
    });
    
    routineSelects.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = routineOptions;
    });
}

function loadSettings() {
    const settings = getSettings();
    if (settings) {
        document.getElementById('gym-name').value = settings.gymName;
        document.getElementById('class-price').value = settings.classPrice;
        document.getElementById('currency').value = settings.currency;
        document.getElementById('open-time').value = settings.openTime;
        document.getElementById('close-time').value = settings.closeTime;
        document.getElementById('user-name').textContent = settings.gymName;
    }
}

// ==================== NAVIGATION ====================
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

let currentTab = 'dashboard';

function switchTab(tabId) {
    currentTab = tabId;
    
    // Hide all contents
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    
    // Show selected
    document.getElementById(tabId).classList.add('active');
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    
    // Update header
    updateHeader(tabId);
    
    // Close mobile sidebar
    document.getElementById('sidebar').classList.remove('open');
    
    // Refresh data
    refreshCurrentTab();
}

function updateHeader(tabId) {
    const titles = {
        dashboard: { title: 'Dashboard', subtitle: 'Resumen de tu gimnasio', action: 'Nuevo Estudiante' },
        students: { title: 'Estudiantes', subtitle: 'Gestión de alumnos', action: 'Nuevo Estudiante' },
        routines: { title: 'Rutinas', subtitle: 'Crea y gestiona rutinas', action: 'Nueva Rutina' },
        exercises: { title: 'Ejercicios', subtitle: 'Biblioteca de ejercicios', action: null },
        schedule: { title: 'Horarios', subtitle: 'Agenda de clases', action: 'Agendar Clase' },
        payments: { title: 'Pagos', subtitle: 'Control de ingresos', action: 'Nuevo Pago' },
        settings: { title: 'Configuración', subtitle: 'Ajustes del sistema', action: null }
    };
    
    const info = titles[tabId] || titles.dashboard;
    document.getElementById('page-title').textContent = info.title;
    document.getElementById('page-subtitle').textContent = info.subtitle;
    
    const actionBtn = document.getElementById('action-btn');
    const actionText = document.getElementById('action-btn-text');
    
    if (actionBtn && actionText) {
        actionBtn.style.display = info.action ? 'flex' : 'none';
        actionText.textContent = info.action;
    }
}

function refreshCurrentTab() {
    switch(currentTab) {
        case 'students': renderStudents(); break;
        case 'routines': renderRoutines(); break;
        case 'exercises': renderExercises(); break;
        case 'schedule': renderSchedule(); break;
        case 'payments': renderPayments(); break;
        case 'dashboard': renderDashboard(); break;
    }
}

// ==================== ACTIONS ====================
let editingStudentId = null;

function openStudentModal(id = null) {
    editingStudentId = id;
    const modal = document.getElementById('student-modal');
    const title = document.getElementById('student-modal-title');
    
    if (id) {
        const students = getAllStudents();
        const student = students.find(s => s.id === id);
        if (student) {
            title.textContent = 'Editar Estudiante';
            document.getElementById('student-name').value = student.name;
            document.getElementById('student-email').value = student.email;
            document.getElementById('student-phone').value = student.phone;
            document.getElementById('student-notes').value = student.notes;
        }
    } else {
        title.textContent = 'Nuevo Estudiante';
        document.getElementById('student-name').value = '';
        document.getElementById('student-email').value = '';
        document.getElementById('student-phone').value = '';
        document.getElementById('student-notes').value = '';
    }
    
    modal.classList.add('active');
}

function closeStudentModal() {
    document.getElementById('student-modal').classList.remove('active');
    editingStudentId = null;
}

function saveStudent() {
    const name = document.getElementById('student-name').value.trim();
    const email = document.getElementById('student-email').value.trim();
    const phone = document.getElementById('student-phone').value.trim();
    const notes = document.getElementById('student-notes').value.trim();
    
    if (!name || !email) {
        showNotification('Por favor ingresa nombre y email', 'error');
        return;
    }
    
    if (editingStudentId) {
        updateStudent(editingStudentId, name, email, phone, notes);
        showNotification('Estudiante actualizado');
    } else {
        addStudent(name, email, phone, notes);
        showNotification('Estudiante registrado');
    }
    
    closeStudentModal();
    renderStudents();
    updateDropdowns();
    renderDashboard();
}

function editStudent(id) {
    openStudentModal(id);
}

function deleteStudentConfirm(id) {
    const student = getAllStudents().find(s => s.id === id);
    if (confirm(`¿Eliminar a ${student?.name || 'este estudiante'}?`)) {
        deleteStudent(id);
        showNotification('Estudiante eliminado');
        renderStudents();
        updateDropdowns();
        renderDashboard();
    }
}

function createRoutine() {
    const nameInput = document.getElementById('routine-name');
    const typeInput = document.getElementById('routine-type');
    const durationInput = document.getElementById('routine-duration');
    
    const name = nameInput.value.trim();
    const type = typeInput.value;
    const duration = parseInt(durationInput.value) || 45;
    
    if (!name) {
        nameInput.focus();
        nameInput.placeholder = 'Ingresa un nombre...';
        return;
    }
    
    addRoutine(name, type, duration);
    showNotification('Rutina creada');
    
    nameInput.value = '';
    nameInput.placeholder = 'Ej: Rutina Piernas Principiante';
    
    renderRoutines();
    renderDashboard();
    updateDropdowns();
}

function deleteRoutineConfirm(id) {
    if (confirm('¿Eliminar esta rutina?')) {
        deleteRoutine(id);
        showNotification('Rutina eliminada');
        renderRoutines();
        renderDashboard();
    }
}

function createScheduleClass() {
    const date = document.getElementById('schedule-date').value;
    const time = document.getElementById('schedule-time').value;
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

function cancelClass(id) {
    if (confirm('¿Cancelar esta clase?')) {
        deleteScheduledClass(id);
        showNotification('Clase cancelada');
        renderSchedule();
        renderDashboard();
    }
}

function createPayment() {
    const studentId = document.getElementById('payment-student').value;
    const amount = document.getElementById('payment-amount').value;
    const dueDate = document.getElementById('payment-due').value;
    const status = document.getElementById('payment-status').value;
    
    if (!studentId || !amount || !dueDate) {
        showNotification('Completa todos los campos', 'error');
        return;
    }
    
    if (window.editingPaymentId) {
        // Update existing payment
        db.run(`UPDATE payments SET student_id = ?, amount = ?, due_date = ?, status = ?, paid_date = ? WHERE id = ?`, 
            [parseInt(studentId), parseInt(amount), dueDate, status, status === 'paid' ? new Date().toISOString().split('T')[0] : null, window.editingPaymentId]);
        saveDatabase();
        showNotification('Pago actualizado');
        window.editingPaymentId = null;
    } else {
        // Create new payment
        addPayment(parseInt(studentId), parseInt(amount), dueDate, status);
        showNotification('Pago registrado');
    }
    
    document.getElementById('payment-amount').value = '250';
    document.getElementById('payment-due').value = '';
    document.getElementById('payment-status').value = 'pending';
    
    renderPayments();
    renderDashboard();
    updateBadges();
}

function saveSettings() {
    const settings = {
        gymName: document.getElementById('gym-name').value,
        classPrice: parseInt(document.getElementById('class-price').value),
        currency: document.getElementById('currency').value,
        openTime: document.getElementById('open-time').value,
        closeTime: document.getElementById('close-time').value
    };
    
    saveSettings(settings);
    showNotification('Configuración guardada');
    document.getElementById('user-name').textContent = settings.gymName;
    renderDashboard();
}

// ==================== UTILITIES ====================
function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

function setupExerciseFilters() {
    document.querySelectorAll('.exercise-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.exercise-filter').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const filter = btn.dataset.filter;
            const search = document.getElementById('exercise-search-input')?.value || '';
            renderExercises(filter, search);
        });
    });
    
    const searchInput = document.getElementById('exercise-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const activeFilter = document.querySelector('.exercise-filter.active')?.dataset.filter || 'all';
            renderExercises(activeFilter, e.target.value);
        });
    }
}

// ==================== PRIMARY ACTION ====================
function handlePrimaryAction() {
    switch(currentTab) {
        case 'students':
        case 'dashboard':
            openStudentModal();
            break;
        case 'routines':
            createRoutine();
            break;
        case 'schedule':
            createScheduleClass();
            break;
        case 'payments':
            createPayment();
            break;
    }
}

function handleExerciseSearch() {
    const activeFilter = document.querySelector('.exercise-filter.active')?.dataset.filter || 'all';
    const search = document.getElementById('exercise-search-input')?.value || '';
    renderExercises(activeFilter, search);
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize database
    await initDatabase();
    
    // Hide loading
    document.getElementById('loading-screen').style.display = 'none';
    
    // Setup navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = item.getAttribute('data-tab');
            if (tabId) switchTab(tabId);
        });
    });
    
    // Setup action button
    document.getElementById('action-btn').addEventListener('click', () => {
        switch(currentTab) {
            case 'students':
            case 'dashboard':
                openStudentModal();
                break;
            case 'schedule':
                createScheduleClass();
                break;
            case 'payments':
                createPayment();
                break;
            case 'routines':
                createRoutine();
                break;
        }
    });
    
    // Setup student search
    const studentSearch = document.getElementById('student-search');
    if (studentSearch) {
        studentSearch.addEventListener('input', renderStudents);
    }
    
    // Load all data
    loadSettings();
    renderDashboard();
    renderStudents();
    renderRoutines();
    renderExercises();
    renderSchedule();
    renderPayments();
    updateDropdowns();
    setupExerciseFilters();
});

// Expose functions globally
window.toggleSidebar = toggleSidebar;
window.switchTab = switchTab;
window.handlePrimaryAction = handlePrimaryAction;
window.handleExerciseSearch = handleExerciseSearch;
window.openStudentModal = openStudentModal;
window.closeStudentModal = closeStudentModal;
window.saveStudent = saveStudent;
window.editStudent = editStudent;
window.deleteStudent = deleteStudentConfirm;
window.createRoutine = createRoutine;
window.deleteRoutine = deleteRoutineConfirm;
window.createScheduleClass = createScheduleClass;
window.cancelClass = cancelClass;
window.deleteScheduledClass = cancelClass;
window.createPayment = createPayment;
window.saveSettings = saveSettings;
window.openPaymentModal = openPaymentModal;
window.togglePaymentStatus = togglePaymentStatus;
window.editPayment = editPayment;
window.renderStudents = renderStudents;
window.renderPayments = renderPayments;
window.renderDashboard = renderDashboard;
window.renderRoutines = renderRoutines;
window.renderSchedule = renderSchedule;
window.updateDropdowns = updateDropdowns;
window.updateBadges = updateBadges;