"""
Video Generation Endpoint for Listing Magic
Generates walkthrough videos with ElevenLabs TTS voiceover
"""

import logging
import time
import os
import re
import tempfile
import subprocess
from typing import List, Optional, Dict, Any

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Video Generation"])


# =============================================================================
# Request/Response Models
# =============================================================================

class VideoGenerationRequest(BaseModel):
    """Request model for video generation."""
    script: str = Field(..., min_length=50, description="Walk-thru script for voiceover")
    photo_urls: List[str] = Field(..., description="Public URLs to property photos")
    listing_id: str = Field(..., description="Listing ID for storage path")
    include_voiceover: bool = Field(default=True, description="Whether to include ElevenLabs voiceover")
    voice_id: str = Field(default="21m00Tcm4TlvDq8ikWAM", description="ElevenLabs voice ID")


class VoicePreviewRequest(BaseModel):
    """Request model for voice preview."""
    voice_id: str = Field(..., description="ElevenLabs voice ID")
    text: str = Field(..., description="Text to convert to speech")


class VideoGenerationResponse(BaseModel):
    """Response model for video generation."""
    success: bool = True
    video_url: str = Field(..., description="URL to the generated video")
    script_url: Optional[str] = Field(None, description="URL to the script text file")
    has_voiceover: bool = Field(default=True, description="Whether video has voiceover")
    duration_seconds: float = Field(default=0.0, description="Video duration in seconds")
    processing_time_seconds: float = Field(default=0.0)
    photos_used: int = Field(default=0)


# =============================================================================
# Supabase Upload Functions
# =============================================================================

async def upload_to_supabase(file_path: str, destination_path: str) -> str:
    """Upload file to Supabase storage and return public URL.

    Uses direct REST API calls with service role key.
    """
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")

    # Determine content type
    content_type = "video/mp4" if file_path.endswith(".mp4") else "text/plain"

    # Read file
    with open(file_path, "rb") as f:
        file_content = f.read()

    # Upload to Supabase storage
    bucket = "property-photos"
    upload_url = f"{supabase_url}/storage/v1/object/{bucket}/{destination_path}"

    async with httpx.AsyncClient() as client:
        response = await client.post(
            upload_url,
            content=file_content,
            headers={
                "Authorization": f"Bearer {supabase_key}",
                "Content-Type": content_type,
                "x-upsert": "true"  # Overwrite if exists
            },
            timeout=300.0  # 5 minute timeout for large videos
        )

        if response.status_code not in [200, 201]:
            logger.error(f"Supabase upload failed: {response.status_code} - {response.text}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to upload to storage: {response.text}"
            )

    # Return public URL
    public_url = f"{supabase_url}/storage/v1/object/public/{bucket}/{destination_path}"
    return public_url


async def upload_text_to_supabase(text_content: str, destination_path: str) -> str:
    """Upload text content to Supabase storage."""
    # Write to temp file
    with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
        f.write(text_content)
        temp_path = f.name

    try:
        url = await upload_to_supabase(temp_path, destination_path)
        return url
    finally:
        os.unlink(temp_path)


# =============================================================================
# Script Parsing
# =============================================================================

def parse_script_sections(script: str) -> List[Dict[str, Any]]:
    """Extract sections from script markers like [ENTRY & LIVING]."""
    sections = []
    pattern = r'\[([^\]]+)\]'
    parts = re.split(pattern, script)

    # Handle script that starts without a marker
    if parts and parts[0].strip() and not parts[0].startswith('['):
        intro_text = parts[0].strip()
        word_count = len(intro_text.split())
        duration_seconds = (word_count / 150) * 60  # ~150 words per minute
        sections.append({
            "name": "INTRO",
            "text": intro_text,
            "duration": max(duration_seconds, 3)
        })

    for i in range(1, len(parts), 2):
        section_name = parts[i].strip()
        section_text = parts[i+1].strip() if i+1 < len(parts) else ""
        word_count = len(section_text.split())
        duration_seconds = (word_count / 150) * 60  # ~150 words per minute

        sections.append({
            "name": section_name,
            "text": section_text,
            "duration": max(duration_seconds, 3)
        })

    return sections


def get_clean_script_text(script: str) -> str:
    """Remove section markers and get clean text for TTS."""
    # Remove [SECTION] markers
    clean = re.sub(r'\[[^\]]+\]', '', script)
    # Normalize whitespace
    clean = ' '.join(clean.split())
    return clean.strip()


# =============================================================================
# Photo and Video Processing
# =============================================================================

async def download_photo(url: str, output_path: str) -> bool:
    """Download photo from URL to local file."""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        }
        async with httpx.AsyncClient(headers=headers) as client:
            response = await client.get(url, timeout=30.0)
            response.raise_for_status()
            with open(output_path, 'wb') as f:
                f.write(response.content)
        return True
    except Exception as e:
        logger.warning(f"Failed to download photo {url}: {e}")
        return False


def create_video_from_photos_with_audio(
    photo_paths: List[str],
    audio_path: str,
    output_path: str,
    audio_duration: float
) -> bool:
    """Create video with photos timed to audio using ffmpeg."""
    try:
        if not photo_paths:
            logger.error("No photos to create video from")
            return False

        # Calculate duration per photo
        photos_duration = audio_duration / len(photo_paths)
        photos_duration = max(3, min(10, photos_duration))  # Between 3-10 seconds per photo

        # Create concat file for ffmpeg
        concat_file = os.path.join(tempfile.gettempdir(), "concat.txt")
        with open(concat_file, 'w') as f:
            for photo in photo_paths:
                f.write(f"file '{photo}'\n")
                f.write(f"duration {photos_duration}\n")
            # Repeat last photo to avoid ffmpeg issue
            f.write(f"file '{photo_paths[-1]}'\n")

        # First, create video from photos with scaling/padding to 1920x1080
        silent_video = os.path.join(tempfile.gettempdir(), "silent_video.mp4")

        ffmpeg_cmd = [
            "ffmpeg", "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", concat_file,
            "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1",
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-r", "30",
            silent_video
        ]

        result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
        if result.returncode != 0:
            logger.error(f"FFmpeg silent video failed: {result.stderr}")
            return False

        # Merge video with audio
        merge_cmd = [
            "ffmpeg", "-y",
            "-i", silent_video,
            "-i", audio_path,
            "-c:v", "copy",
            "-c:a", "aac",
            "-shortest",
            output_path
        ]

        result = subprocess.run(merge_cmd, capture_output=True, text=True)
        if result.returncode != 0:
            logger.error(f"FFmpeg merge failed: {result.stderr}")
            return False

        # Cleanup
        os.unlink(concat_file)
        os.unlink(silent_video)

        return True

    except Exception as e:
        logger.error(f"Video creation failed: {e}")
        return False


def create_silent_video(
    photo_paths: List[str],
    output_path: str,
    seconds_per_photo: float = 5.0
) -> bool:
    """Create video without voiceover - fixed duration per photo."""
    try:
        if not photo_paths:
            logger.error("No photos to create video from")
            return False

        # Create concat file
        concat_file = os.path.join(tempfile.gettempdir(), "concat.txt")
        with open(concat_file, 'w') as f:
            for photo in photo_paths:
                f.write(f"file '{photo}'\n")
                f.write(f"duration {seconds_per_photo}\n")
            f.write(f"file '{photo_paths[-1]}'\n")

        ffmpeg_cmd = [
            "ffmpeg", "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", concat_file,
            "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1",
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-r", "30",
            output_path
        ]

        result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
        if result.returncode != 0:
            logger.error(f"FFmpeg silent video failed: {result.stderr}")
            return False

        os.unlink(concat_file)
        return True

    except Exception as e:
        logger.error(f"Silent video creation failed: {e}")
        return False


def get_audio_duration(audio_path: str) -> float:
    """Get duration of audio file using ffprobe."""
    try:
        cmd = [
            "ffprobe",
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            audio_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        return float(result.stdout.strip())
    except Exception:
        return 0.0


def get_video_duration(video_path: str) -> float:
    """Get duration of video file using ffprobe."""
    try:
        cmd = [
            "ffprobe",
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            video_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        return float(result.stdout.strip())
    except Exception:
        return 0.0


# =============================================================================
# ElevenLabs TTS
# =============================================================================

async def generate_voiceover(script: str, output_path: str, voice_id: str = "21m00Tcm4TlvDq8ikWAM") -> bool:
    """Generate voiceover using ElevenLabs API.

    Args:
        script: The script text to convert to speech
        output_path: Path to save the audio file
        voice_id: ElevenLabs voice ID (default: Rachel)
    """
    api_key = os.environ.get("ELEVENLABS_API_KEY")

    if not api_key:
        logger.warning("ELEVENLABS_API_KEY not set, skipping voiceover")
        return False

    try:
        # Clean script for TTS
        clean_text = get_clean_script_text(script)

        if not clean_text:
            logger.warning("No text to convert to speech")
            return False

        # ElevenLabs API endpoint
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"

        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": api_key
        }

        data = {
            "text": clean_text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75,
                "style": 0.0,
                "use_speaker_boost": True
            }
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                json=data,
                headers=headers,
                timeout=120.0  # TTS can take a while
            )

            if response.status_code != 200:
                logger.error(f"ElevenLabs API error: {response.status_code} - {response.text}")
                return False

            with open(output_path, 'wb') as f:
                f.write(response.content)

        logger.info(f"✅ ElevenLabs voiceover generated: {output_path}")
        return True

    except Exception as e:
        logger.error(f"ElevenLabs TTS failed: {e}")
        return False


# =============================================================================
# Voice Preview Endpoint
# =============================================================================

@router.post("/api/preview-voice")
async def preview_voice(request: VoicePreviewRequest):
    """
    Generate a short voice preview for testing different voices.

    Returns audio as base64-encoded MP3 for easy frontend playback.
    """
    api_key = os.environ.get("ELEVENLABS_API_KEY")

    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Voice preview unavailable - ELEVENLABS_API_KEY not configured"
        )

    try:
        # Limit preview text length
        preview_text = request.text[:200] if len(request.text) > 200 else request.text

        url = f"https://api.elevenlabs.io/v1/text-to-speech/{request.voice_id}"

        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": api_key
        }

        data = {
            "text": preview_text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75,
                "style": 0.0,
                "use_speaker_boost": True
            }
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                json=data,
                headers=headers,
                timeout=30.0
            )

            if response.status_code != 200:
                logger.error(f"ElevenLabs preview error: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Voice preview failed: {response.text}"
                )

            # Return audio as base64
            import base64
            audio_base64 = base64.b64encode(response.content).decode('utf-8')

            return {
                "success": True,
                "audio_base64": audio_base64,
                "content_type": "audio/mpeg"
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Voice preview failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Voice preview failed: {str(e)}"
        )


# =============================================================================
# Main Endpoint
# =============================================================================

@router.post("/api/generate-video", response_model=VideoGenerationResponse)
async def generate_walkthrough_video(request: VideoGenerationRequest) -> VideoGenerationResponse:
    """
    Generate property walkthrough video with voiceover.

    Takes the walk-thru script and property photos, generates a professional
    voiceover using ElevenLabs TTS, and creates a video slideshow synced
    to the narration.

    If ElevenLabs is unavailable, falls back to a silent video with
    5 seconds per photo.
    """
    start_time = time.time()

    logger.info(f"Generating video for listing: {request.listing_id}")
    logger.info(f"Processing {len(request.photo_urls)} photos")

    # Create temp directory for this request
    temp_dir = tempfile.mkdtemp(prefix="video_gen_")

    try:
        # 1. Download all photos
        photo_paths = []
        for i, url in enumerate(request.photo_urls):
            photo_path = os.path.join(temp_dir, f"photo_{i:03d}.jpg")
            success = await download_photo(url, photo_path)
            if success:
                photo_paths.append(photo_path)
            else:
                logger.warning(f"Skipping photo {i}: download failed")

        if not photo_paths:
            raise HTTPException(
                status_code=400,
                detail="No photos could be downloaded"
            )

        logger.info(f"Downloaded {len(photo_paths)} photos")

        # 2. Generate voiceover (if requested)
        audio_path = os.path.join(temp_dir, "voiceover.mp3")
        has_voiceover = False

        if request.include_voiceover:
            logger.info(f"Generating voiceover with voice: {request.voice_id}")
            has_voiceover = await generate_voiceover(request.script, audio_path, request.voice_id)
        else:
            logger.info("Voiceover disabled by user request")

        # 3. Create video
        video_path = os.path.join(temp_dir, "walkthrough_video.mp4")

        if has_voiceover:
            audio_duration = get_audio_duration(audio_path)
            logger.info(f"Audio duration: {audio_duration}s")

            success = create_video_from_photos_with_audio(
                photo_paths,
                audio_path,
                video_path,
                audio_duration
            )

            if not success:
                logger.warning("Video with audio failed, falling back to silent")
                has_voiceover = False
                success = create_silent_video(photo_paths, video_path)
        else:
            success = create_silent_video(photo_paths, video_path)

        if not success or not os.path.exists(video_path):
            raise HTTPException(
                status_code=500,
                detail="Video generation failed"
            )

        # 4. Upload video to Supabase
        video_destination = f"{request.listing_id}/walkthrough_video.mp4"
        video_url = await upload_to_supabase(video_path, video_destination)
        logger.info(f"Video uploaded: {video_url}")

        # 5. Upload script to Supabase
        script_destination = f"{request.listing_id}/walkthrough_script.txt"
        script_url = await upload_text_to_supabase(request.script, script_destination)
        logger.info(f"Script uploaded: {script_url}")

        # 6. Get video duration
        video_duration = get_video_duration(video_path)

        processing_time = time.time() - start_time

        logger.info(f"✅ Video generation complete: {video_duration}s, voiceover: {has_voiceover}, took {processing_time:.1f}s")

        return VideoGenerationResponse(
            success=True,
            video_url=video_url,
            script_url=script_url,
            has_voiceover=has_voiceover,
            duration_seconds=video_duration,
            processing_time_seconds=processing_time,
            photos_used=len(photo_paths)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Video generation failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Video generation failed: {str(e)}"
        )
    finally:
        # Cleanup temp files
        try:
            import shutil
            shutil.rmtree(temp_dir)
        except Exception as e:
            logger.warning(f"Failed to cleanup temp dir: {e}")
