let httpServer = require('http').createServer();
let mqmongo = require('mqemitter-mongodb');
let ws = require('websocket-stream');
let Promise = require('promise');
let bcrypt = require('bcryptjs');
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

//Emitter
let emitter = mqmongo({url: process.env.MONGO_URL});

//Aedes Server
let aedes = require("aedes")({mq: emitter});

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

aedes.authenticate = function(client, username, password, callback) {
    console.log('Client connected. Waiting login...');
    var promise = new Promise(function(resolve,reject){
        mysql.query('SELECT password FROM users WHERE email = ?',[username], function (error, results, fields) {
            if(error){
                console.log("MySQL error:", error);
                reject();return;
            }
            if(results.length>0){
                // async method to check the password
                (async () =>{
                    bcrypt.compare(password.toString(), results[0].password.toString(), function(err, res) {
                        if (err) throw err;
                        if(res) {
                            console.log("User", username, "logged in...");
                            resolve();
                        } else {
                            // Wrong Password
                            console.log("Wrong password...");
                            reject();
                        }
                    });
                })(); 
    
            } else{
                // User doesn't exist
                console.log("User doesn't exist...");
                reject();
            }
        });
    });
    promise.then(function(){
        // Authenticate
        callback(null,true);
    }).catch(function(){
        // Reject
        callback(null,false);
    });
}

aedes.on("clientDisconnect",function(client){
    console.log('client disconnected: ', client.id);
});

aedes.on('clientError', function (client, err) {
    console.log('client error: ', client.id, err.message, err.stack);
});

aedes.on('connectionError', function (client, err) {
    console.log('connection error: ', client, err.message, err.stack);
});

aedes.on('publish', function (packet, client) {
    if (client) {
        console.log('client: ', client.id, ' published ', packet.payload.toString(), ' on topic ',packet.topic);
    }
});

aedes.on('subscribe', function (subscriptions, client) {
    if (client) {
        console.log('client: ', client.id, ' subscribed ', subscriptions);
    }
});

aedes.on('client', function (client) {
    console.log('new client: ', client.id);
});