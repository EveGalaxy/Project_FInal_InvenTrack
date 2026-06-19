const mysql = require('mysql2');
require('dotenv').config();

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'inventorydb'
});

db.connect(err => {
    if (err) throw err;
    console.log("🔥 MySQL Connected...");
});

module.exports = db;
