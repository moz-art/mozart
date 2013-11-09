const DEFAULT_PORT = 8888,
      READY_STATE_OPEN = 1;
var Server = require('ws').Server,
    Hashids = require('hashids'),
    uuid = require('node-uuid'),
    SocketHandler = require('./socket_handler'),
    socketHandler;

function WebSocketServer(port) {
  this.port = port || DEFAULT_PORT;
  this.server = new Server({ port: this.port });
  this.groups = {};
  socketHandler = new SocketHandler(this);
  this._init();
}

WebSocketServer.prototype = {
  _init: function() {
    this.server.on('connection', function(client) {
      // Setup a unique id for the client.
      client.id = this.generateHashId();
      console.log('The client ' + client.id + ' is connected.');

      client.on('message', function(data) {
        socketHandler.handle(client, JSON.parse(data));
      }.bind(this));

      client.on('close', function() {
        console.log('The client ' + client.id + ' is closed.');
        // DOTO: remove the client from the group.
      });
    }.bind(this));
  },

  sendMessageToGroup: function(id, message) {
    for (var clientId in this.groups[id]) {
      var readyState = this.groups[id][clientId].readyState;
      console.log('Client ' + clientId + ' readyState: ' + readyState);

      if (readyState === READY_STATE_OPEN) {
        this.groups[id][clientId].send(message);
      }
    }
  },

  broadcast: function(message) {
    this.server.clients.forEach(function(client) {
      client.send(message);
    });
  },

  generateHashId: function() {
    return new Hashids(uuid.v1()).encrypt(12345);
  }
};

module.exports = WebSocketServer;
