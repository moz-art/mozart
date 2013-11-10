#Socket APIs

## getClientId
```
@param {String} { event: 'getClientId' }.
@response {String} { event: 'getClientId', data: clientId, result: true }.
```

## generateGroup
```
@param {String} { event: 'generateGroup' }.
@response {String} { event: 'generateGroup', data: groupId, result: true }.
```

## groupIsReady
```
@param {String} { event: 'groupIsReady' }.
@response {String} { event: 'groupIsReady', result: true }.
```

After group is ready, the server will send the music manifest to the Players.

## joinGroup
```
@param {String} { event: 'joinGroup', data: groupId }.
@response {String} { event: 'joinGroup', result: true }.
```
## setGroupSong
```
@param {String} { event: 'setGroupSong', data: song filename }.
@response {String} { event: 'setGroupSong', result: true }.
```

## sendMessageToGroup
```
@param {String} { event: 'sendMessageToGroup', data: message(JSON string) }.
@response {String} { event: 'sendMessageToGroup', result: true }.
```

sendMessageToGroup is used for Player and Input communicated each other.
For example, Input would like to speed up the speed of music:
Use it with data `{ action: 'controlSpeed',  data: 0.8 }`.

## playerIsReady
```
@param {String} { event: 'playerIsReady' }.
@response {String} { event: 'playerIsReady', result: true }.
```
If all player is ready in a group, the server will sendn a message `{ event: 'allPlayersReady', result: true }` to start the game.

## trackList
```
@response {String} { event: 'trackList', data: { song: filename, tracks: trackIdArray }, result: true }.
```

## tracksManifest
```
@response {String} { event: 'tracksManifest', data: tracksManifest, result: true }.
```

See the data format in the /ws_server/lib/tracks_manifest.js.

## ntp
```
@param {String} { event: 'ntp', data: client time }.
@response {String} { event: 'ntp', data: { clientTime: client time, serverTime: server time } , result: true }.
```

## setGroupSpeed
```
@param {String} { event: 'setGroupSpeed', data: conductor speed }.
@response {String} { event: 'setGroupSpeed', result: true }.
```

## getGroupSpeed
```
@param {String} { event: 'getGroupSpeed', data: client time }.
@response {String} { event: 'getGroupSpeed', data: { clientTime: client time triggerTime: trigger time, responseTime: response time, speed: conductor speed } , result: true }.
```

## showGameScore
```
@response {String} { event: 'showGameScore', data: score, result: true }.
```
