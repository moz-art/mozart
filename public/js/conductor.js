const WS_URL = 'ws://10.32.3.213:8888';

var MobileMotion = {
  MAX_QUEUE_LEN: 10,
  THRESHOLD_OFFSET: 7,
  MAX_SPEED: 1000,
  MIN_SPEED: 100,
  TARGET_MAX_SPEED: 2,
  TARGET_MIN_SPEED: 0.5,
  max: 15,
  queue: [],
  speedQueue: [],

  lowpass: function mm_lowpass(val, queue, max) {
    var sum = 0;
    queue.push(val);
    if (queue.length > max) {
      queue.shift();
    }
    queue.forEach(function(num) { sum += num; });
    return sum / queue.length;
  },

  record: function mm_record(x, y, z) {
    var val = this.lowpass(Math.sqrt(x*x + y*y + z*z),
      this.queue, this.MAX_QUEUE_LEN);

    if (val > this.max) {
      this.max = val;
    }

    if (val > this.max - this.THRESHOLD_OFFSET && !this.time) {
      this.time = new Date();
      if (this.prevTime) {
        var ms = this.time - this.prevTime;
        ms = Math.max(Math.min(ms, this.MAX_SPEED), this.MIN_SPEED);

        var newval = (ms - this.MIN_SPEED) / (this.MAX_SPEED - this.MIN_SPEED) *
          (this.TARGET_MAX_SPEED - this.TARGET_MIN_SPEED) +
          this.TARGET_MIN_SPEED;
        newval = this.lowpass(newval, this.speedQueue, 5);
        this.prevTime = null;
        return newval;
      }
    }
    if (val <= this.max - this.THRESHOLD_OFFSET && this.time) {
      this.prevTime = this.time;
      this.time = null;
    }

    return null;
  }
};

window.addEventListener('load', function() {
	var msg = document.getElementById('message');
	var ws = new WebSocket(WS_URL);
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
			  var speed = MobileMotion.record(
			  	event.acceleration.x,
			  	event.acceleration.y,
			  	event.acceleration.z)
			  if (speed) {
			  	ws.send(JSON.stringify({
			  		event: 'sendMessageToGroup',
			  		data: { action: 'speed', data: speed }
			  	}));
			  	msg.innerHTML = speed;
			  }
			});
		}
	});
});
