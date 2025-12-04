"""
Video Generation Endpoint for Listing Magic
Generates walkthrough videos from property photos (silent, no voiceover)
"""

import logging
import time
import os
import re
import tempfile
import subprocess
import shutil
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
    script: str = Field(..., min_length=50, description="Walk-thru script for text overlays")
    photo_urls: List[str] = Field(..., description="Public URLs to property photos")
    listing_id: str = Field(..., description="Listing ID for storage path")
    seconds_per_photo: float = Field(default=5.0, ge=2.0, le=15.0, description="Duration per photo in seconds")


class VideoGenerationResponse(BaseModel):
    """Response model for video generation."""
    success: bool = True
    video_url: str = Field(..., description="URL to the generated video")
    script_url: Optional[str] = Field(None, description="URL to the script text file")
    has_voiceover: bool = Field(default=False, description="Always false - videos are silent")
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


def create_silent_video(
    photo_paths: List[str],
    output_path: str,
    seconds_per_photo: float = 5.0
) -> bool:
    """Create silent video from photos with smooth transitions.

    Args:
        photo_paths: List of paths to photo files
        output_path: Path for output video file
        seconds_per_photo: Duration each photo is displayed

    Returns:
        True if video creation succeeded, False otherwise
    """
    concat_file = None

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
            # Repeat last photo to avoid ffmpeg issue
            f.write(f"file '{photo_paths[-1]}'\n")

        # Create video with scaling to 1920x1080, maintaining aspect ratio
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

        return True

    except Exception as e:
        logger.error(f"Silent video creation failed: {e}")
        return False
    finally:
        # Always cleanup temp file
        if concat_file and os.path.exists(concat_file):
            try:
                os.unlink(concat_file)
            except Exception as e:
                logger.warning(f"Failed to cleanup concat file: {e}")


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
# Main Endpoint
# =============================================================================

@router.post("/api/generate-video", response_model=VideoGenerationResponse)
async def generate_walkthrough_video(request: VideoGenerationRequest) -> VideoGenerationResponse:
    """
    Generate property walkthrough video from photos.

    Creates a silent video slideshow from property photos with smooth transitions.
    The walk-thru script is saved separately as a text file for reference.

    Video specs:
    - Resolution: 1920x1080 (HD)
    - Format: MP4 (H.264)
    - Frame rate: 30fps
    - Audio: None (silent)
    """
    start_time = time.time()

    logger.info(f"Generating silent video for listing: {request.listing_id}")
    logger.info(f"Processing {len(request.photo_urls)} photos at {request.seconds_per_photo}s each")

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

        # 2. Create silent video
        video_path = os.path.join(temp_dir, "walkthrough_video.mp4")

        success = create_silent_video(
            photo_paths,
            video_path,
            seconds_per_photo=request.seconds_per_photo
        )

        if not success or not os.path.exists(video_path):
            raise HTTPException(
                status_code=500,
                detail="Video generation failed"
            )

        # 3. Upload video to Supabase
        video_destination = f"{request.listing_id}/walkthrough_video.mp4"
        video_url = await upload_to_supabase(video_path, video_destination)
        logger.info(f"Video uploaded: {video_url}")

        # 4. Upload script to Supabase (for reference)
        script_destination = f"{request.listing_id}/walkthrough_script.txt"
        script_url = await upload_text_to_supabase(request.script, script_destination)
        logger.info(f"Script uploaded: {script_url}")

        # 5. Get video duration
        video_duration = get_video_duration(video_path)

        processing_time = time.time() - start_time

        logger.info(f"✅ Silent video generation complete: {video_duration}s, {len(photo_paths)} photos, took {processing_time:.1f}s")

        return VideoGenerationResponse(
            success=True,
            video_url=video_url,
            script_url=script_url,
            has_voiceover=False,
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
            shutil.rmtree(temp_dir)
        except Exception as e:
            logger.warning(f"Failed to cleanup temp dir: {e}")
