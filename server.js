const http = require('http');
const fs = require('fs');
const url = require('url');
const { EventEmitter } = require('events');

//Implement a logging system that writes API request logs to a logs.txt file.
const logger = new EventEmitter();
//Log messages should include timestamps and details about API requests.
logger.on('log', (message) => {
  const timestamp = new Date().toISOString();
  fs.appendFile('logs.txt', `${timestamp} - ${message}\n`, err => {
    if (err) console.error('Log write error:', err);
  });
});

//Use fs.readFile() to read todos.json.
function readTodos(callback) {
  fs.readFile('todos.json', 'utf8', (err, data) => {
    if (err) return callback(err);
    try {
      const todos = JSON.parse(data);
      callback(null, todos);
    } catch (e) {
      callback(e);
    }
  });
}

//fs.writeFile() to update todos.json.
function writeTodos(todos, callback) {
  fs.writeFile('todos.json', JSON.stringify(todos, null, 2), 'utf8', callback);
}

function getRequestBody(req, callback) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      const data = JSON.parse(body);
      callback(null, data);
    } catch (err) {
      callback(err);
    }
  });
}

//Use the http module to create a server that listens on port 3000.
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const method = req.method;
  const path = parsedUrl.pathname;
  const idMatch = path.match(/^\/todos\/(\d+)$/);

  logger.emit('log', `${method} ${path}`);

  if (path === '/todos' && method === 'GET') {
    readTodos((err, todos) => {
      if (err) {
        res.writeHead(500);
        return res.end('Internal Server Error');
      }

      const { completed } = parsedUrl.query;
      let result = todos;

      if (completed !== undefined) {
        const boolCompleted = completed === 'true';
        result = todos.filter(todo => todo.completed === boolCompleted);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    });

  // GET /todos/:id
  } else if (idMatch && method === 'GET') {
    const id = parseInt(idMatch[1]);
    readTodos((err, todos) => {
      if (err) {
        res.writeHead(500);
        return res.end('Internal Server Error');
      }

      const todo = todos.find(t => t.id === id);
      if (!todo) {
        res.writeHead(404);
        return res.end('Todo not found');
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(todo));
    });

  // POST /todos
  } else if (path === '/todos' && method === 'POST') {
    getRequestBody(req, (err, newTodo) => {
      if (err) {
        res.writeHead(400);
        return res.end('Invalid JSON');
      }

      if (!newTodo.title) {
        res.writeHead(400);
        return res.end('Title is required');
      }

      readTodos((err, todos) => {
        if (err) {
          res.writeHead(500);
          return res.end('Internal Server Error');
        }

        const newId = todos.length ? Math.max(...todos.map(t => t.id)) + 1 : 1;
        const todo = {
          id: newId,
          title: newTodo.title,
          completed: newTodo.completed ?? false
        };

        todos.push(todo);
        writeTodos(todos, err => {
          if (err) {
            res.writeHead(500);
            return res.end('Failed to save todo');
          }

          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(todo));
        });
      });
    });

  // PUT /todos/:id
  } else if (idMatch && method === 'PUT') {
    const id = parseInt(idMatch[1]);
    getRequestBody(req, (err, updates) => {
      if (err) {
        res.writeHead(400);
        return res.end('Invalid JSON');
      }

      readTodos((err, todos) => {
        if (err) {
          res.writeHead(500);
          return res.end('Internal Server Error');
        }

        const index = todos.findIndex(t => t.id === id);
        if (index === -1) {
          res.writeHead(404);
          return res.end('Todo not found');
        }

        if (updates.title !== undefined) todos[index].title = updates.title;
        if (updates.completed !== undefined) todos[index].completed = updates.completed;

        writeTodos(todos, err => {
          if (err) {
            res.writeHead(500);
            return res.end('Failed to update todo');
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(todos[index]));
        });
      });
    });

  // DELETE /todos/:id
  } else if (idMatch && method === 'DELETE') {
    const id = parseInt(idMatch[1]);
    readTodos((err, todos) => {
      if (err) {
        res.writeHead(500);
        return res.end('Internal Server Error');
      }

      const index = todos.findIndex(t => t.id === id);
      if (index === -1) {
        res.writeHead(404);
        return res.end('Todo not found');
      }

      const deleted = todos.splice(index, 1)[0];
      writeTodos(todos, err => {
        if (err) {
          res.writeHead(500);
          return res.end('Failed to delete todo');
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(deleted));
      });
    });

  // Invalid Route
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(3000, () => {
  console.log(`Server running at http://localhost:3000`);
});
