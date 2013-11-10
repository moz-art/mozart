const HARDCODE_HOSTNAME;
const SERVER = 'ws://' + (HARDCODE_HOSTNAME || window.location.hostname) + ':8888';
var choosedMIDI;
var socket;
var uiInited;
var socketInited;
var currentStep = 0;
var groupID = '';
var midiFile;
var activePlayer;
var canvas;
var joinToOthers = false;
var allTracks;

/**
 * start of socket
 */
function initSocket() {
    socket = new WebSocket(SERVER);
    socket.onopen = function() {
      var href = window.location.href;
      if (/\#[a-zA-Z0-9]+$/.test(href)) {

        groupID = href.substring(href.lastIndexOf('#') + 1);
        joinGroup(groupID);
      } else {
        requestGroupID();  
      }
      scheduleSyncGroupSpeed();
    };

    socket.onerror = function() {
      alert('cannot connect to server');
    };
    socket.onmessage = handleMessage;
    socket.onclose = function() {
      alert('server is closed, please reload');
    };
}

function sendMessage(msg) {
  socket.send(JSON.stringify(msg));
}

function handleGroupMessage(ctrl) {
  console.log('group message: ' + ctrl.action);
  if (ctrl.action === 'play') {
    console.log('play');
    startToPlay();
  } else if (ctrl.action === 'speed') {
  }
}

function scheduleNextTimeSpan(func, span) {
  var lNow = NTP.fixTime();
  var wait = span - (lNow % span);
  setTimeout(func, wait);
}

function scheduleSyncGroupSpeed() {
  scheduleNextTimeSpan(function() {
    sendMessage({'event': 'getGroupSpeed', 'data': NTP.getNow()});
  }, 500);
}

function handleGroupSpeed(data) {
  var clientTime = data.clientTme;
  var processTime = data.responseTime - data.triggerTime;
  NTP.parseServerResponse(clientTime,
                          clientTime - data.triggerTime - processTime);
  if (activePlayer && activePlayer.getSpeed() !== data.speed) {
    scheduleNextTimeSpan(function() {
      activePlayer.changeSpeed(data.speed);
    }, 500);
  }  
  scheduleSyncGroupSpeed();
}

function handleTrackList(list) {
  console.log('choosedMIDI', choosedMIDI);
  var instruments = [];
  var channels = [];
  list.forEach(function(track) {
    console.log('track', track);
    allTracks[choosedMIDI][track].forEach(function(instrument) {
      if (instruments.indexOf(instrument) === -1) {
        instruments.push(instrument);
      }
    });
    channels.push(parseInt(track));
  });
  downloadMIDI(choosedMIDI, function() {
    initMIDIjs(instruments, channels);
  });
}

function handleMessage(msg) {
  var data = JSON.parse(msg.data);
  if (data.event !== 'getGroupSpeed') {
    console.log('server message: ' + data.event);
  }

  if (data.event === 'generateGroup') {
    groupID = data.data;
    socketInited = true;
    joinToOthers = false;
    readyToGo();
  } else if (data.event === 'joinGroup') {
    console.log('group joined');
    socketInited = true;
    joinToOthers = true;
    readyToGo();
  } else if (data.event === 'sendMessageToGroup') {
    handleGroupMessage(data.data);
  } else if (data.event === 'trackList') {
    console.log('track list got');
    choosedMIDI = data.data.song;
    handleTrackList(data.data.tracks);
  } else if (data.event === 'tracksManifest') {
    console.log('all tracks got');
    allTracks = data.data.data;
  } else if (data.event === 'getGroupSpeed') {
    handleGroupSpeed(data.data);
  }
 }

function rendering (data) {
  var ctx = canvas.getContext('2d');
  ctx.moveTo(data.seq + 2, 0);
  ctx.lineTo(data.seq + 2, 300);
  ctx.stroke();

  ctx.clearRect(data.seq + 1, 0, 1, 300);
  ctx.fillStyle = '#ce5c00';
  ctx.beginPath();
  ctx.arc(data.seq, data.vector * 10, 1, 0, 2 * Math.PI);
  ctx.fill();

  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(data.seq, data.threshold * 10, 1, 0, 2*Math.PI);
  ctx.fill();
}

/**
 * end of socket
 */

function initMIDIjs(instruments, channels) {
  console.log('start loading MIDI.js');
  MIDI.loadPlugin({
    soundfontUrl: "../js/MIDI.js/soundfont/",
    instruments: instruments,
    callback: function() {
      activePlayer = Replayer(midiFile, MIDIChannel);
      activePlayer.finishedCallback = function() {
        activePlayer = null;
        alert('finished, please reload to replay it.');
      };
      console.log('soundfont is downloaded...');
      activePlayer.setActiveChannels(channels);
      console.log('channel configured')
      sendMessage({'event': 'playerIsReady'});
    }
  });
}

function readyToGo() {
  if (!uiInited || !socketInited) {
    console.log('wait for other, ', uiInited, socketInited);
    return;
  }
  console.log(joinToOthers);
  if (joinToOthers) {
    $('.step-' + currentStep).hide();
    currentStep = 2;
    debugger;
    $('#groupNumber').text(groupID);
    nextStep();
  } else {
    nextStep();
  }
}

function nextStep() {
  $('.step-' + currentStep++).hide('fast');
  $('.step-' + currentStep).show('fast');
}

function init() {
  hideAll();
  canvas = document.getElementById('canvas');
  initSongChooser();
  uiInited = true;
  readyToGo();
}

function hideAll() {
  for(var i = 1; i < 4; i++) {
    $('.step-' + i).hide();
  }
}

function initSongChooser() {
  $('a[data-song]').click(function(evt) {
    choosedMIDI = evt.target.dataset.song;
    $('.song-toggle').text(choosedMIDI);
    enablePreviewPlayer(choosedMIDI);
  });
  $('.song-confirm').click(function(evt) {
    sendMessage({'event': 'setGroupSong', 'data': choosedMIDI});
    enablePreviewPlayer();
    initQRCode();
    nextStep();
  });
}

function enablePreviewPlayer(song) {
  $('.preview-box').css('display', 'inline-block');
  var player = $('.preview-audio').get(0);
  player.pause();
  var ext = $.browser.mozilla ? '.ogg' : '.mp3';
  if (song) {
    player.src = '../mp3/' + song + ext;
  } else {
    player.src = '';
    player.load();
    $('.preview-box').css('display', 'none');
  }
}

function initQRCode() {
  var href = window.location.href;
  href = href.substring(0, href.lastIndexOf('/player/')) +
         '/conductor/#' + groupID;
  $('#group-id').text(href);
  $('.qrcode-group-id').qrcode({
    render: 'canvas',
    size: 400,
    text: href,
    label: groupID
  });
  $('.qr-loading').hide();
}

function downloadMIDI(song, readyCallback) {
  console.log('download midi');
  var xhr = new XMLHttpRequest();
  xhr.open('GET', '../midi/' + song);
  xhr.overrideMimeType("text/plain; charset=x-user-defined");
  xhr.onreadystatechange = function() {
    if(xhr.readyState == 4 && xhr.status == 200) {
      console.log('midi downloaded');
      /* munge response into a binary string */
      var t = xhr.responseText || "" ;
      var ff = [];
      var mx = t.length;
      var scc= String.fromCharCode;
      for (var z = 0; z < mx; z++) {
        ff[z] = scc(t.charCodeAt(z) & 255);
      }
      parseMIDI(ff.join(""));
      if (readyCallback) {
        readyCallback();
      }
    } else if (xhr.readyState === 4) {
      alert('failed to download midi file, please reload');
    }
  };
  xhr.send();
}

function parseMIDI(data) {
  midiFile = MidiFile(data);
}

function requestGroupID() {
  sendMessage({'event': 'generateGroup'});
}

function joinGroup(id) {
 sendMessage({'event': 'joinGroup', 'data': id}); 
}

function startToPlay() {
  console.log('start to player song now...');
  nextStep();
  activePlayer.replay();
}

initSocket();
$(document).ready(init);

