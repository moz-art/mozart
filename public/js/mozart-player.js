
const SERVER = 'ws://localhost:8888/';
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

function handleMessage(msg) {
  var data = JSON.parse(msg.data);
  if (data.event === 'generateGroup') {
    groupID = data.data;
    socketInited = true;
    joinToOthers = false;
    readyToGo();
  } else if (data.event === 'joinGroup') {
    socketInited = true;
    joinToOthers = true;
    readyToGo();
  } else if (data.event === 'sendMessageToGroup') {
    var ctrl = data.data;
    if (ctrl.action === 'play') {
      console.log('play');
      startToPlay();
    } else if (ctrl.action === 'speed') {
      if (ctrl.data.speed) {
        activePlayer.changeSpeed(ctrl.data.speed);
      }
      if (canvas) {
        rendering(ctrl.data);
      }
    }
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

function initMIDIjs() {
  hideAll();
  MIDI.loadPlugin({
    soundfontUrl: "../js/MIDI.js/soundfont/",
/*    instruments: ["acoustic_grand_piano", "bright_acoustic_piano", "dulcimer" , "timpani", "trombone", "french_horn",
                  "orchestral_harp", "string_ensemble_1", "tremolo_strings", "trumpet",
                  "tubular_bells", "pad_8_sweep", "brass_section", "pizzicato_strings"


                  , "clarinet", "harpsichord", "choir_aahs", "orchestra_hit"

                  , "violin", "cello"

                  , "oboe", "string_ensemble_2", "flute"
                  ],*/
      instruments: ["acoustic_grand_piano", "violin", "contrabass"],
    callback: init
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
    nextStep();
  } else {
    nextStep();
  }
}

function nextStep() {
  $('.step-' + currentStep++).hide();
  $('.step-' + currentStep).show();
}

function init() {
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
    downloadMIDI(choosedMIDI);
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

function downloadMIDI(song) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', '../midi/' + song);
  xhr.overrideMimeType("text/plain; charset=x-user-defined");
  xhr.onreadystatechange = function() {
    if(xhr.readyState == 4 && xhr.status == 200) {
      /* munge response into a binary string */
      var t = xhr.responseText || "" ;
      var ff = [];
      var mx = t.length;
      var scc= String.fromCharCode;
      for (var z = 0; z < mx; z++) {
        ff[z] = scc(t.charCodeAt(z) & 255);
      }
      parseMIDI(ff.join(""));
    } else if (xhr.readyState === 4) {
      alert('failed to download midi file');
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
  activePlayer = Replayer(midiFile, MIDIChannel);
  activePlayer.finishedCallback = function() {
    activePlayer = null;
    alert('finished');
  };
  activePlayer.replay();
  console.log('done')
}

initSocket();
$(document).ready(initMIDIjs);

