
const SERVER = 'ws://localhost:8080/';
var choosedMIDI;
var socket;
var uiInited;
var socketInited;
var currentStep = 0;
var groupID = '';
var midiFile;
var activePlayer;

/**
 * start of socket
 */
function initSocket() {
    socket = new WebSocket(SERVER);
    socket.onopen = function() {
      requestGroupID();
    };

    socket.onerror = function() {
      alert('cannot connect to server');
    };
    socket.onmessage = handleMessage;
}

function sendMessage(msg) {
  socket.send(JSON.stringify(msg));
}

function handleMessage(msg) {
  var data = JSON.parse(msg.data);
  if (data.event === 'generateGroup') {
    groupID = data.data;
    socketInited = true;
    readyToGo();
  } else if (data.event === 'sendMessageToGroup') {
    startToPlay();
  }
}
/**
 * end of socket
 */

function initMIDIjs() {
  MIDI.loadPlugin({
    soundfontUrl: "../lib/MIDI.js/soundfont/",
/*    instruments: ["acoustic_grand_piano", "bright_acoustic_piano", "dulcimer" , "timpani", "trombone", "french_horn",
                  "orchestral_harp", "string_ensemble_1", "tremolo_strings", "trumpet",
                  "tubular_bells", "pad_8_sweep", "brass_section", "pizzicato_strings"


                  , "clarinet", "harpsichord", "choir_aahs", "orchestra_hit"

                  , "violin", "cello"

                  , "oboe", "string_ensemble_2", "flute"
                  ],*/
      instruments: ["acoustic_grand_piano"],
    callback: init
  });
}

function readyToGo() {
  if (!uiInited || !socketInited) {
    console.log('wait for other, ', uiInited, socketInited);
    return;
  }
  nextStep();
}

function nextStep() {
  $('.step-' + currentStep++).hide();
  $('.step-' + currentStep).show();
}

function init() {
  for(var i = 1; i < 4; i++) {
    $('.step-' + i).hide();
  }
  initSongChooser();
  uiInited = true;
  readyToGo();
}

function initSongChooser() {
  $('a[data-song]').click(function(evt) {
    choosedMIDI = evt.target.dataset.song;
    sendMessage({'event': 'setGroupSong', 'data': choosedMIDI});
    downloadMIDI(choosedMIDI);
    initQRCode();
    nextStep();
  });
}

function initQRCode() {
  $('#group-id').text(groupID);
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
  }
  xhr.send();
}

function parseMIDI(data) {
  midiFile = MidiFile(data);
}

function requestGroupID() {
  sendMessage({'event': 'generateGroup'});
}

function startToPlay() {
  activePlayer = Replayer(midiFile, MIDIChannel);
  activePlayer.finishedCallback = function() {
    activePlayer = null;
    alert('finished');
  };
  activePlayer.replay();
}

initSocket();
$(document).ready(initMIDIjs);

