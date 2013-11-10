function MIDIChannel(idx) {
  this.channelIndex = idx;
  MIDI.programChange(this.channelIndex, 0);
}

MIDIChannel.prototype.noteOn = function(note, velocity, delay) {
  MIDI.noteOn(this.channelIndex, note, velocity, delay);
};

MIDIChannel.prototype.noteOff = function(note, delay) {
  MIDI.noteOff(this.channelIndex, note, delay);  
};

MIDIChannel.prototype.setProgram = function(progNum) {
  var instrument = MIDI.GeneralMIDI.byId[progNum];
  console.log('instrument: ' + instrument.id);
  console.log('soundfont: ' + MIDI.Soundfont[instrument.id]);
  MIDI.programChange(this.channelIndex,
                     MIDI.Soundfont[instrument.id] ? progNum : 0);
};

MIDIChannel.prototype.stopAllNotes = function() {
  if (MIDI.stopAllNotes) {
    MIDI.stopAllNotes();
  }
};