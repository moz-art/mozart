const WS_URL = 'ws://' + window.location.hostname + ':8888';

var ws, groupId;

function join(groupId) {
  ws.send(JSON.stringify({ event: 'joinGroup', data: groupId }));
}

window.addEventListener('load', function() {
  var msg = document.getElementById('message');
  msg.innerHTML = WS_URL;
  ws = new WebSocket(WS_URL);
  var seq = 0;

  if (window.location.hash.length > 1) {
    groupId = window.location.hash.substr(1);
  }

  document.querySelector('#join').addEventListener('click', function() {
    groupId = document.querySelector('#group-id').value;
    join(groupId);
  });

  ws.addEventListener('open', function() {
    if (groupId) {
      join(groupId);
    }
  });

  ws.addEventListener('message', function(evt) {
    if (!evt.data) {
      return;
    }
    var ret = JSON.parse(evt.data);
    if (ret.event === 'joinGroup' && ret.result) {
      ws.send(JSON.stringify({
        event: 'sendMessageToGroup',
        data: {action: 'play'}
      }));
      window.addEventListener('devicemotion', function(event) {
        if (!event.acceleration.x) {
          return;
        }
        var vector = MobileMotion.getVector(
          event.acceleration.x,
          event.acceleration.y,
          event.acceleration.z);
        var speed = MobileMotion.record(vector);
        seq = (seq + 1) % 800;
        ws.send(JSON.stringify({
          event: 'sendMessageToGroup',
          data: {
            action: 'speed',
            data: {
              speed: speed,
              vector: vector,
              threshold: MobileMotion.THRESHOLD,
              seq: seq
            }
          }
        }));
      });
    }
  });
});
