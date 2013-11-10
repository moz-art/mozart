const READY_STATE_OPEN = 1;
var EventEmitter = require('events').EventEmitter,
    tracksManifest = require('./tracks_manifest'),
    GameEngine = require('./game_engine');

function SocketHandler(ws) {
  this.ws = ws;
  this.client = {};
  this.data = {};
  this.groupSongs = {};
  this.groupSpeed = {};
  this.groupReady = {};
  this.eventEmitter = new EventEmitter();
  this.gameEngine = new GameEngine(this.groupSpeed);
  this.init();
}

SocketHandler.prototype = {
  init: function() {
    this.eventEmitter.on('getClientId', this._getClientId.bind(this));
    this.eventEmitter.on('generateGroup', this._generateGroup.bind(this));
    this.eventEmitter.on('groupIsReady', this._groupIsReady.bind(this));
    this.eventEmitter.on('joinGroup', this._joinGroup.bind(this));
    this.eventEmitter.on('setGroupSong', this._setGroupSong.bind(this));
    this.eventEmitter.on('sendMessageToGroup', this._sendMessageToGroup.bind(this));
    this.eventEmitter.on('playerIsReady', this._playerIsReady.bind(this));
    this.eventEmitter.on('ntp', this._ntp.bind(this));
    this.eventEmitter.on('setGroupSpeed', this._setGroupSpeed.bind(this));
    this.eventEmitter.on('getGroupSpeed', this._getGroupSpeed.bind(this));
  },

  handle: function(client, data) {
    this.client = client;
    this.data = data;
    this.eventEmitter.emit(data.event);
  },

  garbageCollection: function(groupId) {
    this.gameEngine.cleanConnectionByGroup(groupId);
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
        clientArray = this._getClientIdArrayByGroup(this.ws.groups, groupId);
        clientArray.splice(clientArray.indexOf(this.client), 1);
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
      if (this.ws.groups[groupId][client].readyState === READY_STATE_OPEN) {
        this.ws.groups[groupId][client].send(JSON.stringify({
          event: 'trackList',
          data: {
            song: this.groupSongs[groupId],
            tracks: trackMap[client] 
          },
          result: true
        }));
      }
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

  _setGroupSpeed: function() {
    var groupId = this.client.groupId,
        response = {
          event: this.data.event,
          result: true
        };
    if (this.data.data) {
      this.groupSpeed[groupId] = this.data.data;
    }

    // XXX: Not clear code.
    // Send score once set group speed.
    this.ws.sendMessageToGroup(groupId, JSON.stringify({
      event: 'showGameScore',
      data: this.gameEngine.getGameScoreByGroup(groupId),
      result: true,
    }));
    console.log('Score of groupId group: ' +
                this.gameEngine.getGameScoreByGroup(groupId));

    this.client.send(JSON.stringify(response));
  },

  _getGroupSpeed: function() {
    var triggerTime = new Date().getTime();
        groupId = this.client.groupId,
        response = {
          event: this.data.event,
          data: {
            clientTime: this.data.data,
            triggerTime: triggerTime
          },
          result: true
        };

    console.log('this.groupSpeed[groupId]: ' + this.groupSpeed[groupId]);
    // If we didn't set speed before, we set it as 1.
    if (!this.groupSpeed[groupId]) {
      this.groupSpeed[groupId] = 1;
    }
    response.data.speed = this.groupSpeed[groupId];
    response.data.responseTime = new Date().getTime();
    this.client.send(JSON.stringify(response));
  },

  _ntp: function() {}
};

module.exports = SocketHandler;
