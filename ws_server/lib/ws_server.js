const DEFAULT_PORT = 8888,
      READY_STATE_OPEN = 1;
const Server = require('ws').Server;
const Hashids = require('hashids');
const uuid = require('node-uuid');
const SocketHandler = require('./socket_handler');

class WebSocketServer {
  constructor(port, server) {
    this.port = port || DEFAULT_PORT;
    this.server = server ? new Server({server: server}) :
                          new Server({ port: this.port });
    this.groups = {};
    this.socketHandler = new SocketHandler(this);
    this._init();
  }

  _init() {
    this.server.on('connection', (client) => {
      // Setup a unique id for the client.
      client.id = this.generateHashId();
      console.log('The client ' + client.id + ' is connected.');

      client.on('message', (data) => {
        this.socketHandler.handle(client, JSON.parse(data));
      });

      client.on('close', () => {
        // DOTO: remove the client from the group.
        console.log('The client ' + client.id + ' is closed.');
        if (this.getActiveClientsNumberByGroup(client.groupId) === 0) {
          this.socketHandler.garbageCollection(client.groupId);
          console.log(client.groupId + ' group is removed.');
        }
      });
    });
  }

  sendMessageToGroup(id, message) {
    for (let clientId in this.groups[id]) {
      let readyState = this.groups[id][clientId].readyState;
      console.log('Client ' + clientId + ' readyState: ' + readyState);

      if (readyState === READY_STATE_OPEN) {
        this.groups[id][clientId].send(message);
      }
    }
  }

  broadcast(message) {
    this.server.clients.forEach((client) => {
      client.send(message);
    });
  }

  generateHashId() {
    return new Hashids(uuid.v1()).encrypt(12345);
  }

  getActiveClientsNumberByGroup(groupId) {
    let length = 0;
    for (let clientId in this.groups[groupId]) {
      if (this.groups[groupId][clientId].readyState === READY_STATE_OPEN) {
        length++;
      }
    }
    return length;
  }
}

module.exports = WebSocketServer;
