/**
 * ElevenLabs Voice Configuration
 *
 * DEPRECATED: ElevenLabs voiceover feature has been removed.
 * Videos are now generated as silent slideshows.
 *
 * This file is kept for reference but is no longer used.
 */

export interface VoiceOption {
  id: string;
  name: string;
  gender: "Female" | "Male";
  age: "Young" | "Middle-aged";
  description: string;
}

// These exports are kept for backwards compatibility but are not used
export const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";
export const VOICE_OPTIONS: VoiceOption[] = [];

export function getVoiceById(id: string): VoiceOption | undefined {
  return undefined;
}

export function getDefaultVoice(): VoiceOption | undefined {
  return undefined;
}
