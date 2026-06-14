/** A single note's on/off span within a MIDI track, in ticks. */
export interface MidiNoteEvent {
  /** MIDI note number (0-127), where 60 = C4. */
  pitch: number;
  startTick: number;
  durationTicks: number;
}

export interface MidiTrack {
  /** Track name from a meta event (0x03), if present. */
  name: string | null;
  /** Note events in this track, ordered by start time. */
  events: MidiNoteEvent[];
}

export interface ParsedMidi {
  /** Pulses (ticks) per quarter note, from the file header. */
  ticksPerQuarter: number;
  tracks: MidiTrack[];
}

export interface MidiParseError {
  error: string;
}
