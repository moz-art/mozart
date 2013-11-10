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
  if (!MIDI.Soundfont[progNum]) {
    console.log('fallback to piano');
  }
  MIDI.programChange(this.channelIndex, MIDI.Soundfont[progNum] ? progNum : 0);
};

MIDIChannel.prototype.stopAllNotes = function() {
  if (MIDI.stopAllNotes) {
    MIDI.stopAllNotes();
  }
};