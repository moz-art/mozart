
window.onload = domReady;
window.onerror = function(ex) {
  alert('error: ' + ex.message);
};

var activePlayer;
var midiButtons;
var isChrome = navigator.userAgent.toLowerCase().indexOf('chrome') > -1;
var isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
var isSafari = navigator.userAgent.toLowerCase().indexOf('safari') > -1;

function $(id) {
  return document.getElementById(id);
}

function domReady() {
  $('message').textContent = 'Initialize MIDI player';
  MIDI.loadPlugin({
    soundfontUrl: "/public/js/MIDI.js/soundfont/",
/*    instruments: ["acoustic_grand_piano", "bright_acoustic_piano", "dulcimer" , "timpani", "trombone", "french_horn",
                  "orchestral_harp", "string_ensemble_1", "tremolo_strings", "trumpet",
                  "tubular_bells", "pad_8_sweep", "brass_section", "pizzicato_strings"


                  , "clarinet", "harpsichord", "choir_aahs", "orchestra_hit"

                  , "violin", "cello"

                  , "oboe", "string_ensemble_2", "flute"
                  ],*/
      instruments: ["acoustic_grand_piano", "violin", "contrabass"],
    callback: function() {
      $('message').textContent = 'Ready';
      initMIDIButtons();
      $('btn-update-speed').addEventListener('click', updateSpeed);
      $('btn-stop').addEventListener('click', stopPlaying);
    }
  });
}

function initMIDIButtons() {
  midiButtons = document.querySelectorAll('.midi-btn');
  setButtonDisabled(false);
  for (var i = 0; i < midiButtons.length; i++) {
    hookListener(midiButtons[i]);
  }
}

function setButtonDisabled(b) {
  for (var i = 0; i < midiButtons.length; i++) {
    midiButtons[i].disabled = b;
  }
}

function hookListener(dom) {
  dom.addEventListener('click', function() {
    setButtonDisabled(true);
    playMIDI(dom.dataset['src']);
  });
}

function playMIDI(url) {
  console.log('playMIDI: ' + url);
  $('message-section').hidden = false;
  $('message').textContent = 'midi downloading';
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url);
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
      playMIDIData(ff.join(""));
    } else if (xhr.readyState === 4) {
      $('message').textContent = 'failed to download midi file';
    }
  }
  xhr.send();
}

function playMIDIData(data) {
  $('message').textContent = 'parsing file';

  midiFile = MidiFile(data);
  $('message').textContent = 'pre-loading';
  activePlayer = Replayer(midiFile, MIDIChannel);
  activePlayer.finishedCallback = function() {
    $('message-section').hidden = true;
    setButtonDisabled(false);
    $('control-section').hidden = true;
    activePlayer = null;
  };
  $('control-section').hidden = false;
  $('message').textContent = 'playing';
  activePlayer.replay();
}

function updateSpeed() {
  if (!activePlayer) {
    return;
  }

  var speed = $('text-speed').value;
  var dSpeed = parseFloat(speed, 10);
  if (!isNaN(dSpeed)) {
    activePlayer.changeSpeed(dSpeed);
  }
}

function stopPlaying() {
  if (!activePlayer) {
    return;
  }

  activePlayer.stop();
}
