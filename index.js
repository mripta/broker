const MongoClient = require('mongodb').MongoClient;
const httpServer = require('http').createServer();
const mqmongo = require('mqemitter-mongodb');
const ws = require('websocket-stream');
const bcrypt = require('bcryptjs');
let mysql = require('mysql');
require('dotenv').config();

//MySQL
mysql = mysql.createPool({
    port : process.env.MYSQL_PORT,
    host : process.env.MYSQL_HOST,
    user : process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DB
});

// helper function to log date+text to console
const log = (text) => {
    if (process.env.DEBUG)
        console.log(`[${new Date().toLocaleString()}] ${text}`)
}

//Aedes Server
let aedes = require("aedes")({id: process.env.SERVER_ID});

let server = require('net').createServer(aedes.handle);

// MQTT server
server.listen(process.env.MQTT_PORT, function () {
    console.log('server listening on port:', process.env.MQTT_PORT)
});

// websocket server
ws.createServer({
    server: httpServer
}, aedes.handle);

httpServer.listen(process.env.WS_PORT, function () { 
    console.log('websocket server listening on port:', process.env.WS_PORT)
});

// authentication
aedes.authenticate = function(client, username, password, callback) {
    const mqerr = new Error('Auth error');
    mqerr.returnCode = 4;
    console.log('Client connected. Waiting login...');
    mysql.query('SELECT password FROM users WHERE email = ?',[username], function (error, results, fields) {
        if(error){
            console.log("MySQL error:", error);
            callback(mqerr,null);
        } else {
            if(results.length > 0){
                // compare password
                bcrypt.compare(password.toString(), results[0].password.toString(), function(err, res) {
                    if (err) throw err;
                    if(res) {
                        console.log("User", username, "logged in...");
                        callback(null,true);
                    } else {
                        // Wrong Password
                        console.log("Wrong password...");
                        callback(mqerr,null);
                    }
                });
            } else{
                // User doesn't exist
                console.log("User doesn't exist...");
                callback(mqerr,null);
            }
        }
    });
}

// publish
aedes.on('publish', function (packet, client) {
    if (client) {
        console.log('client: ', client.id, ' published ', packet.payload.toString(), ' on topic ',packet.topic);
        MongoClient.connect(process.env.MONGO_URL, { useUnifiedTopology: true }, function(err, client) {
            if (err) throw err;
            const db = client.db(process.env.MONGO_DB);
            db.collection(process.env.MONGO_COL).insertOne(packet, function(err, res) {
                if (err) throw err;
                client.close();
            });
        });
    }
});

aedes.on("clientDisconnect",function(client){
    console.log('client disconnected:', client.id);
});

aedes.on('clientError', function (client, err) {
    console.log('client error:', client.id);
});

aedes.on('connectionError', function (client, err) {
    console.log('connection error:', client);
});


aedes.on('subscribe', function (subscriptions, client) {
    if (client) {
        console.log('client:', client.id, 'subscribed', subscriptions);
    }
});

aedes.on('client', function (client) {
    console.log('new client:', client.id);
});