
function SocketHandler(ws) {
  this.ws = ws;
  this.client = {};
  this.data = {};
}

SocketHandler.prototype = {
  handle: function(client, data) {
    this.client = client;
    this.data = data;

    switch (data.event) {
      case 'getClientId':
        this._getClientId();
        break;
      case 'generateGroup':
        this._generateGroup();
        break;
      case 'joinGroup':
        this._joinGroup();
        break;
      case 'sendMessageToGroup':
        this._sendMessageToGroup();
        break;
      case 'ntp':
        this._ntp();
        break;
      default:
        console.log('No such handler.');
    }
  },

  _getClientId: function() {
    var response = {
      event: this.data.event,
      data: this.client.id,
      result: true
    };
    this.client.send(JSON.stringify(response));
  },

  _generateGroup: function() {
    var groupId = this.ws.generateHashId(),
        response = {
          event: this.data.event,
          data: groupId,
          result: true
        };

    this.client.groupId = groupId;
    if (!this.ws.groups[groupId]) {
      this.ws.groups[groupId] = {};
    }
    this.ws.groups[groupId][this.client.id] = this.client;
    this.client.send(JSON.stringify(response));
    console.log('Client ' + this.client.id + ' generate ' + groupId + ' group.');
  },

  _joinGroup: function() {
    var groupId = this.data.data,
        response = {
          event: this.data.event,
        };

    this.client.groupId = groupId;
    if (this.ws.groups[groupId]) {
      response.result = true;
      this.ws.groups[groupId][this.client.id] = this.client;
      console.log('Client ' + this.client.id + ' join the ' + groupId + ' group.');
    } else {
      response.result = false;
      console.log('No such group.');
    }

    this.client.send(JSON.stringify(response));
  },

  _sendMessageToGroup: function() {
    var groupId = this.client.groupId,
        response = {
          event: this.data.event,
          result: true
        },
        message = {
          event: this.data.event,
          data: this.data.data,
          result: true
        };

    this.ws.sendMessageToGroup(groupId, JSON.stringify(message));
    this.client.send(JSON.stringify(response));
    console.log('Client ' + this.client.id + ' send message to ' + groupId + ' group: ' + JSON.stringify(message));
  },

  _ntp: function() {}
};

module.exports = SocketHandler;
