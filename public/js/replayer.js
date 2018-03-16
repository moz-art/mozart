function Replayer(midiFile, channelClass) {
  var channelCount = 16;
  var speed = 1;
  var channels = [];
  var activeChannels = null;
  var started = false;
  
  for (var i = 0; i < channelCount; i++) {
    channels[i] = new channelClass(i);
  }

  function finish() {
    channels.forEach(function(channel) {
      console.log("[Replayer.js] finished");
      channel.stopAllNotes();
    });
    if (self.finishedCallback) {
      self.finishedCallback();
    }
  }


  function handleNoteOn(channel, number, velocity) {
    if (is_valid_channel(channel)) {
      channels[channel].noteOn(number, velocity, 0);
    }
  }

  function handleNoteOff(channel, number) {
    if (is_valid_channel(channel)) {
      channels[channel].noteOff(number, 0);
    }
  }

  function handleProgramChange(channel, number) {
    if (is_valid_channel(channel)) {
      channels[channel].setProgram(number);
    }
  }

  function is_valid_channel(channel) {
    if (activeChannels !== null && activeChannels !== undefined &
      activeChannels.indexOf(channel) == -1) {
      return false;
    }
    return true;
  }

  function replay() {
    started = true;
  }

  function stopPlaying() {
    finish();
  }

  function setActiveChannels(channels) {
    activeChannels = channels;
  }

  var self = {
    'setActiveChannels': setActiveChannels,
    'replay': replay,
    'stop': stopPlaying,
    'handleNoteOn': handleNoteOn,
    'handleNoteOff': handleNoteOff,
    'handleProgramChange': handleProgramChange,
    'finishedCallback': null
  };
  return self;
}
