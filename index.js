const IS_PRODUCTION = false;
var express = require('express'),
    childProcess = require('child_process'),
    app = express();

app.use(express.static(__dirname + '/public'));
app.listen(8080);

// Start the websocket server.
if (IS_PRODUCTION) {
  childProcess.spawn('node', ['./ws_server/index']);
}
