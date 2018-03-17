const READY_STATE_OPEN = 1;
const tracksManifest = require('./tracks_manifest');
const fs = require("fs");
const mf = require("./midifile.js");


function createMidiFile(song) {
  var filename = `public/midi/${song}.mid`;
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
  var volumes = [];

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
      event: 'stop',
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
      case 'channel':
        {
          // TODO: Send notes operation to specific client.
          switch (event.subtype) {
            case 'noteOn':
            const velocity = Math.min(event.velocity * volumes[event.channel] * 2, 127);
              self.ws.sendMessageToGroup(self.groupId, JSON.stringify({
                event: 'noteOn',
                notes: {
                  note: event.noteNumber,
                  channel: event.channel,
                  velocity: velocity
                },
                result: true
              }));
              break;
            case 'noteOff':
              self.ws.sendMessageToGroup(self.groupId, JSON.stringify({
                event: 'noteOff',
                notes: {
                  note: event.noteNumber,
                  channel: event.channel,
                  velocity: event.velocity
                },
                result: true,
              }));
              break;
            case 'programChange':
              self.ws.sendMessageToGroup(self.groupId, JSON.stringify({
                event: 'programChange',
                program: {
                  program: event.programNumber,
                  channel: event.channel
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
    clearTimeout(timerID);
    finish();
  }

  function changeSpeed(spd) {
    if (spd < 10 || spd > 180 || !started) {
      return;
    }

    beatsPerMinute = spd;
  }

  function getSpeed() {
    return speed;
  }

  function setVolumes(v) {
    volumes = v;
  }

  var self = {
    'ws'  : ws,
    'groupId' : groupId,
    'changeSpeed': changeSpeed,
    'getSpeed': getSpeed,
    'replay': replay,
    'stop': stopPlaying,
    'setVolumes': setVolumes,
    'finishedCallback': null
  };
  return self;
}

const ROLE_TYPE = {
  CONDUCTOR: 'conductor',
  MUSICIAN: 'musician'
};

console.log('bach handler loaded');

class SocketHandler {
  constructor(ws) {
    this.ws = ws;
    this.client = {};
    this.groupReplayer = {};
  }

  handle(client, data) {
    this.client = client;
    switch (data.event) {
      case 'joinGroup':
      case 'setSong':
      case 'requestRole':
      case 'setSpeed':
      case 'setVolume':
      case 'start':
      case 'musicianReady':
        this[data.event](data);
        break;
      default:
        console.error(`unknown event: ${data.event}`, data);
    }
  }

  closeClient(client) {
    const group = this.getGroupInfo();
    if (client.conductor) {
      group.hasConductor = false;
    } else {
      group.musicianCount--;
      if (client.ready) {
        group.readyCount--;
      }
    }
    this.sendGroupChanged(group);
  }

  garbageCollection(groupId) {
    if (this.groupReplayer[groupId]) {
      this.groupReplayer[groupId].stop();
    }
    delete this.groupReplayer[groupId];
    delete this.ws.groups[groupId];
    delete this.ws.groupInfos[groupId];
  }

  send(data) {
    this.client.send(JSON.stringify(data));
  }

  joinGroup(data) {
    this.client.groupId = data.code;
    if (this.ws.groupInfos[this.client.groupId]
        && this.ws.groupInfos[this.client.groupId].freezed) {
        this.send({
          event: 'joinGroup',
          code: 1001,
          error: 'group is freezed',
          group: null,
          song: null,
          speed: null
        });
        console.log(`group, ${this.client.groupId} , is freezed.`);
        return;
    }
    if (!this.ws.groups[this.client.groupId]) {
      this.ws.groups[this.client.groupId] = {};
      this.ws.groupInfos[this.client.groupId] = {
        hasConductor: false,
        musicianCount: 0,
        readyCount: 0,
        song: null,
        speed: null
      };
    }
    this.ws.groups[this.client.groupId][this.client.id] = this.client;
    this.send({
      event: 'joinGroup',
      group: this.getGroupInfo()
    });
    console.log(`client [${this.client.id}] joined to ${this.client.groupId}`);
  }

  setSong(data) {
    if (!data.song) {
      return;
    }
    const trackInfo = tracksManifest.data[`${data.song}.mid`];
    const group = this.getGroupInfo();
    group.song = data.song;
    group.volumes = [];
    for (let i = 0; i < trackInfo.length; i++) {
      group.volumes.push(0.5);
    }
    const groupId = this.client.groupId;
    // init midi resources
    this.groupReplayer[groupId] = WSReplayer(this.ws, groupId, createMidiFile(group.song));
    this.groupReplayer[groupId].finishedCallback = () => {
      this.groupReplayer[groupId] = null;
      delete this.groupReplayer[groupId];
    };

    this.send({
      event: 'songInfo',
      song: data.song,
      tracks: trackInfo
    })
    this.sendGroupChanged(group);
  }

  setVolume(data) {
    const group = this.getGroupInfo();
    if (data.channel > -1 && data.channel < group.volumes.length) {
      group.volumes[data.channel] = data.volume;
    }
    this.groupReplayer[this.client.groupId].setVolumes(group.volumes);
  }

  setSpeed(data) {
    console.log('speed changed', data.speed);
    const group = this.getGroupInfo();
    if (group.speed === null && group.freezed && group.musicianCount === group.readyCount
        && this.groupReplayer[this.client.groupId]) {
      this.groupReplayer[this.client.groupId].replay();
    }
    this.groupReplayer[this.client.groupId].changeSpeed(data.speed);
    group.speed = data.speed;
    this.sendGroupChanged(group);
  }

  requestRole(data) {
    if (!data.role) {
      console.error('no role in data', data);
      return;
    }
    const group = this.getGroupInfo();
    let role = data.role;
    switch(role) {
      case ROLE_TYPE.CONDUCTOR:
        if (group.hasConductor) {
          // if group already have a conductor, we should convert client to musician
          role = ROLE_TYPE.MUSICIAN;
          group.musicianCount++;
          this.client.conductor = false;
        } else {
          this.client.conductor = true;
          group.hasConductor = true;
        }
        break;
      case ROLE_TYPE.MUSICIAN:
        this.client.conductor = false;
        group.musicianCount++;
        break;
      default:
        console.log(`unknown role found: ${role}`);
        return;
    }
    // reply to the current client
    this.send({
      event: 'requestRole',
      role,
      group
    });
    this.sendGroupChanged(group);
  }

  start() {
    const group = this.getGroup();
    const groupInfo = this.getGroupInfo();
    const groupId = this.client.groupId;
    if (!groupInfo.song) {
      console.log(`group ${groupId} cannot be started because of no song`);
      return;
    }
    groupInfo.freezed = true;
    const clientIds = Object.keys(group);
    // If we want to support conductor and musician at the same device,
    // we shouldn't remove the only one player.
    if (clientIds.length > 1) {
      // remove the conductor out which is this client.
      clientIds.splice(clientIds.indexOf(this.client.id), 1);
    }
    const trackCount = tracksManifest.data[`${groupInfo.song}.mid`].length;
    const trackMap = this.assignTracks(clientIds, trackCount);
    for (let clientId in trackMap) {
      if (group[clientId].readyState !== READY_STATE_OPEN) {
        continue;
      }
      // XXX: this is ugly, we should rewrite the code to avoid cross reference of ws and this one.
      this.ws.groups[groupId][clientId].send(JSON.stringify({
        event: 'trackInfo',
        channels: trackMap[clientId],
        instruments: this.getInstrumentsByTracks(trackMap[clientId], groupInfo),
        group: groupInfo
      }));
    }
  }

  musicianReady() {
    const group = this.getGroupInfo();
    group.readyCount++;
    this.client.ready = true;
    this.sendGroupChanged(group);
  }

  sendGroupChanged(group) {
    // reply to all clients in the same group.
    this.ws.sendMessageToGroup(this.client.groupId, JSON.stringify({
      event: 'groupChanged',
      group
    }));
  }

  getGroup() {
    return this.ws.groups[this.client.groupId];
  }

  getGroupInfo() {
    return this.ws.groupInfos[this.client.groupId];
  }

  assignTracks(clients, trackCount) {
    const trackMap = {};
    if (clients.length > trackCount) {
      for (let i = 0; i < clients.length; i++) {
        if (trackMap[clients[i]]) {
          trackMap[clients[i]].push(i % trackCount);
        } else {
          trackMap[clients[i]] = [i % trackCount];
        }
      }
    } else {
      for (let i = 0; i < trackCount; i++) {
        if (trackMap[clients[i % clients.length]]) {
          trackMap[clients[i % clients.length]].push(i);
        } else {
          trackMap[clients[i % clients.length]] = [i];
        }
      }
    }
    return trackMap;
  }

  getInstrumentsByTracks(tracks, groupInfo) {
    const song = tracksManifest.data[`${groupInfo.song}.mid`];
    return tracks.reduce((acc, trackId) => (acc.concat(song[trackId])), []);
  }

};

module.exports = SocketHandler;
