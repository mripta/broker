let httpServer = require('http').createServer();
let ws = require('websocket-stream');
let mqmongo = require('mqemitter-mongodb');
require('dotenv').config();

//Emitter
let emitter = mqmongo({url: process.env.MONGO_URL});

//Aedes Server
let aedes = require("aedes")({mq: emitter});

let server = require('net').createServer(aedes.handle);

// MQTT server
server.listen(process.env.MQTT_PORT, function () {
    console.log('server listening on port: ', process.env.MQTT_PORT)
});

// websocket server
ws.createServer({
    server: httpServer
}, aedes.handle);

httpServer.listen(process.env.WS_PORT, function () { 
    console.log('websocket server listening on port: ', process.env.WS_PORT)
});

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