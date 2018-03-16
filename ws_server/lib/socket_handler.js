const READY_STATE_OPEN = 1;
const EventEmitter = require('events').EventEmitter;
const tracksManifest = require('./tracks_manifest');
const GameEngine = require('./game_engine');
const fs = require("fs");
const mf = require("./midifile.js");

function createMidiFile(song) {
  var filename = 'public/midi/' + song;
  console.log('[sh.js] download midi : ' + filename);
  var data = fs.readFileSync(filename, 'binary');
  var ff = [];
  var mx = data.length;
  var scc= String.fromCharCode;
  for (var z = 0; z < mx; z++) {
    ff[z] = scc(data.charCodeAt(z) & 255);
  }
  var midiFile = parseMIDI(ff.join(""));
  return midiFile;
}

function parseMIDI(data) {
  return mf.MidiFile(data);
}

function WSReplayer(ws, gid, midiFile) {
  var ws = ws;
  var groupId = gid;
  var trackStates = [];
  var beatsPerMinute = 120;
  var ticksPerBeat = midiFile.header.ticksPerBeat;
  var channelCount = 16;
  var speed = 1;
  var nextEventInfo;
  var secondsToNextEvent = -1;
  var timerID;
  var startTime;
  var stop = false;
  var started = false;

  var allOrderedEvents = [];
  for (var i = 0; i < midiFile.tracks.length; i++) {
    trackStates[i] = {
      'nextEventIndex': 0,
      'ticksToNextEvent': (
        midiFile.tracks[i].length ?
          midiFile.tracks[i][0].deltaTime :
          null
      )
    };
  }

  function prepareOrderedEvents() {
    var hasMoreEvent = true;
    while (hasMoreEvent) {
      var ticksToNextEvent = null;
      var nextEventTrack = null;
      var nextEventIndex = null;
      for (var i = 0; i < trackStates.length; i++) {
        if (
          trackStates[i].ticksToNextEvent != null
          && (ticksToNextEvent == null || trackStates[i].ticksToNextEvent < ticksToNextEvent)
        ) {
          ticksToNextEvent = trackStates[i].ticksToNextEvent;
          nextEventTrack = i;
          nextEventIndex = trackStates[i].nextEventIndex;
        }
      }
      if (nextEventTrack != null) {
        /* consume event from that track */
        var nextEvent = midiFile.tracks[nextEventTrack][nextEventIndex];
        var nextNextEvent = midiFile.tracks[nextEventTrack][nextEventIndex + 1];
        if (nextNextEvent) {
          trackStates[nextEventTrack].ticksToNextEvent += nextNextEvent.deltaTime;
        } else {
          trackStates[nextEventTrack].ticksToNextEvent = null;
        }
        trackStates[nextEventTrack].nextEventIndex += 1;
        // Todo : We could add timeline information for each event.
        //        So that we may synchronize the playback by sending current playing time to each client.
        nextEventInfo = {
          'ticksToEvent': ticksToNextEvent,
          'event': nextEvent,
          'track': nextEventTrack
        }
        allOrderedEvents.push(nextEventInfo);
      } else {
        hasMoreEvent = false;
        nextEventInfo = null;
      }
    }
    // ************　Debug purpose　************ //
    // console.log('TOTAL event length : ' + allOrderedEvents.length);
    // for (var i = 0; i < allOrderedEvents.length; i++) {
    //   var eventInfo = allOrderedEvents[i];
    //   console.log('Event track : ' + eventInfo['track'] + '/event.channel : ' + eventInfo['event'].channel + ', TTE : ' + eventInfo['ticksToEvent']);
    // }

    // Reverse it, so that the first-played event should be at the tail of list.
    allOrderedEvents.reverse();
  }

  var lastTick2Event = 0;
  function getNextEvent() {
    var ticksToNextEvent = null;
    nextEventInfo = allOrderedEvents.pop();
    if (nextEventInfo) {
      // Todo : We could filter out unwanted channel event to reduce the unnecessary timeout.
      ticksToNextEvent = nextEventInfo['ticksToEvent'] - lastTick2Event;
      lastTick2Event = nextEventInfo['ticksToEvent'];
      var beatsToNextEvent = ticksToNextEvent / ticksPerBeat;
      secondsToNextEvent = beatsToNextEvent / (beatsPerMinute / 60);
    } else {
      nextEventInfo = null;
      secondsToNextEvent = -1;
      finish();
    }
  }

  function finish() {
    self.ws.sendMessageToGroup(self.groupId, JSON.stringify({
      event: 'notesInfo',
      data: { action : 'stop' },
      result: true
    }));
    if (self.finishedCallback) {
      self.finishedCallback();
    }
  }

  prepareOrderedEvents();
  getNextEvent();

  function scheduleNextTimer() {
    if (stop) {
      finish();
      return;
    }

    if (secondsToNextEvent < 0) {
      return;
    }
    // flush first event
    handleEvent();
    getNextEvent();
    if (secondsToNextEvent < 0) {
      return;
    }

    // flush more events
    while(secondsToNextEvent === 0) {
      handleEvent();
      getNextEvent();
    }

    if (secondsToNextEvent < 0) {
      return;
    }
    startTime = (new Date()).getTime();
    var nTimeSpan = secondsToNextEvent * 1000 * speed;
    timerID = setTimeout(scheduleNextTimer, nTimeSpan);
  }

  function handleEvent() {
    var event = nextEventInfo.event;
    switch (event.type) {
      case 'meta':
        switch (event.subtype) {
          case 'setTempo':
            beatsPerMinute = 60000000 / event.microsecondsPerBeat
        }
        break;
      case 'channel':
        {
          // TODO: Send notes operation to specific client.
          switch (event.subtype) {
            case 'noteOn':
              self.ws.sendMessageToGroup(self.groupId, JSON.stringify({
                event: 'notesInfo',
                data: {
                  action : 'on',
                  en: event.noteNumber,
                  ec: event.channel,
                  ev: event.velocity
                },
                result: true
              }));
              break;
            case 'noteOff':
              self.ws.sendMessageToGroup(self.groupId, JSON.stringify({
                event: 'notesInfo',
                data: {
                  action : 'off',
                  en: event.noteNumber,
                  ec: event.channel
                },
                result: true,
              }));
              break;
            case 'programChange':
              self.ws.sendMessageToGroup(self.groupId, JSON.stringify({
                event: 'notesInfo',
                data: {
                  action : 'prgChange',
                  ep: event.programNumber,
                  ec: event.channel
                },
                result: true,
              }));
              break;
          }
          break;
        }
    }
  }

  function replay() {
    started = true;
    scheduleNextTimer();
  }

  function stopPlaying() {
    stop = true;
  }

  function changeSpeed(spd) {
    if (spd < 0.1 || !started) {
      return;
    }

    var elapsedTime = ((new Date()).getTime() - startTime) / speed;
    speed = spd;
    var diff = secondsToNextEvent * 1000 - elapsedTime;
    clearTimeout(timerID);
    timerID = setTimeout(scheduleNextTimer, diff * speed);
  }

  function getSpeed() {
    return speed;
  }

  var self = {
    'ws'  : ws,
    'groupId' : groupId,
    'changeSpeed': changeSpeed,
    'getSpeed': getSpeed,
    'replay': replay,
    'stop': stopPlaying,
    'finishedCallback': null
  };
  return self;
}


class SocketHandler {
  constructor(ws) {
    this.ws = ws;
    this.client = {};
    this.data = {};
    this.groupSongs = {};
    this.groupReplayer = {};
    this.groupSpeed = {};
    this.groupReady = {};
    this.eventEmitter = new EventEmitter();
    this.gameEngine = new GameEngine(this.groupSpeed);
    this.init();
  }

  init() {
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
  }

  handle(client, data) {
    this.client = client;
    this.data = data;
    this.eventEmitter.emit(data.event);
  }

  garbageCollection(groupId) {
    this.gameEngine.cleanConnectionByGroup(groupId);
  }

  closeClient(client) {}

  _getClientId() {
    this.client.send(JSON.stringify({
      event: this.data.event,
      data: this.client.id,
      result: true
    }));
  }

  _generateGroup() {
    const groupId = this.ws.generateHashId();

    this.client.groupId = groupId;
    if (!this.ws.groups[groupId]) {
      this.ws.groups[groupId] = {};
    }
    this.ws.groups[groupId][this.client.id] = this.client;
    this.client.send(JSON.stringify({
      event: this.data.event,
      data: groupId,
      result: true
    }));
    console.log('Client ' + this.client.id + ' generate ' + groupId + ' group.');
  }

  _groupIsReady() {
    console.log('Do _groupIsReady.');
    const groupId = this.client.groupId;

    const clientArray = [].concat(this._getClientIdArrayByGroup(this.ws.groups, groupId));
    clientArray.splice(clientArray.indexOf(this.client.id), 1);
    console.log('conductor id: ' + this.client.id);
    const trackArray = this._getTrackIdArrayByMusic(tracksManifest.data, this.groupSongs[groupId]);
    const trackMap = this._magicAsign(clientArray, trackArray);
    // Send tracks manifest.
    this.ws.sendMessageToGroup(groupId, JSON.stringify({
      event: 'tracksManifest',
      data: tracksManifest,
      result: true
    }));

    // TODO : Cached created song to improve performance.
    var midiFile = createMidiFile(this.groupSongs[groupId]);
    this.groupReplayer[groupId] = WSReplayer(this.ws, groupId, midiFile);
    this.groupReplayer[groupId].finishedCallback = function () {
      this.groupReplayer[groupId] = null;
      delete this.groupReplayer[groupId];
    }

    // Send specified track info to each client.
    for (let client in trackMap) {
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
    this.client.send(JSON.stringify({
      event: this.data.event,
      result: true
    }));
  }

  /**
   *
   */
  _getClientIdArrayByGroup(groups, groupId) {
    const clientIdArray = [];
    for (let id in groups[groupId]) {
      clientIdArray.push(id);
    }
    return clientIdArray;
  }

  _getTrackIdArrayByMusic(tracksManifest, filename) {
    const trackIdArray = [];
    for (let id in tracksManifest[filename]) {
      trackIdArray.push(id);
    }
    return trackIdArray;
  }

  /**
   * clients = [aa, bb, cc];
   * tracks = [dd, zz, ee, gg];
   */
  _magicAsign(clients, tracks) {
    const trackMap = {};
    if (clients.length > tracks.length) {
      for (let i = 0; i < clients.length; i++) {
        if (Array.isArray(trackMap[clients[i]])) {
          trackMap[clients[i]].push(tracks[i%tracks.length]);
        } else {
          trackMap[clients[i]] = [tracks[i%tracks.length]];
        }
      }
    } else {
      for (let i = 0; i < tracks.length; i++) {
        if (Array.isArray(trackMap[clients[i%clients.length]])) {
          trackMap[clients[i%clients.length]].push(tracks[i]);
        } else {
          trackMap[clients[i%clients.length]] = [tracks[i]];
        }
      }
    }
    return trackMap;
  }

  _joinGroup() {
    var groupId = this.data.data;
    const response = {
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
  }

  _setGroupSong() {
    const groupId = this.client.groupId;

    if (!this.groupSongs[groupId]) {
      this.groupSongs[groupId] = this.data.data;
    } else {
      consle.log('The music for ' + groupId + ' group is already set.');
    }
    this.client.send(JSON.stringify({
      event: this.data.event,
      result: true
    }));
  }

  _sendMessageToGroup() {
    if (this.data.data.action) {
      if (this.data.data.action == 'play') {
        this.groupReplayer[this.client.groupId].replay();
      } else if (this.data.data.action == 'speed') {
        this.groupReplayer[this.client.groupId].changeSpeed(this.data.data.data.speed);
      }
    }

    this.ws.sendMessageToGroup(this.client.groupId, JSON.stringify({
      event: this.data.event,
      data: this.data.data,
      result: true
    }));
    this.client.send(JSON.stringify({
      event: this.data.event,
      result: true
    }));
  }

  _playerIsReady() {
    const groupId = this.client.groupId;
    if (this.groupReady[groupId]) {
      this.groupReady[groupId]++;
    } else {
      this.groupReady[groupId] = 1;
    }

    this.client.send(JSON.stringify({
      event: this.data.event,
      result: true
    }));

    // XXX: Fix me for -1.
    if (this.ws.getActiveClientsNumberByGroup(groupId) - 1 === this.groupReady[groupId]) {
      this.ws.sendMessageToGroup(groupId, JSON.stringify({
        event: 'allPlayersReady',
        result: true
      }));
      console.log('Send allPlayersReady message.');
    }
  }

  _setGroupSpeed() {
    var groupId = this.client.groupId;
    if (this.data.data) {
      this.groupSpeed[groupId] = this.data.data;
    }

    if (this.groupReplayer[groupId]) {
      this.groupReplayer[groupId].changeSpeed(this.groupSpeed[groupId]);
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
  }

  _getGroupSpeed() {
    const groupId = this.client.groupId;
    // If we didn't set speed before, we set it as 1.
    if (!this.groupSpeed[groupId]) {
      this.groupSpeed[groupId] = 1;
    }
    console.log('this.groupSpeed[groupId]: ' + this.groupSpeed[groupId]);
    if (this.groupReplayer[groupId]) {
      var speed = this.groupReplayer[groupId].getSpeed();
    }
  }

  _ntp() {}
};

module.exports = SocketHandler;
