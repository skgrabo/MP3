function showTodoApp(user) {
    document.getElementById('signupPanel').hidden = true;
    document.getElementById('todoApp').hidden = false;
    document.getElementById('welcomeMessage').textContent = `Welcome, ${user.name}!`;
    loadTasks().catch(error => alert(error.message));
}

document.getElementById('signupForm').addEventListener('submit', async event => {
    event.preventDefault();
    const name = document.getElementById('userName').value.trim();
    const email = document.getElementById('userEmail').value.trim();
    const errorMessage = document.getElementById('signupError');
    errorMessage.textContent = '';

    try {
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email })
        });
        const user = await response.json();

        if (!response.ok) {
            throw new Error(user.message || 'Could not create your account.');
        }

        localStorage.setItem('todoUser', JSON.stringify(user));
        showTodoApp(user);
    } catch (error) {
        errorMessage.textContent = error.message;
    }
});

async function loadTasks() {
    const response = await fetch('/api/tasks');
    if (!response.ok) throw new Error('Could not load tasks');

    const tasks = await response.json();
    const list = document.getElementById('taskList');
    list.replaceChildren();

    tasks.forEach(task => {
        const item = document.createElement('li');
        item.className = 'task-item';

        const information = document.createElement('div');
        information.className = 'task-information';

        const taskName = document.createElement('span');
        taskName.className = 'task-name';
        taskName.textContent = task.name;
        information.appendChild(taskName);

        const taskDetails = document.createElement('span');
        taskDetails.textContent = `${task.description} — Due: ${new Date(task.deadline).toLocaleDateString()}`;
        information.appendChild(taskDetails);
        item.appendChild(information);

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.className = 'task-delete';
        deleteButton.onclick = () => deleteTask(task._id);
        item.appendChild(deleteButton);

        list.appendChild(item);
    });
}

async function addTask() {
    const name = document.getElementById('taskInput').value.trim();
    const description = document.getElementById('descriptionInput').value.trim();
    const deadline = document.getElementById('deadlineInput').value;

    if (!name || !deadline) {
        alert('Enter a task name and deadline.');
        return;
    }

    const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name,
            description,
            deadline,
            completed: false,
            assignedUser: '',
            assignedUserName: 'unassigned'
        })
    });

    if (!response.ok) {
        alert('Could not add task.');
        return;
    }

    document.getElementById('taskInput').value = '';
    document.getElementById('descriptionInput').value = '';
    document.getElementById('deadlineInput').value = '';
    await loadTasks();
}

async function deleteTask(id) {
    const response = await fetch(`/api/tasks/${encodeURIComponent(id)}`, {
        method: 'DELETE'
    });

    if (!response.ok) {
        alert('Could not delete task.');
        return;
    }

    await loadTasks();
}

const savedUser = localStorage.getItem('todoUser');
if (savedUser) {
    try {
        showTodoApp(JSON.parse(savedUser));
    } catch (error) {
        localStorage.removeItem('todoUser');
        console.error('Could not restore saved user:', error);
    }
}