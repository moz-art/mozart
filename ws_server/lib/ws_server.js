const DEFAULT_PORT = 8888,
      READY_STATE_OPEN = 1;
const Server = require('ws').Server;
const Hashids = require('hashids');
const uuid = require('node-uuid');
const SocketHandler = process.env['BACH'] ? require('./bach_socket_handler')
                                          : require('./socket_handler');

class WebSocketServer {
  constructor(port, server) {
    this.port = port || DEFAULT_PORT;
    this.server = server ? new Server({server: server}) :
                          new Server({ port: this.port });
    this.groups = {};
    this.groupInfos = {};
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
        this.socketHandler.closeClient(client);
        console.log('The client ' + client.id + ' is closed.');
        if (this.getActiveClientsNumberByGroup(client.groupId) === 0) {
          this.socketHandler.garbageCollection(client.groupId);
          console.log(client.groupId + ' group is removed.');
        }
      });

      client.on('error', (err) => {
        // if the client is disconnected unexpected, we will receive the ECONNRESET error.
        if (err.errno !== 'ECONNRESET') {
          console.error(`client ${client.id} error`, JSON.stringify(err.errno));
        }
      });
    });
    this.server.on('error', (err) => {
      console.error('ws server error', err);
    });
  }

  sendMessageToGroup(id, message) {
    for (let clientId in this.groups[id]) {
      let readyState = this.groups[id][clientId].readyState;

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
