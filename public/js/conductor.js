const WS_URL = 'ws://' + window.location.hostname + ':8888';

window.addEventListener('load', function() {
  var msg = document.getElementById('message');
  var ws = new WebSocket(WS_URL);
  var seq = 0;
  document.querySelector('#join').addEventListener('click', function() {
    var groupId = document.querySelector('#group-id').value;
    ws.send(JSON.stringify({ event: 'joinGroup', data: groupId }));
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
              threshold: MobileMotion.max - MobileMotion.THRESHOLD_OFFSET,
              seq: seq
            }
          }
        }));
      });
    }
  });
});
