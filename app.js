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
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Could not create your account.');
        }

        const user = result.data;
        localStorage.setItem('todoUser', JSON.stringify(user));
        showTodoApp(user);
    } catch (error) {
        errorMessage.textContent = error.message;
    }
});

async function loadTasks() {
    const user = JSON.parse(localStorage.getItem('todoUser'));
    if (!user?._id) throw new Error('Please join before loading tasks.');

    const response = await fetch('/api/tasks', {
        headers: { 'X-User-Id': user._id }
    });
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
    let user;

    try {
        user = JSON.parse(localStorage.getItem('todoUser'));
    } catch (error) {
        alert('Could not read the signed-in user. Please join again.');
        return;
    }

    if (!name || !deadline) {
        alert('Enter a task name and deadline.');
        return;
    }

    if (!user?._id || !user.name) {
        alert('Please join before creating a task.');
        return;
    }

    const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': user._id },
        body: JSON.stringify({
            name,
            description,
            deadline,
            completed: false,
            assignedUser: user._id,
            assignedUserName: user.name
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
    const user = JSON.parse(localStorage.getItem('todoUser'));
    if (!user?._id) {
        alert('Please join before deleting a task.');
        return;
    }

    const response = await fetch(`/api/tasks/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'X-User-Id': user._id }
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
        const user = JSON.parse(savedUser);
        const currentUser = user.data || user;
        localStorage.setItem('todoUser', JSON.stringify(currentUser));
        showTodoApp(currentUser);
    } catch (error) {
        localStorage.removeItem('todoUser');
        console.error('Could not restore saved user:', error);
    }
}