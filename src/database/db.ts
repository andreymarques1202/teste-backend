import {config} from "dotenv";

config();
import mysql from "mysql2";


const pool = mysql.createPool({
    host: "localhost",
    user: "root",
    password: process.env.MYSQLDB_PASSWORD,
    database: process.env.MYSQLDB_DATABASE
});

const DB = pool.promise();

export default DB;