import mysql from 'mysql2/promise';

let connection = null;

if (process.env.MYSQLHOST && process.env.MYSQLUSER && process.env.MYSQLDATABASE) {
  connection = await mysql.createConnection({
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: process.env.MYSQLPORT ? parseInt(process.env.MYSQLPORT, 10) : 3306,
  });
  console.log('MySQL connected');
}

export default connection;
