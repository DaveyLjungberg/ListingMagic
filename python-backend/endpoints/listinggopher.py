"""
ListingGopher Document-Based AI Generation Endpoints

Four endpoints for document-based AI generation:
- /generate/draft-text - Draft MLS remarks, buyer responses, etc.
- /generate/review - Review documents for readiness
- /generate/walkthru - Draft walk-through scripts
- /generate/summarize - Summarize key points from documents

Uses unified AI generation service:
- Primary: OpenAI gpt-5.2
- Fallback: Gemini gemini-2.0-flash (infrastructure failures only)
"""

import io
import logging
import time
from typing import List, Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.ai_generation_service import generate_content_with_fallback

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/generate", tags=["ListingGopher"])


# =============================================================================
# Request/Response Models
# =============================================================================

class DraftTextRequest(BaseModel):
    """Request for drafting text content."""
    user_prompt: str = Field(..., min_length=1, description="User's instructions")
    document_urls: List[str] = Field(default=[], description="URLs to uploaded documents")


class ReviewRequest(BaseModel):
    """Request for document review."""
    user_prompt: str = Field(..., min_length=1, description="User's instructions")
    document_urls: List[str] = Field(default=[], description="URLs to uploaded documents")


class SummarizeRequest(BaseModel):
    """Request for document summarization."""
    user_prompt: str = Field(..., min_length=1, description="User's instructions")
    document_urls: List[str] = Field(default=[], description="URLs to uploaded documents")


class WalkthruRequest(BaseModel):
    """Request for walk-through script generation."""
    user_prompt: str = Field(..., min_length=1, description="User's instructions")
    document_urls: List[str] = Field(default=[], description="URLs to uploaded documents")


class GenerationResponse(BaseModel):
    """Response for all generation endpoints."""
    success: bool
    generated_text: str = ""
    ai_cost: float = 0.0
    token_count: int = 0
    error: Optional[str] = None


# =============================================================================
# System Prompts
# =============================================================================

DRAFT_TEXT_SYSTEM = """You are a professional real estate copywriter. Based on the provided documents and user instructions, draft compelling, accurate real estate marketing content.

Guidelines:
- Use third-person language only (never "you", "your", "welcome", "step inside")
- Be factual and descriptive based on the document content
- Highlight key features mentioned in documents
- Follow Fair Housing guidelines - no discriminatory language or references to protected classes
- Match the tone and style requested by the user
- If drafting MLS public remarks, keep within typical character limits (250-500 words)

Output only the drafted content - no explanations, headers, or meta-commentary."""


REVIEW_SYSTEM = """You are a thorough real estate document reviewer. Analyze the provided documents and provide a comprehensive review.

Your review should cover:
- Missing information or gaps in the documentation
- Potential issues, errors, or red flags
- Inconsistencies between documents
- Readiness for listing or transaction
- Suggested actions or corrections needed

Format your response in a clear, organized manner using:
- Bullet points for specific issues
- Categories/sections for different types of findings
- Priority indicators (HIGH, MEDIUM, LOW) for important issues

Be direct and actionable in your feedback."""


SUMMARIZE_SYSTEM = """You are a concise document summarizer for real estate professionals. Extract and summarize the most important information from the provided documents.

Focus on:
- Key property details (size, features, condition, improvements)
- Important dates, deadlines, or timeframes
- Financial information (prices, costs, assessments) if present
- Notable terms, conditions, or restrictions
- Any critical action items or requirements

Format:
- Use bullet points for clarity
- Group related information together
- Highlight the most critical items first
- Keep summaries concise but complete

Output only the summary - no preamble or meta-commentary."""


WALKTHRU_SYSTEM = """You are a professional real estate video script writer. Create engaging walk-through scripts that guide viewers through the property.

Guidelines:
- Write in a conversational, engaging tone suitable for video narration
- Describe each room/area as if walking through the home
- Highlight key features, upgrades, and selling points
- Include smooth transitions between spaces ("Moving into the kitchen..." or "As we head upstairs...")
- Keep the pace natural and flowing
- Use sensory language to help viewers imagine themselves in the space
- Focus on what makes the property special
- Avoid discriminatory language or Fair Housing violations
- Use third-person perspective ("This residence features...") or neutral narration

Format the script with clear scene/room breaks for easy recording.

Output only the walk-through script - no explanations or meta-commentary."""


# =============================================================================
# Document Processing Helpers
# =============================================================================

async def download_document(url: str) -> bytes:
    """Download document content from URL."""
    print(f"📥 Downloading document: {url[:80]}...")

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    }

    try:
        async with httpx.AsyncClient(headers=headers, timeout=30.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            content = response.content
            print(f"✅ Downloaded {len(content)} bytes from {url.split('/')[-1].split('?')[0]}")
            return content
    except Exception as e:
        print(f"❌ Download failed for {url[:50]}: {e}")
        raise


def extract_pdf_text(content: bytes) -> str:
    """Extract text from PDF content."""
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(content))
        text_parts = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                text_parts.append(text)
        return "\n\n".join(text_parts)
    except Exception as e:
        logger.warning(f"PDF extraction failed: {e}")
        return ""


def extract_docx_text(content: bytes) -> str:
    """Extract text from DOCX content."""
    try:
        from docx import Document
        doc = Document(io.BytesIO(content))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        return "\n\n".join(paragraphs)
    except Exception as e:
        logger.warning(f"DOCX extraction failed: {e}")
        return ""


def get_file_extension(url: str) -> str:
    """Get file extension from URL."""
    # Remove query parameters
    path = url.split("?")[0]
    # Get extension
    if "." in path:
        return path.rsplit(".", 1)[-1].lower()
    return ""


async def extract_text_from_document(url: str) -> Optional[str]:
    """
    Extract text content from a document URL.

    For text documents (PDF, DOCX, TXT): extracts and returns text
    For images: returns None (handled separately via vision)
    """
    try:
        ext = get_file_extension(url)
        filename = url.split("/")[-1].split("?")[0]
        print(f"📄 Processing document with extension: '{ext}' from {filename}")

        # Image files - handle via vision, not text extraction
        if ext in ("jpg", "jpeg", "png", "webp", "heic", "gif"):
            print(f"🖼️ Skipping image file (handled via vision): {ext}")
            return None

        content = await download_document(url)

        extracted_text = ""
        if ext == "pdf":
            extracted_text = extract_pdf_text(content)
            print(f"📑 PDF extracted: {len(extracted_text)} chars")
        elif ext == "docx":
            extracted_text = extract_docx_text(content)
            print(f"📝 DOCX extracted: {len(extracted_text)} chars")
        elif ext == "doc":
            print(f"⚠️ Old .doc format - limited support")
            logger.warning(f"Old .doc format has limited support: {url}")
            extracted_text = content.decode("utf-8", errors="ignore")
        elif ext == "txt":
            extracted_text = content.decode("utf-8", errors="ignore")
            print(f"📃 TXT decoded: {len(extracted_text)} chars")
        else:
            extracted_text = content.decode("utf-8", errors="ignore")
            print(f"❓ Unknown extension '{ext}' - decoded as text: {len(extracted_text)} chars")

        # Show first 200 chars of extracted content
        preview = extracted_text[:200].replace('\n', ' ') if extracted_text else "(empty)"
        print(f"📖 Content preview: {preview}...")

        return extracted_text

    except Exception as e:
        print(f"❌ Text extraction failed for {url[:50]}: {e}")
        logger.error(f"Failed to extract text from {url}: {e}")
        return None


async def process_documents(document_urls: List[str]) -> tuple[str, List[str]]:
    """
    Process documents and separate text content from image URLs.

    Returns:
        tuple: (combined_text, image_urls)
    """
    print(f"\n{'='*60}")
    print(f"🔍 PROCESSING {len(document_urls)} DOCUMENTS")
    print(f"{'='*60}")

    text_parts = []
    image_urls = []

    for i, url in enumerate(document_urls):
        print(f"\n--- Document {i+1}/{len(document_urls)} ---")
        ext = get_file_extension(url)

        # Images go to vision
        if ext in ("jpg", "jpeg", "png", "webp", "heic", "gif"):
            print(f"🖼️ Image detected: {ext} - adding to vision list")
            image_urls.append(url)
            continue

        # Try text extraction
        text = await extract_text_from_document(url)
        if text and text.strip():
            # Add a separator with filename hint
            filename = url.split("/")[-1].split("?")[0]
            text_parts.append(f"--- Document: {filename} ---\n{text}")
            print(f"✅ Added text from {filename}: {len(text)} chars")
        else:
            print(f"⚠️ No text extracted from document {i+1}")

    combined_text = "\n\n".join(text_parts)

    print(f"\n{'='*60}")
    print(f"📊 PROCESSING COMPLETE:")
    print(f"   - Text documents: {len(text_parts)}")
    print(f"   - Image documents: {len(image_urls)}")
    print(f"   - Total text length: {len(combined_text)} chars")
    print(f"{'='*60}\n")

    return combined_text, image_urls


# =============================================================================
# Endpoints
# =============================================================================

@router.post("/draft-text", response_model=GenerationResponse)
async def generate_draft_text(request: DraftTextRequest) -> GenerationResponse:
    """
    Draft text content based on uploaded documents.

    Uses unified AI generation service:
    - Primary: OpenAI gpt-5.2
    - Fallback: Gemini gemini-2.0-flash (infrastructure failures only)
    """
    start_time = time.time()

    print(f"\n{'#'*60}")
    print(f"# DRAFT TEXT GENERATION REQUEST")
    print(f"# User prompt: {request.user_prompt[:100]}...")
    print(f"# Document URLs: {len(request.document_urls)}")
    for i, url in enumerate(request.document_urls):
        print(f"#   {i+1}. {url[:80]}...")
    print(f"{'#'*60}\n")

    try:
        # Process documents - separate text from images
        document_text, image_urls = await process_documents(request.document_urls)

        # Build user prompt with document content
        user_prompt_parts = [request.user_prompt]

        if document_text:
            user_prompt_parts.append(f"\n\n=== DOCUMENT CONTENT ===\n{document_text}")
            print(f"✅ Document content added to prompt ({len(document_text)} chars)")
        else:
            print(f"⚠️ No document text to add to prompt")

        if not document_text and not image_urls:
            # No documents provided - just use the prompt
            print(f"⚠️ No documents provided - using prompt only")
            logger.info("Draft text generation with prompt only (no documents)")

        full_user_prompt = "\n".join(user_prompt_parts)
        print(f"📝 Final prompt length: {len(full_user_prompt)} chars")

        # Generate using unified service
        result = await generate_content_with_fallback(
            system_prompt=DRAFT_TEXT_SYSTEM,
            user_prompt=full_user_prompt,
            photo_urls=image_urls,  # Images for vision analysis
            task_type="public_remarks",
            temperature=0.7,
            max_output_tokens=2000
        )

        if not result.success:
            return GenerationResponse(
                success=False,
                error=result.error or "AI generation failed"
            )

        processing_time = (time.time() - start_time) * 1000
        logger.info(f"Draft text generated in {processing_time:.0f}ms using {result.model_used}")

        return GenerationResponse(
            success=True,
            generated_text=result.content.strip(),
            ai_cost=0.0,  # Cost tracking handled separately
            token_count=(result.input_tokens or 0) + (result.output_tokens or 0)
        )

    except Exception as e:
        logger.error(f"Draft text generation failed: {e}", exc_info=True)
        return GenerationResponse(
            success=False,
            error=str(e)
        )


@router.post("/review", response_model=GenerationResponse)
async def generate_review(request: ReviewRequest) -> GenerationResponse:
    """
    Review documents for completeness and issues.

    Uses unified AI generation service:
    - Primary: OpenAI gpt-5.2
    - Fallback: Gemini gemini-2.0-flash (infrastructure failures only)
    """
    start_time = time.time()

    try:
        # Process documents
        document_text, image_urls = await process_documents(request.document_urls)

        if not document_text and not image_urls:
            return GenerationResponse(
                success=False,
                error="No documents provided to review"
            )

        # Build user prompt with document content
        user_prompt_parts = [request.user_prompt]

        if document_text:
            user_prompt_parts.append(f"\n\n=== DOCUMENTS TO REVIEW ===\n{document_text}")

        full_user_prompt = "\n".join(user_prompt_parts)

        # Generate using unified service
        result = await generate_content_with_fallback(
            system_prompt=REVIEW_SYSTEM,
            user_prompt=full_user_prompt,
            photo_urls=image_urls,
            task_type="features",  # Use features task type for review
            temperature=0.3,  # Lower for analytical content
            max_output_tokens=3000
        )

        if not result.success:
            return GenerationResponse(
                success=False,
                error=result.error or "AI generation failed"
            )

        processing_time = (time.time() - start_time) * 1000
        logger.info(f"Review generated in {processing_time:.0f}ms using {result.model_used}")

        return GenerationResponse(
            success=True,
            generated_text=result.content.strip(),
            ai_cost=0.0,
            token_count=(result.input_tokens or 0) + (result.output_tokens or 0)
        )

    except Exception as e:
        logger.error(f"Review generation failed: {e}", exc_info=True)
        return GenerationResponse(
            success=False,
            error=str(e)
        )


@router.post("/summarize", response_model=GenerationResponse)
async def generate_summarize(request: SummarizeRequest) -> GenerationResponse:
    """
    Summarize key points from documents.

    Uses unified AI generation service:
    - Primary: OpenAI gpt-5.2
    - Fallback: Gemini gemini-2.0-flash (infrastructure failures only)
    """
    start_time = time.time()

    try:
        # Process documents
        document_text, image_urls = await process_documents(request.document_urls)

        if not document_text and not image_urls:
            return GenerationResponse(
                success=False,
                error="No documents provided to summarize"
            )

        # Build user prompt with document content
        user_prompt_parts = [request.user_prompt]

        if document_text:
            user_prompt_parts.append(f"\n\n=== DOCUMENTS TO SUMMARIZE ===\n{document_text}")

        full_user_prompt = "\n".join(user_prompt_parts)

        # Generate using unified service
        result = await generate_content_with_fallback(
            system_prompt=SUMMARIZE_SYSTEM,
            user_prompt=full_user_prompt,
            photo_urls=image_urls,
            task_type="features",  # Use features task type for summarization
            temperature=0.3,  # Lower for factual extraction
            max_output_tokens=2000
        )

        if not result.success:
            return GenerationResponse(
                success=False,
                error=result.error or "AI generation failed"
            )

        processing_time = (time.time() - start_time) * 1000
        logger.info(f"Summary generated in {processing_time:.0f}ms using {result.model_used}")

        return GenerationResponse(
            success=True,
            generated_text=result.content.strip(),
            ai_cost=0.0,
            token_count=(result.input_tokens or 0) + (result.output_tokens or 0)
        )

    except Exception as e:
        logger.error(f"Summarization failed: {e}", exc_info=True)
        return GenerationResponse(
            success=False,
            error=str(e)
        )


@router.post("/walkthru", response_model=GenerationResponse)
async def generate_walkthru(request: WalkthruRequest) -> GenerationResponse:
    """
    Generate walk-through script for property tours.

    Uses unified AI generation service:
    - Primary: OpenAI gpt-5.2
    - Fallback: Gemini gemini-2.0-flash (infrastructure failures only)
    """
    start_time = time.time()

    try:
        # Process documents - separate text from images
        document_text, image_urls = await process_documents(request.document_urls)

        # Build user prompt with document content
        user_prompt_parts = [request.user_prompt]

        if document_text:
            user_prompt_parts.append(f"\n\n=== PROPERTY DOCUMENTS ===\n{document_text}")

        if not document_text and not image_urls:
            # No documents provided - just use the prompt
            logger.info("Walk-thru generation with prompt only (no documents)")

        full_user_prompt = "\n".join(user_prompt_parts)

        # Generate using unified service
        result = await generate_content_with_fallback(
            system_prompt=WALKTHRU_SYSTEM,
            user_prompt=full_user_prompt,
            photo_urls=image_urls,  # Images for vision analysis
            task_type="public_remarks",  # Use public_remarks for creative writing
            temperature=0.7,  # Higher for creative content
            max_output_tokens=3000  # Walk-thru scripts can be longer
        )

        if not result.success:
            return GenerationResponse(
                success=False,
                error=result.error or "AI generation failed"
            )

        processing_time = (time.time() - start_time) * 1000
        logger.info(f"Walk-thru script generated in {processing_time:.0f}ms using {result.model_used}")

        return GenerationResponse(
            success=True,
            generated_text=result.content.strip(),
            ai_cost=0.0,  # Cost tracking handled separately
            token_count=(result.input_tokens or 0) + (result.output_tokens or 0)
        )

    except Exception as e:
        logger.error(f"Walk-thru generation failed: {e}", exc_info=True)
        return GenerationResponse(
            success=False,
            error=str(e)
        )
