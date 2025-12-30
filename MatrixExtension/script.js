// --- State & Config ---
const quotes = ["Make it happen.", "Focus on the now.", "One step at a time.", "Deep work mode: On.", "Build consistency."];
let boards = [];
let activeBoardId = 1;
let editingTaskId = null;
let history = []; // Stack to store deep copies of 'boards' for undo
let currentView = 'kanban'; // 'kanban' or 'matrix'
let currentSubtasks = []; // Temporary storage for subtasks when adding/editing
let autoStatus = null; // Status to pre-select for new task
let showTabsDock = true;
let showUIButtons = true;

// --- Initialization ---
async function initData() {
    return new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['orbit_boards', 'orbit_active', 'orbit_theme', 'orbit_view', 'orbit_show_tabs', 'orbit_show_ui_buttons'], (result) => {
                boards = result.orbit_boards || [{ id: 1, name: "My Board", tasks: [] }];
                activeBoardId = parseInt(result.orbit_active) || 1;
                currentView = result.orbit_view || 'kanban';
                showTabsDock = result.orbit_show_tabs !== false;
                showUIButtons = result.orbit_show_ui_buttons !== false;
                if (result.orbit_theme === 'light') document.body.classList.add('light-mode');
                resolve();
            });
        } else {
            // Fallback to localStorage for web testing
            boards = JSON.parse(localStorage.getItem('orbit_boards')) || [{ id: 1, name: "My Board", tasks: [] }];
            activeBoardId = parseInt(localStorage.getItem('orbit_active')) || 1;
            currentView = localStorage.getItem('orbit_view') || 'kanban';
            showTabsDock = localStorage.getItem('orbit_show_tabs') !== 'false';
            showUIButtons = localStorage.getItem('orbit_show_ui_buttons') !== 'false';
            if (localStorage.getItem('orbit_theme') === 'light') document.body.classList.add('light-mode');
            resolve();
        }
    });
}


function setupDropZones() {
    // Setup drop zones for both Kanban and Matrix views
    const allDropZones = document.querySelectorAll('.task-list');
    allDropZones.forEach(zone => {
        zone.addEventListener('dragover', allowDrop);
        zone.addEventListener('drop', drop);
    });
}

// --- Core Logic ---
function pushToHistory() {
    // Keep last 30 states
    if (history.length >= 30) history.shift();
    history.push(JSON.parse(JSON.stringify(boards)));
}

function undo() {
    if (history.length === 0) return;
    const lastState = history.pop();
    boards = lastState;
    // Ensure activeBoardId still exists
    if (!boards.find(b => b.id === activeBoardId)) {
        activeBoardId = boards[0]?.id || 1;
    }
    saveAndRender();
}

function handleEnter(e) {
    if (e.key === 'Enter') addTask();
}

function addTask() {
    const input = document.getElementById('taskInput');
    const text = input.value.trim();
    if (!text) return;

    const board = getActiveBoard();
    pushToHistory();

    if (editingTaskId) {
        const task = board.tasks.find(t => t.id === editingTaskId);
        if (task) {
            task.text = text;
            task.subtasks = [...currentSubtasks];
        }
    } else {
        board.tasks.push({
            id: Date.now(),
            text: text,
            status: autoStatus || 'todo',
            subtasks: [...currentSubtasks]
        });
    }
    autoStatus = null;

    input.value = '';
    saveAndRender();
    closeModal();
}

function editTask(id) {
    const board = getActiveBoard();
    const task = board.tasks.find(t => t.id === id);
    if (!task) return;

    editingTaskId = task.id;
    document.getElementById('taskInput').value = task.text;

    currentSubtasks = task.subtasks ? JSON.parse(JSON.stringify(task.subtasks)) : [];

    openModal(true);
}

function getActiveBoard() {
    let board = boards.find(b => b.id === activeBoardId);
    if (!board) {
        if (boards.length > 0) {
            activeBoardId = boards[0].id;
            return boards[0];
        } else {
            addNewBoard("Main Board");
            return boards[0];
        }
    }
    return board;
}

// --- Rendering ---
function renderBoard() {
    const board = getActiveBoard();
    if (!board) return;

    // Update Board Name in headers
    const welcomeText = document.getElementById('welcome-text');
    if (welcomeText) welcomeText.innerText = board.name;
    const printHeaderText = document.getElementById('print-header-text');
    if (printHeaderText) printHeaderText.innerText = board.name;

    // Toggle visibility based on current view
    const boardGrid = document.querySelector('.board-grid');
    const matrixGrid = document.getElementById('eisenhower-grid');
    const header = document.querySelector('header');

    if (currentView === 'matrix') {
        document.body.classList.add('matrix-mode');
        boardGrid.classList.add('hidden');
        matrixGrid.classList.add('active');
        if (header) header.style.display = 'none';
        renderMatrix();
    } else {
        document.body.classList.remove('matrix-mode');
        boardGrid.classList.remove('hidden');
        matrixGrid.classList.remove('active');
        if (header) header.style.display = 'block';
        renderKanban();
    }
}

function renderKanban() {
    const board = getActiveBoard();
    if (!board) return;

    const cols = ['backlog', 'todo', 'inprogress', 'done'];

    cols.forEach(status => {
        const list = document.getElementById(status);
        list.innerHTML = '';

        const tasks = board.tasks.filter(t => t.status === status);
        document.getElementById(`count-${status}`).innerText = tasks.length;

        tasks.forEach(t => {
            const card = createTaskCard(t);
            list.appendChild(card);
        });
    });
}

function renderMatrix() {
    const board = getActiveBoard();
    if (!board) return;

    // Define matrix quadrants based on priority and status
    const quadrants = {
        'urgent-important': [], // High priority + (todo or inprogress)
        'not-urgent-important': [], // Medium priority + (todo or inprogress)
        'urgent-not-important': [], // High priority + done
        'not-urgent-not-important': [] // Medium/Low priority + done OR Low priority (any status)
    };

    // Categorize tasks
    board.tasks.forEach(t => {
        if (t.status === 'todo') {
            quadrants['urgent-important'].push(t);
        } else if (t.status === 'inprogress') {
            quadrants['not-urgent-important'].push(t);
        } else if (t.status === 'done') {
            quadrants['urgent-not-important'].push(t);
        } else {
            quadrants['not-urgent-not-important'].push(t);
        }
    });

    // Render each quadrant with correct counter IDs
    const counterIdMap = {
        'urgent-important': 'ui',
        'not-urgent-important': 'nui',
        'urgent-not-important': 'uni',
        'not-urgent-not-important': 'nuni'
    };

    Object.keys(quadrants).forEach(quadrantId => {
        const list = document.getElementById(quadrantId);
        list.innerHTML = '';

        const tasks = quadrants[quadrantId];
        const countElement = document.getElementById(`count-${counterIdMap[quadrantId]}`);
        if (countElement) countElement.innerText = tasks.length;

        tasks.forEach(t => {
            const card = createTaskCard(t, quadrantId);
            list.appendChild(card);
        });
    });
}

function createTaskCard(t, quadrantId = null) {
    const card = document.createElement('div');
    card.className = `task-card status-${t.status}`;
    card.draggable = true;
    card.tabIndex = 0;
    card.dataset.id = t.id;

    card.ondragstart = (e) => {
        e.dataTransfer.setData("text/plain", t.id);
        e.dataTransfer.effectAllowed = "move";
        card.classList.add('dragging');
    };
    card.ondragend = (e) => {
        card.classList.remove('dragging');
        document.querySelectorAll('.column, .matrix-quadrant').forEach(c => c.classList.remove('drag-over'));
    };

    card.ondblclick = (e) => {
        e.stopPropagation();
        editTask(t.id);
    };

    card.innerHTML = `
        <div class="delete-icon" data-id="${t.id}">×</div>
        <div class="task-body">${t.text}</div>
    `;

    if (t.subtasks && t.subtasks.length > 0) {
        const subtasksContainer = document.createElement('div');
        subtasksContainer.className = 'subtasks-container';
        t.subtasks.forEach((st, index) => {
            const stItem = document.createElement('div');
            stItem.className = `subtask-item ${st.completed ? 'completed' : ''}`;
            stItem.innerHTML = `
                <div class="subtask-checkbox"></div>
                <span class="subtask-text">${st.text}</span>
            `;
            stItem.onclick = (e) => {
                e.stopPropagation();
                toggleSubtask(t.id, index);
            };
            subtasksContainer.appendChild(stItem);
        });
        card.appendChild(subtasksContainer);
    }

    // Add click listener to delete icon
    card.querySelector('.delete-icon').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteTask(t.id);
    });

    return card;
}

function renderTabs() {
    const dock = document.getElementById('tabs-container');
    if (showTabsDock) {
        dock.style.display = 'flex';
        dock.innerHTML = '';

        boards.forEach(b => {
            const tab = document.createElement('div');
            tab.className = `tab-item ${b.id === activeBoardId ? 'active' : ''}`;
            tab.title = "Double-click to rename";
            tab.ondblclick = () => editBoardName(b.id);
            tab.onclick = () => { activeBoardId = b.id; saveAndRender(); };
            tab.innerHTML = `${b.name} <span class="tab-close" data-id="${b.id}">×</span>`;

            tab.querySelector('.tab-close').addEventListener('click', (e) => {
                e.stopPropagation();
                removeBoard(e, b.id);
            });

            dock.appendChild(tab);
        });
    } else {
        dock.style.display = 'none';
    }
}

// --- Board Management ---
function editBoardName(id) {
    const board = boards.find(b => b.id === id);
    if (!board) return;
    openNameModal("Rename Board Name?", (newName) => {
        if (newName) {
            pushToHistory();
            board.name = newName;
            saveAndRender();
        }
    });
}

function addNewBoard(name) {
    if (name) {
        pushToHistory();
        const newId = Date.now();
        boards.push({ id: newId, name: name, tasks: [] });
        activeBoardId = newId;
        saveAndRender();
    }
}

function removeBoard(e, id) {
    if (boards.length <= 1) return alert("You must have at least one board.");
    if (confirm(`Delete board? This cannot be undone.`)) {
        pushToHistory();
        boards = boards.filter(b => b.id !== id);
        if (activeBoardId === id) activeBoardId = boards[0].id;
        saveAndRender();
    }
}

function deleteActiveBoard() {
    if (boards.length <= 1) return alert("You must have at least one board.");
    if (confirm("Delete the CURRENT board? This cannot be undone.")) {
        pushToHistory();
        boards = boards.filter(b => b.id !== activeBoardId);
        activeBoardId = boards[0].id;
        saveAndRender();
    }
}

function deleteTask(id) {
    const tasks = Array.from(document.querySelectorAll('.task-card'));
    const index = tasks.findIndex(card => parseInt(card.dataset.id) === id);
    let nextId = null;

    // If the deleted task is currently focused, find the next one to focus
    if (index !== -1 && document.activeElement === tasks[index]) {
        if (tasks.length > 1) {
            const nextIndex = (index < tasks.length - 1) ? index + 1 : index - 1;
            nextId = parseInt(tasks[nextIndex].dataset.id);
        }
    }

    pushToHistory();
    const board = getActiveBoard();
    board.tasks = board.tasks.filter(t => t.id !== id);
    saveAndRender();

    // After re-rendering, if we have a next candidate, focus it
    if (nextId) {
        const nextTask = document.querySelector(`.task-card[data-id="${nextId}"]`);
        if (nextTask) nextTask.focus();
    }
}

function clearBoard() {
    if (confirm("Clear all tasks on this board? This cannot be undone.")) {
        pushToHistory();
        getActiveBoard().tasks = [];
        saveAndRender();
    }
}


// --- Drag & Drop Reordering ---
function allowDrop(e) {
    e.preventDefault();
}

function drop(e) {
    e.preventDefault();
    const id = parseInt(e.dataTransfer.getData("text/plain"));
    const board = getActiveBoard();

    const taskIndex = board.tasks.findIndex(t => t.id === id);
    if (taskIndex === -1) return;
    const task = board.tasks[taskIndex];

    const list = e.target.closest('.task-list');
    if (!list) return;

    const listId = list.id;
    const afterElement = getDragAfterElement(list, e.clientY);

    pushToHistory();
    board.tasks.splice(taskIndex, 1);

    if (currentView === 'matrix') {
        // Map quadrant to status
        switch (listId) {
            case 'urgent-important':
                task.status = 'todo';
                break;
            case 'not-urgent-important':
                task.status = 'inprogress';
                break;
            case 'urgent-not-important':
                task.status = 'done';
                break;
            case 'not-urgent-not-important':
                task.status = 'backlog';
                break;
        }
    } else {
        // Kanban view - update status only
        task.status = listId;
    }

    if (afterElement == null) {
        board.tasks.push(task);
    } else {
        const afterId = parseInt(afterElement.dataset.id);
        const afterIndex = board.tasks.findIndex(t => t.id === afterId);
        board.tasks.splice(afterIndex, 0, task);
    }

    saveAndRender();
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.task-card:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// --- Persistence & Theme ---
function saveAndRender() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({
            orbit_boards: boards,
            orbit_active: activeBoardId,
            orbit_view: currentView,
            orbit_show_tabs: showTabsDock,
            orbit_show_ui_buttons: showUIButtons
        });
    } else {
        localStorage.setItem('orbit_boards', JSON.stringify(boards));
        localStorage.setItem('orbit_active', activeBoardId);
        localStorage.setItem('orbit_view', currentView);
        localStorage.setItem('orbit_show_tabs', showTabsDock);
        localStorage.setItem('orbit_show_ui_buttons', showUIButtons);
    }
    updateUIToggles();
    renderTabs();
    renderBoard();
}

function updateUIToggles() {
    if (showUIButtons) {
        document.body.classList.remove('hide-ui-buttons');
        document.getElementById('uiButtonsToggleStatus').innerText = 'ON';
    } else {
        document.body.classList.add('hide-ui-buttons');
        document.getElementById('uiButtonsToggleStatus').innerText = 'OFF';
    }

    if (showTabsDock) {
        document.getElementById('tabsToggleStatus').innerText = 'ON';
    } else {
        document.getElementById('tabsToggleStatus').innerText = 'OFF';
    }
}

function toggleUIButtons() {
    showUIButtons = !showUIButtons;
    saveAndRender();
}

function toggleView() {
    currentView = currentView === 'kanban' ? 'matrix' : 'kanban';
    saveAndRender();
}

async function exportToPDF() {
    const element = document.querySelector('.app-container');
    const boardName = getActiveBoard()?.name || 'My Kanban';

    // Toggle PDF mode for capture
    document.body.classList.add('pdf-mode');

    // PDF Options
    const opt = {
        margin: 10,
        filename: `${boardName}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff'
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    try {
        await html2pdf().set(opt).from(element).save();
    } finally {
        // Restore normal mode
        document.body.classList.remove('pdf-mode');
    }
}

function resetAll() {
    if (confirm("⚠️ WARNING: This will permanently delete ALL boards, tasks, and settings. This action cannot be undone. Are you sure?")) {
        localStorage.clear();
        window.location.reload();
    }
}

function exportData() {
    const board = getActiveBoard();
    const data = JSON.stringify(boards, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${board.name}.json`;
    link.click();
}

function importData(input) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            boards = JSON.parse(e.target.result);
            if (boards.length > 0) activeBoardId = boards[0].id;
            saveAndRender();
            alert("Import successful! Board data has been loaded.");
        } catch (err) { alert("Invalid file format. Please use a valid JSON backup."); }
        input.value = '';
    };
    reader.readAsText(input.files[0]);
}

function toggleTheme() {
    document.body.classList.toggle('light-mode');
    const theme = document.body.classList.contains('light-mode') ? 'light' : 'dark';
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ orbit_theme: theme });
    } else {
        localStorage.setItem('orbit_theme', theme);
    }
}

// --- Keyboard Shortcuts ---


// --- Modal Logic ---
function openModal(isEdit = false) {
    document.getElementById('modalTitle').innerText = isEdit ? 'Edit Task' : (autoStatus ? `Add to ${autoStatus.toUpperCase()}` : 'Add Task');
    const taskInput = document.getElementById('taskInput');
    if (!isEdit) {
        editingTaskId = null;
        taskInput.value = '';
        taskInput.style.height = 'auto';
        currentSubtasks = [];
    } else {
        autoStatus = null;
    }

    renderModalSubtasks();
    document.getElementById('modalBackdrop').classList.add('active');
    document.getElementById('addTaskModal').classList.add('active');
    setTimeout(() => {
        taskInput.focus();
        if (isEdit) {
            taskInput.style.height = 'auto';
            taskInput.style.height = taskInput.scrollHeight + 'px';
        }
    }, 100);
}

function openSettings() {
    document.getElementById('modalBackdrop').classList.add('active');
    document.getElementById('settingsModal').classList.add('active');
    document.getElementById('tabsToggleStatus').innerText = showTabsDock ? 'ON' : 'OFF';
}

function closeModal() {
    document.getElementById('modalBackdrop').classList.remove('active');
    document.getElementById('addTaskModal').classList.remove('active');
    document.getElementById('settingsModal').classList.remove('active');
    document.getElementById('nameModal').classList.remove('active');
    document.getElementById('helpModal').classList.remove('active');
    autoStatus = null;
}

function openHelp() {
    document.getElementById('modalBackdrop').classList.add('active');
    document.getElementById('helpModal').classList.add('active');
}

// --- Subtask Logic ---
function renderModalSubtasks() {
    const list = document.getElementById('modalSubtaskList');
    list.innerHTML = '';
    currentSubtasks.forEach((st, index) => {
        const item = document.createElement('div');
        item.className = 'modal-subtask-item';
        item.innerHTML = `
            <span>${st.text}</span>
            <span class="remove-subtask">✕</span>
        `;
        item.querySelector('.remove-subtask').onclick = () => removeSubtask(index);
        list.appendChild(item);
    });
}

function addSubtask() {
    const input = document.getElementById('subtaskInput');
    const text = input.value.trim();
    if (!text) return;
    currentSubtasks.push({ text: text, completed: false });
    input.value = '';
    renderModalSubtasks();
}

function removeSubtask(index) {
    currentSubtasks.splice(index, 1);
    renderModalSubtasks();
}

function toggleSubtask(taskId, subtaskIndex) {
    const board = getActiveBoard();
    const task = board.tasks.find(t => t.id === taskId);
    if (task && task.subtasks && task.subtasks[subtaskIndex]) {
        pushToHistory();
        task.subtasks[subtaskIndex].completed = !task.subtasks[subtaskIndex].completed;
        saveAndRender();
    }
}

let pendingNameAction = null;
function openNameModal(placeholder, callback) {
    const modal = document.getElementById('nameModal');
    const input = document.getElementById('nameInput');
    input.placeholder = placeholder;
    input.value = '';
    pendingNameAction = callback;
    document.getElementById('modalBackdrop').classList.add('active');
    modal.classList.add('active');
    setTimeout(() => input.focus(), 100);
}

function handleNameSubmit() {
    const input = document.getElementById('nameInput');
    const name = input.value.trim();
    if (name && pendingNameAction) {
        pendingNameAction(name);
        closeModal();
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await initData();

    // Initial UI State
    document.getElementById('welcome-text').innerText = quotes[Math.floor(Math.random() * quotes.length)];
    const opts = { weekday: 'long', month: 'long', day: 'numeric' };
    document.getElementById('date-display').innerText = new Date().toLocaleDateString('en-US', opts);

    updateUIToggles();
    renderTabs();
    renderBoard();

    // Settings 
    const settingsBtn = document.querySelector('.settings-btn');
    if (settingsBtn) settingsBtn.addEventListener('click', openSettings);

    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', closeModal);

    const closeHelpBtn = document.getElementById('closeHelpBtn');
    if (closeHelpBtn) closeHelpBtn.addEventListener('click', closeModal);

    document.getElementById('clearAllBtn').onclick = () => { clearBoard(); closeModal(); };
    document.getElementById('toggleThemeBtn')?.addEventListener('click', () => { toggleTheme(); closeModal(); });
    document.getElementById('exportBtn')?.addEventListener('click', () => { exportData(); closeModal(); });

    // UI Preferences Toggles
    document.getElementById('toggleTabsBtn').onclick = () => {
        showTabsDock = !showTabsDock;
        saveAndRender();
    };

    const toggleUIButtonsBtn = document.getElementById('toggleUIButtonsBtn');
    if (toggleUIButtonsBtn) {
        toggleUIButtonsBtn.onclick = () => {
            toggleUIButtons();
        };
    }

    document.getElementById('resetAllBtn')?.addEventListener('click', () => { resetAll(); closeModal(); });

    document.getElementById('importTrigger')?.addEventListener('click', () => document.getElementById('fileInput').click());
    document.getElementById('fileInput')?.addEventListener('change', (e) => importData(e.target));

    // Board Management
    document.getElementById('newBoardBtn')?.addEventListener('click', () => {
        closeModal();
        openNameModal("New Board Name?", (name) => addNewBoard(name));
    });
    document.getElementById('renameBoardBtn')?.addEventListener('click', () => {
        closeModal();
        editBoardName(activeBoardId);
    });
    document.getElementById('deleteBoardBtn')?.addEventListener('click', () => {
        closeModal();
        deleteActiveBoard();
    });
    document.getElementById('saveNameBtn')?.addEventListener('click', handleNameSubmit);
    document.getElementById('nameInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleNameSubmit();
    });

    // Task Management
    const taskInput = document.getElementById('taskInput');
    if (taskInput) {
        taskInput.addEventListener('input', () => {
            taskInput.style.height = 'auto';
            taskInput.style.height = taskInput.scrollHeight + 'px';
        });
        taskInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                addTask();
            }
            if (e.key === 'Escape') closeModal();
            if (e.key === 'Tab' && !e.shiftKey) {
                e.preventDefault();
                document.getElementById('subtaskInput')?.focus();
            }
        });
    }

    const subtaskInput = document.getElementById('subtaskInput');
    if (subtaskInput) {
        subtaskInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                addSubtask();
            }
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                addTask();
            }
            if (e.key === 'Escape') closeModal();
        });
    }

    document.getElementById('modalBackdrop')?.addEventListener('click', closeModal);
    document.getElementById('helpBtn')?.addEventListener('click', openHelp);

    // Drop Zones
    document.querySelectorAll('.task-list').forEach(zone => {
        zone.addEventListener('dragover', allowDrop);
        zone.addEventListener('drop', drop);
    });

    // Double Click for Tasks
    document.body.ondblclick = (e) => {
        if (e.target.closest('.task-card') || e.target.closest('button') || e.target.closest('input') ||
            e.target.closest('textarea') || e.target.closest('.settings-btn') || e.target.closest('.tab-item')) return;

        if (document.getElementById('addTaskModal').contains(e.target)) return;

        const column = e.target.closest('.column');
        const quadrant = e.target.closest('.matrix-quadrant');

        if (column) {
            autoStatus = column.querySelector('.task-list')?.id || null;
        } else if (quadrant) {
            if (quadrant.classList.contains('quadrant-urgent-important')) autoStatus = 'todo';
            else if (quadrant.classList.contains('quadrant-not-urgent-important')) autoStatus = 'inprogress';
            else if (quadrant.classList.contains('quadrant-urgent-not-important')) autoStatus = 'done';
            else if (quadrant.classList.contains('quadrant-not-urgent-not-important')) autoStatus = 'backlog';
        } else {
            autoStatus = null;
        }
        openModal();
    };

    // Global Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        const isTyping = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
        const modalOpen = document.querySelector('.minimal-modal.active, .standard-modal.active');

        // Dedicated Task Selection via Tab
        if (e.key === 'Tab' && !modalOpen && !isTyping) {
            const tasks = Array.from(document.querySelectorAll('.task-card'));
            if (tasks.length === 0) return;
            e.preventDefault();
            const currentIndex = tasks.indexOf(document.activeElement);
            let nextIndex;
            if (e.shiftKey) {
                nextIndex = currentIndex <= 0 ? tasks.length - 1 : currentIndex - 1;
            } else {
                nextIndex = (currentIndex + 1) % tasks.length;
            }
            tasks[nextIndex].focus();
            return;
        }

        // Switch Boards Logic (Backtick/Tilde)
        if (e.key === '`' || e.key === '~') {
            if (!modalOpen && !isTyping) {
                e.preventDefault();
                if (boards.length > 1) {
                    const currentIndex = boards.findIndex(b => b.id === activeBoardId);
                    const nextIndex = (currentIndex + 1) % boards.length;
                    activeBoardId = boards[nextIndex].id;
                    saveAndRender();
                }
            }
            return;
        }

        if (isTyping || modalOpen) {
            if (e.key === 'Escape') closeModal();
            return;
        }

        // Shortcut Ctrl+Z for Undo (only when not typing and no modal open)
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            undo();
            return;
        }

        // Task Card Specific Actions
        if (e.target.classList.contains('task-card')) {
            const id = parseInt(e.target.dataset.id);
            if (e.key === 'Enter') {
                e.preventDefault();
                editTask(id);
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                deleteTask(id);
            }
        }

        if (e.key.toLowerCase() === 't') toggleTheme();
        if (e.key === '?' || e.key === '/') {
            e.preventDefault();
            openHelp();
        }
        if (e.key.toLowerCase() === 'm' && !e.ctrlKey && !e.metaKey) {
            toggleView();
        }
        if (e.key.toLowerCase() === 'i' && !e.ctrlKey && !e.metaKey) {
            document.getElementById('fileInput').click();
        }
        if (e.key.toLowerCase() === 'o' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            exportData();
        }
        if (e.key.toLowerCase() === 'p') {
            if (!e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                exportToPDF();
            } else if (e.ctrlKey || e.metaKey) {
                // Let Ctrl+P trigger default browser print
                // We don't preventDefault() here so the browser dialog opens
            }
        }
        if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey) {
            openSettings();
        }
        if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey) {
            openModal();
        }
        if (e.key.toLowerCase() === 'b' && !e.ctrlKey && !e.metaKey) {
            openNameModal("New Board Name?", (name) => addNewBoard(name));
        }
    });
});
