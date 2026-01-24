"""
ListingGopher Document-Based AI Generation Endpoints

Three endpoints for document-based AI generation:
- /generate/draft-text - Draft MLS remarks, buyer responses, etc.
- /generate/review - Review documents for readiness
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


# =============================================================================
# Document Processing Helpers
# =============================================================================

async def download_document(url: str) -> bytes:
    """Download document content from URL."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    }

    async with httpx.AsyncClient(headers=headers, timeout=30.0) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.content


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

        # Image files - handle via vision, not text extraction
        if ext in ("jpg", "jpeg", "png", "webp", "heic", "gif"):
            return None

        content = await download_document(url)

        if ext == "pdf":
            return extract_pdf_text(content)
        elif ext == "docx":
            return extract_docx_text(content)
        elif ext == "doc":
            # Old .doc format - try to decode as text (limited support)
            logger.warning(f"Old .doc format has limited support: {url}")
            return content.decode("utf-8", errors="ignore")
        elif ext == "txt":
            return content.decode("utf-8", errors="ignore")
        else:
            # Try to decode as text
            return content.decode("utf-8", errors="ignore")

    except Exception as e:
        logger.error(f"Failed to extract text from {url}: {e}")
        return None


async def process_documents(document_urls: List[str]) -> tuple[str, List[str]]:
    """
    Process documents and separate text content from image URLs.

    Returns:
        tuple: (combined_text, image_urls)
    """
    text_parts = []
    image_urls = []

    for url in document_urls:
        ext = get_file_extension(url)

        # Images go to vision
        if ext in ("jpg", "jpeg", "png", "webp", "heic", "gif"):
            image_urls.append(url)
            continue

        # Try text extraction
        text = await extract_text_from_document(url)
        if text and text.strip():
            # Add a separator with filename hint
            filename = url.split("/")[-1].split("?")[0]
            text_parts.append(f"--- Document: {filename} ---\n{text}")

    combined_text = "\n\n".join(text_parts)
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

    try:
        # Process documents - separate text from images
        document_text, image_urls = await process_documents(request.document_urls)

        # Build user prompt with document content
        user_prompt_parts = [request.user_prompt]

        if document_text:
            user_prompt_parts.append(f"\n\n=== DOCUMENT CONTENT ===\n{document_text}")

        if not document_text and not image_urls:
            # No documents provided - just use the prompt
            logger.info("Draft text generation with prompt only (no documents)")

        full_user_prompt = "\n".join(user_prompt_parts)

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
