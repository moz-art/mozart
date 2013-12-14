
const IS_PRODUCTION = true;
var express = require('express'),
    http = require('http'),
    app = express(),
    WebSocketServer = require('./ws_server/lib/ws_server');

var port = (IS_PRODUCTION ? 80 : 8000);

app.use(express.static(__dirname + '/public'));
var server = http.createServer(app);
server.listen(port);

// start websocket server
wsServer = new WebSocketServer(null, server);

console.log('Server running at http://127.0.0.1:' + port + '/');

