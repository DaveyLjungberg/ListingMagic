/**
 * ElevenLabs Voice Configuration
 *
 * Voice IDs and metadata for the walkthrough video voiceover feature.
 * These are ElevenLabs API voice IDs - update if voices are deprecated or new ones added.
 */

export interface VoiceOption {
  id: string;
  name: string;
  gender: "Female" | "Male";
  age: "Young" | "Middle-aged";
  description: string;
}

/**
 * Default voice ID used when no voice is specified.
 * Sarah - a warm, engaging female voice.
 */
export const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

/**
 * Available ElevenLabs voices for walkthrough videos.
 * All voices are American English.
 */
export const VOICE_OPTIONS: VoiceOption[] = [
  // Female voices (American)
  {
    id: "EXAVITQu4vr4xnSDxMaL",
    name: "Sarah",
    gender: "Female",
    age: "Young",
    description: "Warm, engaging",
  },
  {
    id: "FGY2WhTYpPnrIDTdsKH5",
    name: "Laura",
    gender: "Female",
    age: "Young",
    description: "Friendly, approachable",
  },
  {
    id: "XrExE9yKIg1WjnnlVkGX",
    name: "Matilda",
    gender: "Female",
    age: "Middle-aged",
    description: "Professional, polished",
  },
  // Male voices (American)
  {
    id: "nPczCjzI2devNBz1zQrb",
    name: "Brian",
    gender: "Male",
    age: "Middle-aged",
    description: "Authoritative, trustworthy",
  },
  {
    id: "iP95p4xoKVk53GoZ742B",
    name: "Chris",
    gender: "Male",
    age: "Middle-aged",
    description: "Clear, professional",
  },
  {
    id: "cjVigY5qzO86Huf0OWal",
    name: "Eric",
    gender: "Male",
    age: "Middle-aged",
    description: "Warm, confident",
  },
];

/**
 * Get a voice option by ID
 */
export function getVoiceById(id: string): VoiceOption | undefined {
  return VOICE_OPTIONS.find(voice => voice.id === id);
}

/**
 * Get the default voice option
 */
export function getDefaultVoice(): VoiceOption {
  return VOICE_OPTIONS.find(voice => voice.id === DEFAULT_VOICE_ID) || VOICE_OPTIONS[0];
}
