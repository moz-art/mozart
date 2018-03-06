const HARDCODE_HOSTNAME = null;
const PORT = window.location.port || 80;
const WS_URL = `ws://${HARDCODE_HOSTNAME || window.location.hostname}:${PORT}`;
var choosedMIDI;
var socket;
var uiInited;
var socketInited;
var currentStep = 0;
var groupID = '';
var midiFile;
var activePlayer;
var canvas;
var speed;
var joinToOthers = false;
var allTracks;
var score;

/**
 * start of socket
 */
function initSocket() {
    socket = new WebSocket(WS_URL);
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

    };
}

function sendMessage(msg) {
  socket.send(JSON.stringify(msg));
}

function handleGroupMessage(ctrl) {
  if (ctrl.action === 'play') {
    speed.style.width = '400px';
    console.log('play');
    scheduleNextTimeSpan(function() {
      startToPlay();
    }, 1000);
  } else if (ctrl.action === 'speed') {
    rendering(ctrl.data);
  } else if (ctrl.action === 'conductorJoined') {
    var href = window.location.href;
    href = href.substring(0, href.lastIndexOf('/player/')) +
           '/player/#' + groupID;
    $('.group-link').get(0).href = href;
    $('.group-link').text(href);
    if(!joinToOthers)
      nextStep();
    $('#canvas-container').show();
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
  }, 1000);
}

function handleGroupSpeed(data) {
  var clientTime = data.clientTme;
  var processTime = data.responseTime - data.triggerTime;
  NTP.parseServerResponse(clientTime,
                          clientTime - data.triggerTime - processTime);
  if (data.speed && activePlayer && activePlayer.getSpeed() !== data.speed) {
    scheduleNextTimeSpan(function() {
      activePlayer.changeSpeed(data.speed);
    }, 1000);
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
    // We set track index start from '01' in tracks_manifest.js.
    // For easier understanding in LIST operation, subtract 1 here.
    channels.push(parseInt(track)-1);
  });
  nextStep();
  downloadMIDI(choosedMIDI, function() {
    initMIDIjs(instruments, channels);
  });
}

function handleScore(data) {
  if (score) {
    score.innerHTML = data;
  }
}

function handleMessage(msg) {
  var data = JSON.parse(msg.data);

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
  } else if (data.event === 'showGameScore') {
    handleScore(data.data);
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

  if (data.speed) {
    var speedValue = Math.max(Math.min(data.speed, MobileMotion.TARGET_MAX_SPEED), MobileMotion.TARGET_MIN_SPEED);
    var newval = 800 - ((speedValue - MobileMotion.TARGET_MIN_SPEED) /
      (MobileMotion.TARGET_MAX_SPEED - MobileMotion.TARGET_MIN_SPEED) * 800);
    speed.style.width = newval + 'px';
    var red = Math.floor(Math.abs((newval - 400) / 400 * 255));
    var green = 255 - red;
    var color = 'rgb(' + red + ', ' + green + ', ' + parseInt('50', 10) + ')';
    console.log("color: " + color);
    speed.style.backgroundColor = color;
  }
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
        nextStep();
        stopPlaying();
      };
      console.log('soundfont is downloaded...');
      activePlayer.setActiveChannels(channels);
      console.log('channel configured')
      sendMessage({'event': 'playerIsReady'});
      $('#playStatus').text(
        'Load complete. Push play button on device once all players ready.');
    }
  });
}

function stopPlaying() {
  socket.close();
  $('#canvas-container').hide();
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
    $('#groupNumber').text(groupID);
    nextStep();
  } else {
    nextStep();
  }
}

function nextStep() {
  if (currentStep >= 1) {
    $('.mozart-header').hide('fast');
  }
  $('.step-' + currentStep++).hide('fast');
  if (currentStep == 3 && !joinToOthers)
    currentStep++;
  if (currentStep == 4 && joinToOthers) {
    currentStep++;
  }
  $('.step-' + currentStep).show('fast');
  $('.playingTitle').text(choosedMIDI);
}

function init() {
  hideAll();
  compabilityCheck();
  canvas = document.getElementById('canvas');
  speed = document.querySelector('#speed-dashboard > div');
  score = document.querySelector('.score > div');
  $('#canvas-container').hide();
  $('.restart-button').click(function() {
    window.location.reload();
  });
  initSongChooser();
  uiInited = true;
  readyToGo();
}

function hideAll() {
  for(var i = 1; i < 7; i++) {
    $('.step-' + i).hide();
  }
  $('#canvas-container').hide();
  $('.loading_stub').hide();
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
  $('#group-id').get(0).innerHTML = 'Conductor Page: <a target="_blank" href="'
                                    + href + '">' + href + '</a>';
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
  $('.loading_stub').show().fadeTo('slow', 0, function() {
    $('.loading_stub').hide();
  });
  $('#playStatus').text('Now playing...');
  activePlayer.replay();
}

function compabilityCheck() {
  if (jQuery.browser.chrome && parseInt(jQuery.browser.version) >= 29 ||
      jQuery.browser.mozilla && parseInt(jQuery.browser.version) >= 25) {
    $('#browserCompability').removeClass('alert');
  } else {
    $('#browserCompability').addClass('alert');
  }
}

initSocket();
$(document).ready(init);

