const express = require('express');
const http = require('http');
const app = express();
const WebSocketServer = require('./ws_server/lib/ws_server');
// prepare web server
const port = (process.env.IS_PRODUCTION ? 80 : 8000);
app.use(express.static(__dirname + '/public'));
http.createServer(app).listen(port);

// start websocket server
new WebSocketServer(null, server);

console.log('Server running at http://127.0.0.1:' + port + '/');
