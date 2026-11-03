// Get the packages we need
var express = require('express'),
    router = express.Router(),
    mongoose = require('mongoose');
var path = require('node:path');

// Read .env file
require('dotenv').config();

// Create our Express application
var app = express();

// Use environment defined port or 3000
var port = process.env.PORT || 3000;

// Connect to a MongoDB --> Uncomment this once you have a connection string!!
mongoose.connect(process.env.MONGODB_URI).catch(function (err) { console.error('MongoDB connection error:', err.message); });

// Allow CORS so that backend and frontend could be put on different servers
var allowCrossDomain = function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept, X-User-Id");
    res.header("Access-Control-Allow-Methods", "POST, GET, PUT, DELETE, OPTIONS");
    next();
};
app.use(allowCrossDomain);

// Parse URL-encoded and JSON request bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.json());


app.use('/users', require('./routes/users'));

// Use routes as a module (see index.js)
require('./routes')(app, router);

app.get('/app.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'app.js'));
});

app.get('/styles.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'styles.css'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(port);
console.log('Server running on port ' + port);