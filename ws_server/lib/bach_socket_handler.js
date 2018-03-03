const READY_STATE_OPEN = 1;
const tracksManifest = require('./tracks_manifest');

const ROLE_TYPE = {
  CONDUCTOR: 'conductor',
  MUSICIAN: 'musician'
};

console.log('bach handler loaded');

class SocketHandler {
  constructor(ws) {
    this.ws = ws;
    this.client = {};
  }

  handle(client, data) {
    console.log(`handle event: ${data.event}`);
    this.client = client;
    switch (data.event) {
      case 'joinGroup':
      case 'setSong':
      case 'requestRole':
      case 'setSpeed':
      case 'start':
        this[data.event](data);
        break;
      default:
        console.error(`unknown event: ${data.event}`, data);
    }
  }

  garbageCollection(groupId) {
    // no more gc...
  }

  send(data) {
    this.client.send(JSON.stringify(data));
  }

  joinGroup(data) {
    this.groupId = data.code;
    if (!this.ws.groups[this.groupId]) {
      this.ws.groups[this.groupId] = {};
      this.ws.groupInfos[this.groupId] = {
        hasConductor: false,
        musician: 0,
        song: null
      };
    }
    this.ws.groups[this.groupId][this.client.id] = this.client;
    this.send({
      event: 'joinGroup',
      group: this.getGroupInfo()
    });
    console.log(`client [${this.client.id}] joined to ${this.groupId}`);
  }

  setSong(data) {
    if (!data.song) {
      return;
    }
    const group = this.getGroupInfo();
    group.song = data.song;
    this.ws.sendMessageToGroup(JSON.stringify({
      event: 'groupChanged',
      group
    }));
  }

  setSpeed(data) {
    // TODO: implement this with replayer.
    console.log('speed changed', data.speed);
  }

  requestRole(data) {
    if (!data.role) {
      console.error('no role in data', data);
      return;
    }
    const group = this.getGroupInfo();
    console.log('group info', JSON.stringify(group));
    let role = data.role;
    switch(role) {
      case ROLE_TYPE.CONDUCTOR:
        if (group.hasConductor) {
          // if group already have a conductor, we should convert client to musician
          role = ROLE_TYPE.MUSICIAN;
          group.musician++;
        } else {
          group.hasConductor = true;
        }
        break;
      case ROLE_TYPE.MUSICIAN:
        group.musician++;
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
    // reply to all clients in the same group.
    this.ws.sendMessageToGroup(JSON.stringify({
      event: 'groupChanged',
      group
    }));
  }

  start() {
    const group = this.getGroup();
    const groupInfo = this.getGroupInfo();
    if (!groupInfo.song) {
      console.log(`group ${this.groupId} cannot be started because of no song`);
      return;
    }
    const clientIds = Object.keys(group);
    // remove the conductor out.
    clientIds.splice(clientIds.indexOf(this.groupId));
    const trackIds = Object.keys(tracksManifest.data[`${groupInfo.song}.mid`]);
    const trackMap = assignTracks(clientIds, trackIds);

    for (let clientId in trackMap) {
      if (this.ws.groups[groupId][clientId].readyState !== READY_STATE_OPEN) {
        continue;
      }
      // XXX: this is ugly, we should rewrite the code to avoid cross reference of ws and this one.
      this.ws.groups[groupId][clientId].send(JSON.stringify({
        event: 'trackInfo',
        channels: trackMap[clientId],
        instruments: this.getInstrumentsByTracks(trackMap[clientId]),
        group: groupInfo
      }));
    }
  }

  getGroup() {
    return this.ws.groups[this.groupId];
  }

  getGroupInfo() {
    return this.ws.groupInfos[this.groupId];
  }

  assignTracks(clients, tracks) {
    const trackMap = {};
    if (clients.length > tracks.length) {
      for (let i = 0; i < clients.length; i++) {
        if (trackMap[clients[i]]) {
          trackMap[clients[i]].push(tracks[i % tracks.length]);
        } else {
          trackMap[clients[i]] = [tracks[i % tracks.length]];
        }
      }
    } else {
      for (let i = 0; i < tracks.length; i++) {
        if (trackMap[clients[i % clients.length]]) {
          trackMap[clients[i % clients.length]].push(tracks[i]);
        } else {
          trackMap[clients[i % clients.length]] = [tracks[i]];
        }
      }
    }
    return trackMap;
  }

  getInstrumentsByTracks(tracks) {
    const song = tracksManifest.data[`${groupInfo.song}.mid`];
    return tracks.reduce((acc, trackId) => (acc.concat(song[trackId])), []);
  }

};

module.exports = SocketHandler;
