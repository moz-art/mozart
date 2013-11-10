const HARDCODE_HOSTNAME;
const WS_URL = 'ws://' + (HARDCODE_HOSTNAME || window.location.hostname) + ':80';

var ws, groupId;

function join(groupId) {
  ws.send(JSON.stringify({ event: 'joinGroup', data: groupId }));
}

window.addEventListener('load', function() {
  ws = new WebSocket(WS_URL);
  var seq = 0;

  if (window.location.hash.length > 1) {
    groupId = window.location.hash.substr(1);
  }

  var parser = new UAParser();
  if (parser.getEngine().name === 'WebKit') {
    MobileMotion.threshold = 8;
  }

  document.getElementById('primary-btn').addEventListener('click', function(evt) {
    if (evt.target.textContent === 'Ready') {
      evt.target.setAttribute('disabled', true);
      ws.send(JSON.stringify({ event: 'groupIsReady' }));
      document.getElementById('progress').classList.remove('hidden');
    } else if (evt.target.textContent === 'Play') {
      evt.target.setAttribute('disabled', true);
      ws.send(JSON.stringify({
        event: 'sendMessageToGroup',
        data: {action: 'play'}
      }));
    }
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
        data: { action: 'conductorJoined' }
      }));
    }
    if (ret.event === 'allPlayersReady' && ret.result) {
      var btn = document.getElementById('primary-btn')
      document.getElementById('progress').classList.add('hidden');
      btn.removeAttribute('disabled', true);
      btn.innerHTML = 'Play';

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
        if (speed && parser.getEngine().name === 'WebKit') {
          MobileMotion.MAX_SPEED = 2000;
          MobileMotion.MIN_SPEED = 300;
        }
        ws.send(JSON.stringify({
          event: 'setGroupSpeed',
          data: speed
        }));

        ws.send(JSON.stringify({
          event: 'sendMessageToGroup',
          data: {
            action: 'speed',
            data: {
              speed: speed,
              vector: vector,
              threshold: MobileMotion.threshold,
              seq: seq
            }
          }
        }));
      });
    }
  });
});
