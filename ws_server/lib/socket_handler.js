var tracksManifest = require('./tracks_manifest.js');

function SocketHandler(ws) {
  this.ws = ws;
  this.client = {};
  this.data = {};
  this.groupSongs = {};
  this.groupReady = {};
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
      case 'groupIsReady':
        this._groupIsReady();
        break;
      case 'joinGroup':
        this._joinGroup();
        break;
      case 'setGroupSong':
        this._setGroupSong();
        break;
      case 'sendMessageToGroup':
        this._sendMessageToGroup();
        break;
      case 'playerIsReady':
        this._playerIsReady();
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

  _groupIsReady: function() {
    console.log('Do _groupIsReady.');
    var groupId = this.client.groupId,
        clientsNumber = this.ws.getActiveClientsNumberByGroup(groupId),
        response = {
          event: this.data.event,
          result: true
        },
        clientArray = this._getClientIdArrayByGroup(this.ws.groups, groupId),
        trackArray = this._getTrackIdArrayByMusic(tracksManifest.data, this.groupSongs[groupId]),
        trackMap = this._magicAsign(clientArray, trackArray);
    // Send tracks manifest.
    this.ws.sendMessageToGroup(groupId, JSON.stringify({
      event: 'tracksManifest',
      data: tracksManifest,
      result: true
    }));

    // Send specified track info to each client.
    for (var client in trackMap) {
      this.ws.groups[groupId][client].send(JSON.stringify({
        event: 'trackList',
        data: {
          song: this.groupSongs[groupId],
          tracks: trackMap[client] 
        },
        result: true
      }));
    }
    this.client.send(JSON.stringify(response));
  },

  /**
   * 
   */
  _getClientIdArrayByGroup: function(groups, groupId) {
    var clientIdArray = [];
    for (var id in groups[groupId]) {
      clientIdArray.push(id);
    }
    return clientIdArray;
  },

  _getTrackIdArrayByMusic: function(tracksManifest, filename) {
    var trackIdArray = [];
    for (var id in tracksManifest[filename]) {
      trackIdArray.push(id);
    }
    return trackIdArray;
  },

  /**
   * clients = [aa, bb, cc];
   * tracks = [dd, zz, ee, gg];
   */
  _magicAsign: function(clients, tracks) {
    var trackMap = {};
    if (clients.length > tracks.length) {
      for (var i = 0; i < clients.length; i++) {
        if (Array.isArray(trackMap[clients[i]])) {
          trackMap[clients[i]].push(tracks[i%tracks.length]);
        } else {
          trackMap[clients[i]] = [tracks[i%tracks.length]];
        }
      }
    } else {
      for (var i = 0; i < tracks.length; i++) {
        if (Array.isArray(trackMap[clients[i%clients.length]])) {
          trackMap[clients[i%clients.length]].push(tracks[i]);
        } else {
          trackMap[clients[i%clients.length]] = [tracks[i]];
        }
      }
    }
    return trackMap;
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

  _setGroupSong: function() {
    var groupId = this.client.groupId,
        response = {
          event: this.data.event,
          result: true
        };

    if (!this.groupSongs[groupId]) {
      this.groupSongs[groupId] = this.data.data;
    } else {
      consle.log('The music for ' + groupId + ' group is already set.');
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

  _playerIsReady: function() {
    var groupId = this.client.groupId,
        response = {
          event: this.data.event,
          result: true
        };
    if (this.groupReady[groupId]) {
      this.groupReady[groupId] += 1;
    } else {
      this.groupReady[groupId] = 1;      
    }

    this.client.send(JSON.stringify(response));

    // XXX: Fix me for -1.
    if (this.ws.getActiveClientsNumberByGroup(groupId) - 1 === this.groupReady[groupId]) {
      this.ws.sendMessageToGroup(groupId, JSON.stringify({
        event: 'allPlayersReady',
        result: true
      }));
      console.log('Send allPlayersReady message.');
    }
  },

  _ntp: function() {}
};

module.exports = SocketHandler;
