const DEFAULT_PORT = 8888,
      READY_STATE_OPEN = 1;
var Server = require('ws').Server,
    Hashids = require('hashids'),
    uuid = require('node-uuid'),
    SocketHandler = require('./socket_handler'),
    socketHandler;

function WebSocketServer(port, server) {
  this.port = port || DEFAULT_PORT;
  this.server = server ? new Server({server: server}) : 
                         new Server({ port: this.port });
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
        // DOTO: remove the client from the group.
        console.log('The client ' + client.id + ' is closed.');
        if (this.getActiveClientsNumberByGroup(client.groupId) === 0) {
          socketHandler.garbageCollection(client.groupId);
          console.log(client.groupId + ' group is removed.');
        }
      }.bind(this));
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
  },

  getActiveClientsNumberByGroup: function(groupId) {
    var length = 0;
    for (var clientId in this.groups[groupId]) {
      if (this.groups[groupId][clientId].readyState === READY_STATE_OPEN) {
        length += 1;
      }
    }
    return length;
  }
};

module.exports = WebSocketServer;
