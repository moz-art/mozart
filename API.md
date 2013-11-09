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

## joinGroup
```
@param {String} { event: 'joinGroup', data: groupId }.
@response {String} { event: 'joinGroup', result: true }.
```
## setGroupSong
```
@param {String} { event: 'setGroupSong', data: song name }.
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

## ntp
```
@param {String} { event: 'ntp', data: client time }.
@response {String} { event: 'ntp', data: { clientTime: client time, serverTime: server time } , result: true }.
```
