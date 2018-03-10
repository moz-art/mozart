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
          group: null
        });
        console.log('group is freezed.');
        return;
    }
    if (!this.ws.groups[this.client.groupId]) {
      this.ws.groups[this.client.groupId] = {};
      this.ws.groupInfos[this.client.groupId] = {
        hasConductor: false,
        musicianCount: 0,
        readyCount: 0,
        song: null
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
    this.sendGroupChanged(group);
  }

  setSpeed(data) {
    console.log('speed changed', data.speed);
    const group = this.getGroupInfo();
    group.speed = data.speed;
    this.sendGroupChanged(group);
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
